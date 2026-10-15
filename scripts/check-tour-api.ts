// 한국관광공사 TourAPI 실제 연결 확인: 관광지 1건만 조회해 기본 정보만 출력한다.
// 실행: npm run check:tour   (인증키는 출력하지 않음, DB는 건드리지 않음)
import { TourApiError, fetchAreaBasedList } from '../src/lib/tour-api.ts';

try {
  const r = await fetchAreaBasedList({ numOfRows: 1 });
  const it = r.items[0];
  console.log('연결 성공 ✅  (전체 관광지 수:', r.totalCount.toLocaleString('ko-KR') + '건)');
  if (it) {
    console.log('- 이름:', it.title);
    console.log('- 주소:', it.address ?? '(없음)');
    console.log('- contentid:', it.contentId, '/ 지역코드:', it.areaCode ?? '-', '/ 시군구코드:', it.sigunguCode ?? '-');
    console.log('- 관광공사 수정일:', it.modifiedAt ?? '-');
  }
  console.log('- 출처:', r.source.provider, r.source.operation, '/ 조회 시각:', r.source.fetchedAt);
} catch (e) {
  const code = e instanceof TourApiError ? e.code : 'unknown';
  console.error(`연결 실패 ❌ [${code}]`, e instanceof Error ? e.message : '');
  process.exitCode = 1;
}
