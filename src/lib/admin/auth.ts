// 관리자 권한 검사 (서버 전용). 모든 관리자 페이지와 서버 액션에서 호출한다.
// 로그인(Supabase Auth) + admins 테이블 등록(is_admin) 둘 다 만족해야 통과.
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../supabase/server.ts';

export async function requireAdmin() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect('/admin/login?e=config');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) redirect('/admin/login?e=forbidden');
  return { supabase, user };
}
