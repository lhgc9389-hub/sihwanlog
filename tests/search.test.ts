import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listSido, searchPlaces } from '../src/lib/search.ts';
import { SAMPLE_PLACES, getPlace } from '../src/data/sample-places.ts';
import { FEATURE_KEYS, type OutingPlace } from '../src/lib/types.ts';

const ids = (list: OutingPlace[]) => list.map((p) => p.id).sort();

test('예시 데이터: 모두 isSample 표시, 확인일 없음, 확인 필요 상태', () => {
  assert.ok(SAMPLE_PLACES.length > 0);
  for (const p of SAMPLE_PLACES) {
    assert.equal(p.isSample, true, p.id);
    assert.equal(p.lastCheckedAt, null, p.id);
    assert.equal(p.verifyStatus, 'needs_check', p.id);
    if (p.address) assert.match(p.address, /예시/, `${p.id} 주소에 예시 표시 필요`);
  }
});

test('예시 데이터: id 중복 없음, 모든 편의시설 항목 존재', () => {
  assert.equal(new Set(SAMPLE_PLACES.map((p) => p.id)).size, SAMPLE_PLACES.length);
  for (const p of SAMPLE_PLACES) for (const k of FEATURE_KEYS) assert.ok(['yes', 'no', 'unknown'].includes(p.features[k]), `${p.id}.${k}`);
});

test('검색: 조건 없으면 전체', () => {
  assert.equal(searchPlaces(SAMPLE_PLACES, {}).length, SAMPLE_PLACES.length);
});

test('검색: 지역(시·도) 필터', () => {
  const r = searchPlaces(SAMPLE_PLACES, { sido: '경기도' });
  assert.ok(r.length > 0);
  assert.ok(r.every((p) => p.sido === '경기도'));
});

test('검색: 키워드는 이름·지역·주소, 띄어쓰기 무시', () => {
  assert.deepEqual(ids(searchPlaces(SAMPLE_PLACES, { keyword: '햇살 어린이' })), ['sample-sunshine-museum']);
  assert.deepEqual(ids(searchPlaces(SAMPLE_PLACES, { keyword: '햇살어린이' })), ['sample-sunshine-museum']);
  assert.ok(searchPlaces(SAMPLE_PLACES, { keyword: '부산' }).every((p) => p.sido === '부산광역시'));
  assert.equal(searchPlaces(SAMPLE_PLACES, { keyword: '존재하지않는장소' }).length, 0);
});

test('필터: 확인된(yes) 장소만, unknown/no는 제외', () => {
  for (const k of FEATURE_KEYS) {
    const r = searchPlaces(SAMPLE_PLACES, { features: [k] });
    assert.deepEqual(ids(r), ids(SAMPLE_PLACES.filter((p) => p.features[k] === 'yes')), k);
  }
  // 모든 항목이 확인 필요인 장소는 어떤 필터에도 나오지 않음
  const unknownPlace = getPlace('sample-riverside-garden')!;
  for (const k of FEATURE_KEYS) assert.ok(!searchPlaces([unknownPlace], { features: [k] }).length);
});

test('필터: 여러 조건은 모두 만족(AND) + 지역과 함께', () => {
  const r = searchPlaces(SAMPLE_PLACES, { features: ['nursingRoom', 'parking'] });
  assert.ok(r.every((p) => p.features.nursingRoom === 'yes' && p.features.parking === 'yes'));
  const r2 = searchPlaces(SAMPLE_PLACES, { sido: '서울특별시', features: ['freeEntry'] });
  assert.deepEqual(ids(r2), ['sample-sunshine-museum']);
});

test('지역 목록: 중복 없이 정렬', () => {
  const s = listSido(SAMPLE_PLACES);
  assert.equal(new Set(s).size, s.length);
  assert.deepEqual(s, [...s].sort((a, b) => a.localeCompare(b, 'ko')));
});
