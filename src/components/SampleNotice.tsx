/** allSample: 화면의 장소가 전부 예시 데이터인지(DB 미연결), 일부 테스트 데이터만 섞였는지 */
export function SampleNotice({ allSample = true }: { allSample?: boolean }) {
  return (
    <div role="note" className="border-b border-amber-200 bg-amber-50">
      <p className="mx-auto max-w-5xl px-4 py-2 text-center text-sm text-amber-900">
        <strong>안내:</strong>{' '}
        {allSample ? (
          <>
            지금 보이는 장소는 모두 화면 확인용 <strong>예시 데이터</strong>예요. 실제 장소·요금·편의시설 정보가 아닙니다.
          </>
        ) : (
          <>
            <strong>예시 데이터</strong> 표시가 붙은 장소는 테스트용이에요. 실제 장소 정보가 아닙니다.
          </>
        )}
      </p>
    </div>
  );
}
