import { PlaceExplorer } from '@/components/PlaceExplorer';
import { SampleNotice } from '@/components/SampleNotice';
import { loadPlaces } from '@/lib/place-source.ts';

// 요청마다 최신 공개 데이터를 읽는다 (Supabase 연결 시)
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { mode, places, error } = await loadPlaces();
  return (
    <>
      {places.some((p) => p.isSample) && <SampleNotice allSample={mode === 'sample'} />}
      <section className="bg-gradient-to-b from-peach/50 via-cream to-cream">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 text-center sm:pt-16">
          <p className="text-sm font-semibold tracking-wide text-coral-dark">아기랑 나들이, 시환로그</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">검색은 제가 합니다!</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-soft sm:text-lg">
            아기랑 가볼 만한 곳, 할인 혜택과 편의시설을
            <br className="hidden sm:block" /> 대신 찾아 정리해 드려요.
          </p>
        </div>
      </section>
      {error && (
        <p role="alert" className="mx-auto mb-12 max-w-5xl px-4 text-center text-sm text-rose-800">
          {error}
        </p>
      )}
      <PlaceExplorer places={places} />
    </>
  );
}
