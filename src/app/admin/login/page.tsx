import type { Metadata } from 'next';
import { signIn } from '../actions';
import { Flash, btnPrimary, inputCls } from '@/components/admin/ui';

export const metadata: Metadata = { title: '관리자 로그인', robots: { index: false } };

const ERRORS: Record<string, string> = {
  invalid: '이메일 또는 비밀번호가 올바르지 않아요.',
  forbidden: '관리자로 등록된 계정이 아니에요. (Supabase admins 테이블 등록 필요)',
  config: 'Supabase 연결 설정(.env.local)이 없어 로그인할 수 없어요.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold">시환로그 관리자</h1>
      <p className="mt-1 text-sm text-ink-soft">등록된 관리자만 로그인할 수 있어요.</p>
      <div className="mt-6">
        <Flash err={e && e !== 'signed_out' ? ERRORS[e] : undefined} msg={e === 'signed_out' ? '로그아웃했어요.' : undefined} />
      </div>
      <form action={signIn} className="grid gap-3">
        <label>
          <span className="mb-1 block text-sm font-semibold">이메일</span>
          <input name="email" type="email" required autoComplete="username" className={inputCls} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">비밀번호</span>
          <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
        </label>
        <button className={`${btnPrimary} mt-2`}>로그인</button>
      </form>
    </div>
  );
}
