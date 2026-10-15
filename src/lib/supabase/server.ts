// 서버 전용 Supabase 클라이언트.
// - createSupabaseServer: 로그인한 관리자 세션(쿠키) + 공개용 키 → RLS가 그대로 적용된다.
// - createServiceClient: 서버 비밀키(SUPABASE_SERVICE_ROLE_KEY) → RLS 우회. 자동 점검(cron)에서만 사용.
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from '../place-source.ts';

export async function createSupabaseServer() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다 (proxy.ts가 세션을 갱신함)
        }
      },
    },
  });
}

export function createServiceClient() {
  const cfg = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!cfg || !key || key.startsWith('sb_publishable_')) return null;
  return createClient(cfg.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
