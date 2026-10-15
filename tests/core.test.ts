import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, htmlToText } from '../src/core/extract.ts';
import { fetchOfficialPage, validateOfficialUrl } from '../src/core/fetcher.ts';
import { ReviewStore, WorkflowError, diffToCandidates, runWeeklyCheck } from '../src/core/workflow.ts';
import type { Place } from '../src/core/types.ts';

const HTML = `<html><body><script>var x=1</script>
<h1>테스트 박물관(가상)</h1>
<ul><li>운영시간: 09:00 ~ 18:00</li><li>휴관일: 매주 월요일</li></ul>
<table><tr><td>성인</td><td>5,000원</td></tr><tr><td>어린이</td><td>3,000원</td></tr></table>
<p>만 36개월 이하 영유아 무료</p><p>1층에 수유실이 있습니다.</p></body></html>`;

const mkPlace = (over: Partial<Place> = {}): Place => ({
  id: 'p1', name: '테스트 장소', officialUrl: 'https://example.org/a', isTestData: true,
  publicData: { adult_fee: '4000', opening_hours: '09:00~18:00' }, ...over,
});

const mockFetch = (status: number, body = HTML, ctype = 'text/html; charset=utf-8') =>
  (async () => new Response(body, { status, headers: { 'content-type': ctype } })) as unknown as typeof fetch;

test('htmlToText: script 제거', () => assert.ok(!htmlToText(HTML).includes('var x')));

test('extract: 요금·시간·휴관·영유아·수유실', () => {
  const r = Object.fromEntries(extractFields(HTML).map((e) => [e.field, e]));
  assert.equal(r.adult_fee.value, '5000'); assert.equal(r.adult_fee.confidence, 'high');
  assert.equal(r.child_fee.value, '3000');
  assert.equal(r.opening_hours.value, '09:00~18:00');
  assert.match(r.closed_days.value, /월요일/);
  assert.equal(r.infant_free.confidence, 'high');
  assert.equal(r.nursing_room.confidence, 'low'); // 편의시설은 단정하지 않음
});

test('extract: 값이 갈리면 low, 못 읽으면 빈 배열(추정 금지)', () => {
  const multi = extractFields('<p>성인 5,000원</p><p>성인 7,000원 (성수기)</p>');
  assert.equal(multi[0].confidence, 'low');
  assert.deepEqual(extractFields('<div id="app"></div><script>render()</script>'), []);
});

test('fetch: 내부주소/잘못된 URL 차단', () => {
  assert.equal(validateOfficialUrl('http://127.0.0.1/x').ok, false);
  assert.equal(validateOfficialUrl('ftp://a.b').ok, false);
  assert.equal(validateOfficialUrl('nonsense').ok, false);
});

test('fetch: 403은 우회 없이 blocked, 재시도 안 함', async () => {
  let n = 0;
  const f = (async () => { n++; return new Response('x', { status: 403 }); }) as unknown as typeof fetch;
  const r = await fetchOfficialPage('https://example.org', { fetchImpl: f, sleep: async () => {} });
  assert.deepEqual([r.ok, !r.ok && r.kind, n], [false, 'blocked_by_site', 1]);
});

test('fetch: 5xx는 제한된 횟수만 재시도', async () => {
  let n = 0;
  const f = (async () => { n++; return new Response('x', { status: 503 }); }) as unknown as typeof fetch;
  const r = await fetchOfficialPage('https://example.org', { fetchImpl: f, maxRetries: 2, sleep: async () => {} });
  assert.equal(n, 3); assert.equal(!r.ok && r.kind, 'http_error');
});

test('fetch: PDF는 not_html', async () => {
  const r = await fetchOfficialPage('https://example.org/a.pdf', { fetchImpl: mockFetch(200, '%PDF', 'application/pdf') });
  assert.equal(!r.ok && r.kind, 'not_html');
});

test('diff: 달라진 항목만 후보, 가격은 critical', () => {
  const s = new ReviewStore([mkPlace()]);
  const c = diffToCandidates(s.places.get('p1')!, extractFields(HTML), 'https://example.org/a', 'T', s.newId);
  const fields = c.map((x) => x.field);
  assert.ok(fields.includes('adult_fee')); assert.ok(!fields.includes('opening_hours')); // 동일 값은 제외
  assert.equal(c.find((x) => x.field === 'adult_fee')!.critical, true);
});

test('승인 전에는 공개 데이터 유지, 승인 후 반영, 이력 기록', () => {
  const s = new ReviewStore([mkPlace()]);
  s.addCandidates(diffToCandidates(s.places.get('p1')!, extractFields(HTML), 'u', 'T', s.newId));
  assert.equal(s.places.get('p1')!.publicData.adult_fee, '4000');
  const c = s.pending().find((x) => x.field === 'adult_fee')!;
  s.approve(c.id, 'admin');
  assert.equal(s.places.get('p1')!.publicData.adult_fee, '5000');
  assert.deepEqual([s.history[0].before, s.history[0].after, s.history[0].admin], ['4000', '5000', 'admin']);
});

test('거절: 사유 필수, 기존 정보 유지', () => {
  const s = new ReviewStore([mkPlace()]);
  s.addCandidates(diffToCandidates(s.places.get('p1')!, extractFields(HTML), 'u', 'T', s.newId));
  const c = s.pending().find((x) => x.field === 'adult_fee')!;
  assert.throws(() => s.reject(c.id, 'a', ' '), (e: unknown) => (e as WorkflowError).code === 'reason_required');
  s.reject(c.id, 'a', '성수기 요금임');
  assert.equal(s.places.get('p1')!.publicData.adult_fee, '4000');
  assert.equal(s.history.at(-1)!.reason, '성수기 요금임');
});

test('확신 낮은 후보는 그대로 승인 불가, 수정 후 승인만 가능', () => {
  const s = new ReviewStore([mkPlace({ publicData: {} })]);
  s.addCandidates(diffToCandidates(s.places.get('p1')!, extractFields(HTML), 'u', 'T', s.newId));
  const low = s.pending().find((x) => x.field === 'nursing_room')!;
  assert.throws(() => s.approve(low.id, 'a'), (e: unknown) => (e as WorkflowError).code === 'edit_required');
  s.approveWithEdit(low.id, 'a', '있음(1층)');
  assert.equal(s.places.get('p1')!.publicData.nursing_room, '있음(1층)');
});

test('충돌: 공개 값이 바뀐 뒤의 오래된 후보는 덮어쓰지 않음', () => {
  const s = new ReviewStore([mkPlace()]);
  s.addCandidates(diffToCandidates(s.places.get('p1')!, [{ field: 'adult_fee', value: '5000', confidence: 'high', evidence: '' }], 'u', 'T', s.newId));
  const old = s.pending()[0];
  s.places.get('p1')!.publicData.adult_fee = '4500'; // 관리자가 직접 수정
  assert.throws(() => s.approve(old.id, 'a'), (e: unknown) => (e as WorkflowError).code === 'conflict');
  assert.equal(s.places.get('p1')!.publicData.adult_fee, '4500');
});

test('중복 후보 방지 + 보류', () => {
  const s = new ReviewStore([mkPlace()]);
  const mk = () => diffToCandidates(s.places.get('p1')!, [{ field: 'adult_fee', value: '5000', confidence: 'high', evidence: '' }], 'u', 'T', s.newId);
  s.addCandidates(mk()); s.addCandidates(mk());
  assert.equal(s.pending().length, 1);
  s.hold(s.pending()[0].id, 'a', '전화 확인 예정');
  assert.equal(s.pending().length, 0);
});

test('주간 실행: 성공/접속실패/추출실패/URL없음을 구분 기록하고 공개 데이터는 불변', async () => {
  const s = new ReviewStore([
    mkPlace({ id: 'ok' }),
    mkPlace({ id: 'down', officialUrl: 'https://down.example' }),
    mkPlace({ id: 'empty', officialUrl: 'https://empty.example' }),
    mkPlace({ id: 'nourl', officialUrl: null }),
  ]);
  const f = (async (u: URL) => {
    const h = String(u);
    if (h.includes('down')) return new Response('', { status: 404 });
    if (h.includes('empty')) return new Response('<div id=app></div>', { status: 200, headers: { 'content-type': 'text/html' } });
    return new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } });
  }) as unknown as typeof fetch;
  const before = JSON.stringify([...s.places.values()].map((p) => p.publicData));
  const sum = await runWeeklyCheck(s, { fetch: { fetchImpl: f, sleep: async () => {} }, sleep: async () => {}, delayMs: 0 });
  const st = Object.fromEntries(sum.outcomes.map((o) => [o.placeId, o.status]));
  assert.deepEqual(st, { ok: 'ok', down: 'fetch_failed', empty: 'extract_failed', nourl: 'skipped_no_url' });
  assert.equal(sum.failed, 2); assert.ok(sum.candidatesCreated > 0);
  assert.equal(JSON.stringify([...s.places.values()].map((p) => p.publicData)), before);
});

test('주간 실행: 동시 중복 실행 차단', async () => {
  const s = new ReviewStore([mkPlace()]);
  const slow = (async () => { await new Promise((r) => setTimeout(r, 50)); return new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }); }) as unknown as typeof fetch;
  const o = { fetch: { fetchImpl: slow, sleep: async () => {} }, sleep: async () => {}, delayMs: 0 };
  const a = runWeeklyCheck(s, o);
  await assert.rejects(() => runWeeklyCheck(s, o), /중복 실행/);
  await a;
});
