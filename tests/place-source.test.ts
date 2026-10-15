import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveStatus, parseTri, rowToOutingPlace, toKstDate, type FactRow, type PlaceRow } from '../src/lib/place-mapping.ts';
import { getSupabaseConfig, loadPlace, loadPlaces } from '../src/lib/place-source.ts';
import { searchPlaces } from '../src/lib/search.ts';
import { SAMPLE_PLACES } from '../src/data/sample-places.ts';

const NOW = new Date('2026-10-14T00:00:00Z');
const RECENT = '2026-10-01T03:00:00Z';
const OLD = '2025-01-01T00:00:00Z';

const fact = (field: string, value: string, over: Partial<FactRow> = {}): FactRow => ({
  field, value, status: 'official_site', source_url: 'https://example.org/info', verified_at: RECENT, ...over,
});

const mkRow = (over: Partial<PlaceRow> = {}): PlaceRow => ({
  slug: 'test-place', name: '테스트 장소', address: '테스트 주소', category: 'indoor', description: '설명',
  official_url: 'https://example.org', source_url: 'https://example.org/info', verify_status: 'official_site',
  recommended_age: null, is_test_data: true, last_checked_at: RECENT,
  regions: { sido: '테스트시', sigungu: '테스트구' }, place_facts: [], ...over,
});

const ENV = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'test-anon-key' };
const okFetch = (rows: unknown, seen: { url?: string; headers?: Record<string, string> } = {}) =>
  (async (url: string, init: RequestInit) => {
    seen.url = url; seen.headers = init.headers as Record<string, string>;
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

test('parseTri: 있음/없음 형식만 해석, 나머지는 판단 안 함', () => {
  assert.deepEqual(parseTri('있음(1층)'), { tri: 'yes', note: '1층' });
  assert.deepEqual(parseTri('있음: 다둥이 30%'), { tri: 'yes', note: '다둥이 30%' });
  assert.deepEqual(parseTri('없음'), { tri: 'no', note: null });
  assert.equal(parseTri('홈페이지에 언급됨: 수유실').tri, 'unknown');
  assert.equal(parseTri(null).tri, 'unknown');
});

test('effectiveStatus: 확인일 없으면 확인 필요, 오래되면 재확인 필요', () => {
  assert.equal(effectiveStatus('official_site', RECENT, NOW), 'official_site');
  assert.equal(effectiveStatus('official_site', null, NOW), 'needs_check');
  assert.equal(effectiveStatus('visited', OLD, NOW), 'stale');
  assert.equal(effectiveStatus('review_reference', RECENT, NOW), 'review_reference');
});

test('toKstDate: 한국 날짜 기준', () => {
  assert.equal(toKstDate('2026-10-13T16:00:00Z'), '2026-10-14');
  assert.equal(toKstDate(null), null);
});

test('변환: 확인된 편의시설만 있음, 미확인 값은 unknown + 상태 보존', () => {
  const p = rowToOutingPlace(mkRow({ place_facts: [
    fact('nursing_room', '있음(1층)'),
    fact('parking', '있음', { status: 'review_reference' }),
    fact('stroller', '있음', { verified_at: null }),
    fact('diaper_station', '없음'),
  ] }), NOW);
  assert.equal(p.features.nursingRoom, 'yes');
  assert.equal(p.featureNotes.nursingRoom, '1층');
  assert.equal(p.features.parking, 'unknown');
  assert.equal(p.factMeta?.parking?.status, 'review_reference');
  assert.equal(p.features.stroller, 'unknown');
  assert.equal(p.factMeta?.stroller?.status, 'needs_check');
  assert.equal(p.features.diaperStation, 'no');
  assert.equal(p.features.freeEntry, 'unknown'); // 정보 없음
  // 필터는 확인된 '있음'만 통과
  assert.equal(searchPlaces([p], { features: ['parking'] }).length, 0);
  assert.equal(searchPlaces([p], { features: ['nursingRoom'] }).length, 1);
});

test('변환: 요금·운영시간·팁·출처·확인일', () => {
  const p = rowToOutingPlace(mkRow({ place_facts: [
    fact('adult_fee', '5000'), fact('infant_free', '만 36개월 이하 무료'),
    fact('opening_hours', '09:00~18:00', { verified_at: OLD }),
    fact('discount', '있음: 다둥이 카드 30%'),
    fact('visit_tips', '오전이 한산해요\n\n주차장 협소'),
  ] }), NOW);
  assert.deepEqual(p.fees.map((f) => [f.label, f.value]), [['성인', '5,000원'], ['영유아', '만 36개월 이하 무료']]);
  assert.equal(p.fees[0].meta?.verifiedAt, '2026-10-01');
  assert.equal(p.hours, '09:00~18:00');
  assert.equal(p.factMeta?.hours?.status, 'stale');
  assert.deepEqual(p.discounts, ['다둥이 카드 30%']);
  assert.deepEqual(p.tips, ['오전이 한산해요', '주차장 협소']);
  assert.equal(p.sourceUrl, 'https://example.org/info');
  assert.equal(p.lastCheckedAt, '2026-10-01');
  assert.equal(p.id, 'test-place');
  assert.equal(p.isSample, true);
});

test('변환: 장소 상태도 확인일 없으면 확인 필요, 정보 없으면 모두 unknown', () => {
  const p = rowToOutingPlace(mkRow({ last_checked_at: null, place_facts: null, regions: null, category: null }), NOW);
  assert.equal(p.verifyStatus, 'needs_check');
  assert.equal(p.lastCheckedAt, null);
  assert.ok(Object.values(p.features).every((v) => v === 'unknown'));
  assert.equal(p.fees.length, 0);
});

test('설정: 둘 다 있어야 연결, https만 허용', () => {
  assert.equal(getSupabaseConfig({}), null);
  assert.equal(getSupabaseConfig({ SUPABASE_URL: ENV.SUPABASE_URL }), null);
  assert.equal(getSupabaseConfig({ ...ENV, SUPABASE_URL: 'http://abc.supabase.co' }), null);
  assert.equal(getSupabaseConfig({ ...ENV, SUPABASE_URL: 'nonsense' }), null);
  assert.equal(getSupabaseConfig({ ...ENV, SUPABASE_URL: 'https://abc.supabase.co/' })?.url, 'https://abc.supabase.co');
});

test('키 종류: 새 공개용 키는 apikey만, 예전 JWT 키는 Authorization도, 비밀 키는 거부', async () => {
  const s1: { headers?: Record<string, string> } = {};
  await loadPlaces({ env: { ...ENV, SUPABASE_ANON_KEY: 'sb_publishable_abc' }, fetchImpl: okFetch([], s1) });
  assert.equal(s1.headers!.apikey, 'sb_publishable_abc');
  assert.equal(s1.headers!.authorization, undefined);
  const s2: { headers?: Record<string, string> } = {};
  await loadPlaces({ env: { ...ENV, SUPABASE_ANON_KEY: 'eyJtest' }, fetchImpl: okFetch([], s2) });
  assert.equal(s2.headers!.authorization, 'Bearer eyJtest');
  assert.equal(getSupabaseConfig({ ...ENV, SUPABASE_ANON_KEY: 'sb_secret_x' }), null);
});

test('불러오기: 설정 없으면 예시 데이터 (네트워크 안 씀)', async () => {
  let called = false;
  const f = (async () => { called = true; return new Response('[]'); }) as unknown as typeof fetch;
  const r = await loadPlaces({ env: {}, fetchImpl: f });
  assert.equal(r.mode, 'sample');
  assert.equal(r.places, SAMPLE_PLACES);
  assert.equal(called, false);
});

test('불러오기: 공개된 장소만 조회, 키는 헤더로만 전송', async () => {
  const seen: { url?: string; headers?: Record<string, string> } = {};
  const r = await loadPlaces({ env: ENV, fetchImpl: okFetch([mkRow()], seen), now: NOW });
  assert.equal(r.mode, 'supabase');
  assert.equal(r.places.length, 1);
  assert.ok(seen.url!.startsWith('https://abc.supabase.co/rest/v1/places?'));
  assert.ok(seen.url!.includes('is_published=eq.true'));
  assert.ok(!seen.url!.includes('test-anon-key'));
  assert.equal(seen.headers!.apikey, 'test-anon-key');
});

test('불러오기 실패: 예시 데이터로 위장하지 않고 오류 문구, 키 노출 없음', async () => {
  const f = (async () => new Response('denied', { status: 401 })) as unknown as typeof fetch;
  const origError = console.error; const logs: string[] = [];
  console.error = (...a: unknown[]) => { logs.push(a.join(' ')); };
  try {
    const r = await loadPlaces({ env: ENV, fetchImpl: f });
    assert.equal(r.mode, 'supabase');
    assert.equal(r.places.length, 0);
    assert.ok(r.error);
    assert.ok(!JSON.stringify(r).includes('test-anon-key'));
    assert.ok(logs.every((l) => !l.includes('test-anon-key')));
  } finally { console.error = origError; }
});

test('상세: slug로 조회, 이상한 slug는 조회하지 않음', async () => {
  const seen: { url?: string } = {};
  const r = await loadPlace('test-place', { env: ENV, fetchImpl: okFetch([mkRow()], seen), now: NOW });
  assert.equal(r.place?.name, '테스트 장소');
  assert.ok(seen.url!.includes('slug=eq.test-place'));
  let called = false;
  const f = (async () => { called = true; return new Response('[]'); }) as unknown as typeof fetch;
  const bad = await loadPlace('x&is_published=eq.false', { env: ENV, fetchImpl: f });
  assert.equal(bad.place, undefined);
  assert.equal(called, false);
  // 설정 없으면 예시 데이터에서 찾음
  assert.equal((await loadPlace('sample-forest-park', { env: {} })).place?.name, '솔바람 숲속 놀이터');
});
