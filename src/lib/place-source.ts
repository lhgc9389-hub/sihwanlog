// 장소 데이터 불러오기 (서버 전용).
// - Supabase 설정(SUPABASE_URL, SUPABASE_ANON_KEY)이 있으면 공개된 장소만 DB에서 읽는다.
// - 설정이 없으면 '예시 데이터'를 보여준다 (가짜 연결을 만들지 않음).
// - 키 이름에 NEXT_PUBLIC_을 붙이지 않으므로 브라우저 코드에 키가 들어가지 않는다.
// - 한국관광공사 TourAPI 키(TOUR_API_KEY)가 있으면 관광지 기본 정보도 함께 보여준다 (편의시설은 모두 '미확인').
import { SAMPLE_PLACES } from '../data/sample-places.ts';
import { rowToOutingPlace, type PlaceRow } from './place-mapping.ts';
import { fetchAreaBasedList, fetchDetailCommon, hasTourApiKey } from './tour-api.ts';
import { TOUR_ID_PREFIX, tourItemToOutingPlace } from './tour-mapping.ts';
import type { OutingPlace } from './types.ts';

export type DataMode = 'sample' | 'supabase' | 'tour';

/** 관광공사 목록: 한 번에 가져오는 개수와 재사용 시간(같은 데이터 반복 수집 방지) */
const TOUR_LIST_SIZE = 50;
const TOUR_CACHE_SECONDS = 6 * 60 * 60;

export interface PlacesResult {
  mode: DataMode;
  places: OutingPlace[];
  /** 불러오기 실패 시 이용자에게 보여줄 문구 (비밀 정보 미포함) */
  error?: string;
}

export interface SupabaseConfig { url: string; anonKey: string }

export function getSupabaseConfig(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  // 비밀 키는 방문자 화면 조회에 쓰지 않는다
  if (anonKey.startsWith('sb_secret_')) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

const SELECT =
  'slug,name,address,category,description,official_url,source_url,verify_status,recommended_age,is_test_data,last_checked_at,' +
  'regions(sido,sigungu),place_facts(field,value,status,source_url,verified_at)';

interface LoadOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: Date;
}

async function queryPlaces(cfg: SupabaseConfig, filter: string, opts: LoadOptions): Promise<PlaceRow[]> {
  const f = opts.fetchImpl ?? fetch;
  const url = `${cfg.url}/rest/v1/places?select=${encodeURIComponent(SELECT)}&is_published=eq.true${filter}&order=name.asc`;
  const headers: Record<string, string> = { apikey: cfg.anonKey, accept: 'application/json' };
  // 예전 anon 키(JWT, eyJ로 시작)만 Authorization에도 넣는다. 새 공개용 키(sb_publishable_)는 apikey 헤더만 사용.
  if (cfg.anonKey.startsWith('eyJ')) headers.authorization = `Bearer ${cfg.anonKey}`;
  const res = await f(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PlaceRow[];
}

const FAIL_MESSAGE = '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

/** 서버 로그용: 키가 섞이지 않도록 메시지만 남긴다 */
function logError(where: string, e: unknown) {
  console.error(`[시환로그] ${where} 실패:`, e instanceof Error ? e.message : '알 수 없는 오류');
}

async function loadTourPlaces(opts: LoadOptions): Promise<OutingPlace[] | null> {
  try {
    const r = await fetchAreaBasedList({ numOfRows: TOUR_LIST_SIZE, env: opts.env, fetchImpl: opts.fetchImpl, revalidateSeconds: TOUR_CACHE_SECONDS });
    return r.items.filter((i) => i.contentId && i.title).map((i) => tourItemToOutingPlace(i));
  } catch (e) {
    logError('관광공사 관광정보 조회', e);
    return null;
  }
}

export async function loadPlaces(opts: LoadOptions = {}): Promise<PlacesResult> {
  const env = opts.env ?? process.env;
  const cfg = getSupabaseConfig(env);
  const useTour = hasTourApiKey(env);
  if (!cfg && !useTour) return { mode: 'sample', places: SAMPLE_PLACES };

  const dbTask = cfg
    ? queryPlaces(cfg, '', opts).then(
        (rows) => rows.map((r) => rowToOutingPlace(r, opts.now)),
        (e) => { logError('장소 목록 조회', e); return null; },
      )
    : Promise.resolve([] as OutingPlace[]);
  const [db, tour] = await Promise.all([dbTask, useTour ? loadTourPlaces(opts) : Promise.resolve([] as OutingPlace[])]);

  // Supabase(운영자가 확인한 장소)를 먼저, 관광공사 관광지를 뒤에
  const places = [...(db ?? []), ...(tour ?? [])];
  const failed = db === null || tour === null;
  return {
    mode: cfg ? 'supabase' : 'tour',
    places,
    ...(failed && { error: places.length ? '일부 장소 정보를 불러오지 못했어요.' : FAIL_MESSAGE }),
  };
}

export async function loadPlace(slug: string, opts: LoadOptions = {}): Promise<{ mode: DataMode; place?: OutingPlace; error?: string }> {
  const env = opts.env ?? process.env;
  const cfg = getSupabaseConfig(env);
  if (slug.startsWith(TOUR_ID_PREFIX) && hasTourApiKey(env)) {
    try {
      const d = await fetchDetailCommon(slug.slice(TOUR_ID_PREFIX.length), { env, fetchImpl: opts.fetchImpl, revalidateSeconds: TOUR_CACHE_SECONDS });
      return { mode: cfg ? 'supabase' : 'tour', place: d ? tourItemToOutingPlace(d.item, d) : undefined };
    } catch (e) {
      logError('관광공사 상세 조회', e);
      return { mode: 'tour', error: FAIL_MESSAGE };
    }
  }
  if (!cfg) return { mode: 'sample', place: hasTourApiKey(env) ? undefined : SAMPLE_PLACES.find((p) => p.id === slug) };
  // slug는 영문 소문자·숫자·하이픈만 허용 (조회 주소 조작 방지)
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return { mode: 'supabase' };
  try {
    const rows = await queryPlaces(cfg, `&slug=eq.${slug}&limit=1`, opts);
    return { mode: 'supabase', place: rows[0] ? rowToOutingPlace(rows[0], opts.now) : undefined };
  } catch (e) {
    logError('장소 상세 조회', e);
    return { mode: 'supabase', error: FAIL_MESSAGE };
  }
}
