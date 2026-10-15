import { decideCandidate } from '../../actions';
import { Card, Flash, btnGhost, btnPrimary, inputCls } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth.ts';
import { FIELD_LABELS, type FieldKey } from '@/core/types.ts';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { supabase } = await requireAdmin();
  const { msg, err } = await searchParams;
  const { data, error } = await supabase
    .from('change_candidates')
    .select('id,field,old_value,new_value,confidence,evidence,source_url,checked_at,critical,status,reason,places(name)')
    .in('status', ['pending', 'on_hold'])
    .order('created_at', { ascending: true })
    .limit(100);
  const list = data ?? [];

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">변경 검토</h1>
      <p className="text-sm text-ink-soft">
        공식 홈페이지 점검에서 달라진 값이에요. 승인해야만 방문자 화면에 반영돼요. 가격·무료입장은 항상 직접 확인하세요. 확신이 낮은 값은 내용을 확인해
        &lsquo;수정 후 승인&rsquo;만 할 수 있어요. 편의시설은 &lsquo;있음(1층)&rsquo;처럼 고쳐서 승인하세요.
      </p>
      <Flash msg={msg} err={err ?? (error ? '후보를 불러오지 못했어요.' : undefined)} />
      {list.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-ink-soft">검토할 후보가 없어요.</p>}
      {list.map((c) => {
        const safeSource = /^https?:\/\//i.test(c.source_url) ? c.source_url : null;
        return (
          <Card key={c.id} title={`${(c.places as unknown as { name: string } | null)?.name ?? '?'} · ${FIELD_LABELS[c.field as FieldKey] ?? c.field}`}>
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {c.critical && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-800">가격·무료입장 (중요)</span>}
              <span className={`rounded-full px-2 py-0.5 ${c.confidence === 'high' ? 'bg-sage-light text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                확신 {c.confidence === 'high' ? '높음' : '낮음'}
              </span>
              {c.status === 'on_hold' && <span className="rounded-full bg-stone-100 px-2 py-0.5">보류됨{c.reason ? `: ${c.reason}` : ''}</span>}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-cream p-3"><dt className="text-ink-soft">현재 공개 값</dt><dd className="font-semibold">{c.old_value ?? '(없음)'}</dd></div>
              <div className="rounded-xl bg-peach/40 p-3"><dt className="text-ink-soft">새로 찾은 값</dt><dd className="font-semibold">{c.new_value}</dd></div>
              <div className="sm:col-span-2 break-words"><dt className="text-ink-soft">근거 문장</dt><dd>{c.evidence || '-'}</dd></div>
              <div className="sm:col-span-2 break-all">
                <dt className="text-ink-soft">출처 · 확인 시각</dt>
                <dd>
                  {safeSource ? <a href={safeSource} target="_blank" rel="noopener noreferrer" className="text-coral-dark underline">{safeSource}</a> : c.source_url}
                  {' · '}{new Date(c.checked_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3">
              {c.confidence === 'high' && (
                <form action={decideCandidate}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="action" value="approve" />
                  <button className={btnPrimary}>그대로 승인</button>
                </form>
              )}
              <form action={decideCandidate} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="action" value="approve_with_edit" />
                <input name="value" required defaultValue={c.confidence === 'high' ? c.new_value : ''} placeholder="확인한 값 입력" className={inputCls} />
                <button className={`${btnGhost} shrink-0`}>수정 후 승인</button>
              </form>
              <form action={decideCandidate} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={c.id} />
                <input name="reason" placeholder="사유 (거절 시 필수)" className={inputCls} />
                <button name="action" value="reject" className={`${btnGhost} shrink-0`}>거절</button>
                <button name="action" value="hold" className={`${btnGhost} shrink-0`}>보류</button>
              </form>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
