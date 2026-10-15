// 주간 자동 점검 (Vercel Cron이 매주 월요일 06:00 KST에 호출 — vercel.json).
// Vercel은 CRON_SECRET 환경변수가 있으면 'Authorization: Bearer <CRON_SECRET>' 헤더를 붙여 호출한다.
import { timingSafeEqual } from 'node:crypto';
import { runAndRecordCheck } from '@/lib/admin/check-runner.ts';
import { createServiceClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get('authorization'))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = createServiceClient();
  if (!db) return Response.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' }, { status: 500 });
  try {
    const result = await runAndRecordCheck(db, 'schedule');
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    console.error('[시환로그] 주간 점검 실패:', e instanceof Error ? e.message : '알 수 없는 오류');
    return Response.json({ ok: false, error: '점검 실패' }, { status: 500 });
  }
}
