import type { Metadata } from 'next';
import Link from 'next/link';
import { signOut } from '../actions';
import { requireAdmin } from '@/lib/admin/auth.ts';

export const metadata: Metadata = { title: '관리자', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-2 font-extrabold">관리자</span>
        <Link href="/admin" className="rounded-full bg-white px-3 py-1.5 font-semibold hover:bg-sage-light">대시보드</Link>
        <Link href="/admin/places/new" className="rounded-full bg-white px-3 py-1.5 font-semibold hover:bg-sage-light">장소 추가</Link>
        <Link href="/admin/review" className="rounded-full bg-white px-3 py-1.5 font-semibold hover:bg-sage-light">변경 검토</Link>
        <Link href="/" className="rounded-full bg-white px-3 py-1.5 font-semibold hover:bg-sage-light">사이트 보기</Link>
        <form action={signOut} className="ml-auto flex items-center gap-2">
          <span className="hidden text-ink-soft sm:inline">{user.email}</span>
          <button className="rounded-full border border-sand px-3 py-1.5 hover:border-coral">로그아웃</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
