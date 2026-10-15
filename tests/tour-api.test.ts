import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TourApiError, buildTourUrl, fetchAreaBasedList, normalizeServiceKey, parseTourResponse } from '../src/lib/tour-api.ts';

const KEY = 'test+key/abc==';
const ok = (items: unknown, totalCount = 1) =>
  JSON.stringify({ response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { items, numOfRows: 1, pageNo: 1, totalCount } } });
const ITEM = { contentid: '126508', contenttypeid: '12', title: '테스트 관광지', addr1: '서울특별시 종로구', addr2: '1층', areacode: '1', sigungucode: '23', tel: '', firstimage: 'http://tong.visitkorea.or.kr/a.jpg', mapx: '126.97', mapy: '37.57', modifiedtime: '20260101120000' };

test('인증키: Encoding 키(%)는 되돌려서 이중 인코딩 방지', () => {
  assert.equal(normalizeServiceKey('a%2Bb%3D%3D'), 'a+b==');
  assert.equal(normalizeServiceKey(' plain '), 'plain');
  const url = new URL(buildTourUrl('areaBasedList2', 'a%2Bb%3D%3D', { numOfRows: 1 }));
  assert.equal(url.searchParams.get('serviceKey'), 'a+b==');
  assert.equal(url.searchParams.get('_type'), 'json');
  assert.ok(url.pathname.endsWith('/B551011/KorService2/areaBasedList2'));
});

test('응답 해석: 1건(객체)·여러 건(배열)·0건("")', () => {
  const one = parseTourResponse(ok({ item: ITEM }));
  assert.equal(one.items.length, 1);
  assert.deepEqual([one.items[0].title, one.items[0].address, one.items[0].tel, one.items[0].mapX], ['테스트 관광지', '서울특별시 종로구 1층', null, 126.97]);
  assert.ok(one.items[0].imageUrl!.startsWith('https://'));
  assert.equal(parseTourResponse(ok({ item: [ITEM, ITEM] }, 2)).items.length, 2);
  assert.deepEqual(parseTourResponse(ok('', 0)), { items: [], totalCount: 0 });
});

test('응답 해석: API 오류 코드·XML 인증 오류', () => {
  const apiErr = JSON.stringify({ response: { header: { resultCode: '10', resultMsg: 'INVALID_REQUEST_PARAMETER_ERROR' } } });
  assert.throws(() => parseTourResponse(apiErr), (e: unknown) => (e as TourApiError).code === 'api');
  const xml = '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>';
  assert.throws(() => parseTourResponse(xml), (e: unknown) => (e as TourApiError).code === 'auth' && /NOT_REGISTERED/.test((e as Error).message));
});

test('조회: 키 없으면 요청하지 않음', async () => {
  let called = false;
  const f = (async () => { called = true; return new Response(''); }) as unknown as typeof fetch;
  await assert.rejects(() => fetchAreaBasedList({ env: {}, fetchImpl: f }), (e: unknown) => (e as TourApiError).code === 'no_key');
  assert.equal(called, false);
});

test('조회: 관광지(12) 1건 요청, 출처 기록', async () => {
  let seen = '';
  const f = (async (u: string) => { seen = u; return new Response(ok({ item: ITEM })); }) as unknown as typeof fetch;
  const r = await fetchAreaBasedList({ numOfRows: 1, env: { TOUR_API_KEY: KEY }, fetchImpl: f });
  const url = new URL(seen);
  assert.deepEqual([url.searchParams.get('numOfRows'), url.searchParams.get('contentTypeId')], ['1', '12']);
  assert.equal(r.items[0].contentId, '126508');
  assert.equal(r.source.operation, 'areaBasedList2');
});

test('조회 실패: 오류 메시지에 인증키가 섞이지 않음', async () => {
  const net = (async () => { throw new TypeError(`fetch failed for https://x?serviceKey=${KEY}`); }) as unknown as typeof fetch;
  await assert.rejects(() => fetchAreaBasedList({ env: { TOUR_API_KEY: KEY }, fetchImpl: net }), (e: unknown) => !(e as Error).message.includes(KEY));
  const http = (async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(() => fetchAreaBasedList({ env: { TOUR_API_KEY: KEY }, fetchImpl: http }), (e: unknown) => (e as TourApiError).code === 'http' && !(e as Error).message.includes(KEY));
});
