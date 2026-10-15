'use server';

// 관리자 서버 액션. 모든 쓰기 작업은 requireAdmin()으로 서버에서 권한을 다시 확인하고,
// 로그인한 관리자 세션으로 실행되므로 DB의 RLS(is_admin) 정책도 함께 적용된다.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth.ts';
import { runAndRecordCheck } from '@/lib/admin/check-runner.ts';
import { parseFactsForm, parsePlaceForm } from '@/lib/admin/validate.ts';
import { createSupabaseServer } from '@/lib/supabase/server.ts';

const enc = encodeURIComponent;
const UUID = /^[0-9a-f-]{36}$/i;

function logError(where: string, e: unknown) {
  console.error(`[시환로그 관리자] ${where}:`, e instanceof Error ? e.message : (e as { message?: string })?.message ?? '알 수 없는 오류');
}

export async function signIn(fd: FormData) {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect('/admin/login?e=config');
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) redirect('/admin/login?e=invalid');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/admin/login?e=invalid');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    redirect('/admin/login?e=forbidden');
  }
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase?.auth.signOut();
  redirect('/admin/login?e=signed_out');
}

export async function savePlace(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const back = id ? `/admin/places/${id}` : '/admin/places/new';
  if (id && !UUID.test(id)) redirect('/admin?err=' + enc('잘못된 요청이에요.'));
  const parsed = parsePlaceForm(fd);
  if (!parsed.ok) redirect(`${back}?err=${enc(parsed.error)}`);
  const { place, region } = parsed.value;

  const { data: reg, error: regErr } = await supabase
    .from('regions').upsert(region, { onConflict: 'sido,sigungu' }).select('id').single();
  if (regErr) { logError('지역 저장', regErr); redirect(`${back}?err=${enc('지역 저장에 실패했어요. 0003 마이그레이션을 실행했는지 확인하세요.')}`); }

  const row = { ...place, region_id: reg.id, updated_at: new Date().toISOString() };
  const res = id
    ? await supabase.from('places').update(row).eq('id', id).select('id').single()
    : await supabase.from('places').insert(row).select('id').single();
  if (res.error) {
    logError('장소 저장', res.error);
    const msg = res.error.code === '23505' ? '같은 주소용 이름(slug)이 이미 있어요.' : '장소 저장에 실패했어요.';
    redirect(`${back}?err=${enc(msg)}`);
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/places/${res.data.id}?msg=${enc('저장했어요.')}`);
}

export async function saveFacts(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/admin?err=' + enc('잘못된 요청이에요.'));
  const back = `/admin/places/${id}`;
  const parsed = parseFactsForm(fd);
  if (!parsed.ok) redirect(`${back}?err=${enc(parsed.error)}#facts`);
  const { upserts, deletes } = parsed.value;

  if (upserts.length) {
    const { error } = await supabase.from('place_facts').upsert(upserts.map((u) => ({ ...u, place_id: id })), { onConflict: 'place_id,field' });
    if (error) { logError('항목 저장', error); redirect(`${back}?err=${enc('항목 저장에 실패했어요.')}#facts`); }
  }
  if (deletes.length) {
    const { error } = await supabase.from('place_facts').delete().eq('place_id', id).in('field', deletes);
    if (error) { logError('항목 삭제', error); redirect(`${back}?err=${enc('비운 항목 삭제에 실패했어요.')}#facts`); }
  }
  await supabase.from('places').update({ updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/', 'layout');
  redirect(`${back}?msg=${enc('항목 정보를 저장했어요.')}#facts`);
}

export async function deletePlace(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/admin?err=' + enc('잘못된 요청이에요.'));
  if (fd.get('confirm') !== 'on') redirect(`/admin/places/${id}?err=${enc('삭제 확인에 체크해 주세요.')}`);
  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) { logError('장소 삭제', error); redirect(`/admin/places/${id}?err=${enc('삭제에 실패했어요.')}`); }
  revalidatePath('/', 'layout');
  redirect(`/admin?msg=${enc('장소를 삭제했어요.')}`);
}

function checkMessage(r: Awaited<ReturnType<typeof runAndRecordCheck>>) {
  if (!r.ok) return { err: '이미 점검이 실행 중이에요. 잠시 후 다시 시도하세요.' };
  return { msg: `점검 완료: ${r.total}곳 중 성공 ${r.okCount}, 실패 ${r.failed}, 새 변경 후보 ${r.created}건` };
}

/** 장소 1곳의 공식 홈페이지를 지금 확인 → 달라진 값은 '변경 검토'로 */
export async function checkPlace(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/admin?err=' + enc('잘못된 요청이에요.'));
  let q: { msg?: string; err?: string };
  try {
    q = checkMessage(await runAndRecordCheck(supabase, 'manual', { placeId: id, delayMs: 0 }));
  } catch (e) {
    logError('공식 홈페이지 확인', e);
    q = { err: '확인 중 오류가 났어요.' };
  }
  redirect(`/admin/places/${id}?${q.err ? 'err=' + enc(q.err) : 'msg=' + enc(q.msg!)}`);
}

/** 전체 장소 수동 점검 (주간 자동 점검과 같은 동작) */
export async function runAllChecks() {
  const { supabase } = await requireAdmin();
  let q: { msg?: string; err?: string };
  try {
    q = checkMessage(await runAndRecordCheck(supabase, 'manual', { delayMs: 1000 }));
  } catch (e) {
    logError('전체 점검', e);
    q = { err: '점검 중 오류가 났어요.' };
  }
  revalidatePath('/admin');
  redirect(`/admin?${q.err ? 'err=' + enc(q.err) : 'msg=' + enc(q.msg!)}`);
}

const DECIDE_ERRORS: Record<string, string> = {
  not_admin: '관리자 권한이 없어요.',
  not_found: '후보를 찾을 수 없어요.',
  not_pending: '이미 처리된 후보예요.',
  conflict: '후보가 만들어진 뒤 공개 값이 바뀌었어요. 현재 값을 확인한 뒤 거절하고 다시 점검하세요.',
  reason_required: '거절 사유를 입력하세요.',
  edit_required: '확신이 낮은 후보예요. 값을 확인해 "수정 후 승인"을 사용하세요.',
  value_required: '승인할 값을 입력하세요.',
};

export async function decideCandidate(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!UUID.test(id) || !['approve', 'approve_with_edit', 'reject', 'hold'].includes(action)) {
    redirect('/admin/review?err=' + enc('잘못된 요청이에요.'));
  }
  const { error } = await supabase.rpc('decide_candidate', {
    p_id: id,
    p_action: action,
    p_value: String(fd.get('value') ?? '').trim() || null,
    p_reason: String(fd.get('reason') ?? '').trim() || null,
  });
  if (error) {
    const known = Object.keys(DECIDE_ERRORS).find((k) => error.message.includes(k));
    if (!known) logError('후보 처리', error);
    redirect('/admin/review?err=' + enc(known ? DECIDE_ERRORS[known] : '처리에 실패했어요. 0003 마이그레이션을 실행했는지 확인하세요.'));
  }
  revalidatePath('/', 'layout');
  redirect('/admin/review?msg=' + enc('처리했어요.'));
}
