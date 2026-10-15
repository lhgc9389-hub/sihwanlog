import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-extrabold">찾으시는 페이지가 없어요</h1>
      <p className="mt-2 text-ink-soft">주소가 바뀌었거나 삭제된 장소일 수 있어요.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-coral px-6 py-2.5 font-bold text-white hover:bg-coral-dark">
        처음으로 돌아가기
      </Link>
    </div>
  );
}
