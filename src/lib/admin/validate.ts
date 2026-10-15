// 관리자 입력 검증 (서버 액션에서 사용, 순수 함수).
// 핵심 규칙: '확인된' 상태(공식 홈페이지/공식 문의/운영자 방문)로 저장하려면 출처 URL과 확인일이 반드시 있어야 한다.
import type { VerifyStatus } from '../../core/types.ts';
import { CATEGORY_LABELS, VERIFY_LABELS, isConfirmed, type Category } from '../types.ts';

export const FACT_FIELDS = [
  { field: 'adult_fee', label: '성인 요금', hint: '숫자만 (예: 5000)', kind: 'number' },
  { field: 'child_fee', label: '어린이 요금', hint: '숫자만 (예: 3000)', kind: 'number' },
  { field: 'infant_free', label: '영유아 무료 조건', hint: '예: 만 36개월 이하 무료', kind: 'text' },
  { field: 'opening_hours', label: '운영시간', hint: '예: 09:00~18:00', kind: 'text' },
  { field: 'closed_days', label: '휴무일', hint: '예: 매주 월요일', kind: 'text' },
  { field: 'free_entry', label: '무료입장', hint: "'있음' 또는 '없음', 예: 있음: 36개월 이하", kind: 'tri' },
  { field: 'discount', label: '할인', hint: '예: 있음: 다둥이 카드 30%', kind: 'tri' },
  { field: 'nursing_room', label: '수유실', hint: '예: 있음(1층)', kind: 'tri' },
  { field: 'diaper_station', label: '기저귀 교환대', hint: '예: 있음(화장실 내)', kind: 'tri' },
  { field: 'stroller', label: '유모차 접근성', hint: '예: 있음: 전 층 엘리베이터', kind: 'tri' },
  { field: 'parking', label: '주차', hint: '예: 있음: 유료', kind: 'tri' },
  { field: 'visit_tips', label: '방문 팁', hint: '한 줄에 하나', kind: 'multiline' },
] as const;

export const VERIFY_KEYS = Object.keys(VERIFY_LABELS) as VerifyStatus[];
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as Category[];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export function cleanUrl(raw: string): string | null | false {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : false;
  } catch {
    return false;
  }
}

/** 'YYYY-MM-DD' → 한국 자정 ISO. 빈 값은 null, 형식 오류·미래 날짜는 false */
export function cleanDate(raw: string, now = new Date()): string | null | false {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(`${raw}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return false;
  return d.toISOString();
}

export interface PlaceInput {
  slug: string;
  name: string;
  address: string | null;
  category: Category | null;
  description: string | null;
  official_url: string | null;
  source_url: string | null;
  recommended_age: string | null;
  verify_status: VerifyStatus;
  last_checked_at: string | null;
  is_published: boolean;
  is_test_data: boolean;
}

export function parsePlaceForm(fd: FormData, now = new Date()): Result<{ place: PlaceInput; region: { sido: string; sigungu: string } }> {
  const name = str(fd, 'name');
  const slug = str(fd, 'slug').toLowerCase();
  const sido = str(fd, 'sido');
  const sigungu = str(fd, 'sigungu');
  if (!name || name.length > 100) return { ok: false, error: '장소 이름을 1~100자로 입력하세요.' };
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return { ok: false, error: '주소용 이름(slug)은 영문 소문자·숫자·하이픈만 쓸 수 있어요.' };
  if (!sido || sido.length > 30 || sigungu.length > 30) return { ok: false, error: '시·도를 입력하세요.' };

  const category = str(fd, 'category');
  if (category && !CATEGORY_KEYS.includes(category as Category)) return { ok: false, error: '분류 값이 올바르지 않아요.' };
  const official = cleanUrl(str(fd, 'official_url'));
  const source = cleanUrl(str(fd, 'source_url'));
  if (official === false || source === false) return { ok: false, error: 'URL은 http:// 또는 https://로 시작해야 해요.' };
  const status = str(fd, 'verify_status') as VerifyStatus;
  if (!VERIFY_KEYS.includes(status)) return { ok: false, error: '검증 상태 값이 올바르지 않아요.' };
  const checked = cleanDate(str(fd, 'last_checked_at'), now);
  if (checked === false) return { ok: false, error: '확인일 형식이 올바르지 않거나 미래 날짜예요.' };
  if (isConfirmed(status) && (!(source ?? official) || !checked)) {
    return { ok: false, error: '확인된 상태로 저장하려면 출처 URL과 확인일이 필요해요.' };
  }
  const opt = (k: string, max: number) => str(fd, k).slice(0, max) || null;

  return {
    ok: true,
    value: {
      region: { sido, sigungu },
      place: {
        slug, name,
        address: opt('address', 200),
        category: (category || null) as Category | null,
        description: opt('description', 500),
        official_url: official,
        source_url: source,
        recommended_age: opt('recommended_age', 50),
        verify_status: status,
        last_checked_at: checked,
        is_published: fd.get('is_published') === 'on',
        is_test_data: fd.get('is_test_data') === 'on',
      },
    },
  };
}

export interface FactInput {
  field: string;
  value: string;
  status: VerifyStatus;
  source_url: string | null;
  verified_at: string | null;
}

/** 항목별 정보. 값이 비어 있으면 삭제(=미확인), 값이 있으면 상태·출처·확인일과 함께 저장 */
export function parseFactsForm(fd: FormData, now = new Date()): Result<{ upserts: FactInput[]; deletes: string[] }> {
  const upserts: FactInput[] = [];
  const deletes: string[] = [];
  for (const f of FACT_FIELDS) {
    const value = String(fd.get(`${f.field}.value`) ?? '').trim().slice(0, 1000);
    if (!value) { deletes.push(f.field); continue; }
    if (f.kind === 'number' && !/^\d{1,7}$/.test(value)) return { ok: false, error: `${f.label}: 숫자만 입력하세요 (무료는 0).` };
    if (f.kind === 'tri' && !/^(있음|없음)/.test(value)) return { ok: false, error: `${f.label}: '있음' 또는 '없음'으로 시작해야 해요.` };
    const status = String(fd.get(`${f.field}.status`) ?? '') as VerifyStatus;
    if (!VERIFY_KEYS.includes(status)) return { ok: false, error: `${f.label}: 검증 상태를 고르세요.` };
    const source = cleanUrl(String(fd.get(`${f.field}.source_url`) ?? '').trim());
    if (source === false) return { ok: false, error: `${f.label}: 출처 URL은 http:// 또는 https://로 시작해야 해요.` };
    const verified = cleanDate(String(fd.get(`${f.field}.verified_at`) ?? '').trim(), now);
    if (verified === false) return { ok: false, error: `${f.label}: 확인일 형식이 올바르지 않거나 미래 날짜예요.` };
    if (isConfirmed(status) && (!source || !verified)) {
      return { ok: false, error: `${f.label}: 확인된 상태로 저장하려면 출처 URL과 확인일이 필요해요.` };
    }
    upserts.push({ field: f.field, value, status, source_url: source, verified_at: verified });
  }
  return { ok: true, value: { upserts, deletes } };
}
