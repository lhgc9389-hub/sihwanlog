import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '시환로그 — 검색은 제가 합니다!', template: '%s | 시환로그' },
  description: '아기랑 가볼 만한 곳, 할인 혜택과 편의시설을 대신 찾아 정리하는 육아 나들이 검색 서비스.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fff8f1' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 border-b border-sand bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-coral text-lg text-white">🧸</span>
              <span className="text-xl font-extrabold tracking-tight">시환로그</span>
            </Link>
            <span className="hidden text-sm text-ink-soft sm:block">검색은 제가 합니다!</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-sand bg-sand/40">
          <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-ink-soft">
            <p className="font-bold text-ink">시환로그</p>
            <p className="mt-1">아기랑 가볼 만한 곳, 할인 혜택과 편의시설을 대신 찾아 정리하는 육아 나들이 검색 서비스.</p>
            <p className="mt-3">
              방문 전 요금·운영시간은 반드시 공식 홈페이지에서 한 번 더 확인해 주세요. 확인되지 않은 정보는 &lsquo;확인 필요&rsquo;로 표시합니다.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
