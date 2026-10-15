import Link from 'next/link';
import { notFound } from 'next/navigation';
import { checkPlace, deletePlace, saveFacts } from '../../../actions';
import { PlaceForm } from '@/components/admin/PlaceForm';
import { Card, Flash, btnGhost, btnPrimary, inputCls } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth.ts';
import { FACT_FIELDS, VERIFY_KEYS } from '@/lib/admin/validate.ts';
import { toKstDate } from '@/lib/place-mapping.ts';
import { VERIFY_LABELS } from '@/lib/types.ts';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> };

interface FactRow { field: string; value: string | null; status: string; source_url: string | null; verified_at: string | null }

export default async function EditPlacePage({ params, searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { msg, err } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: p } = await supabase
    .from('places')
    .select('*, regions(sido,sigungu), place_facts(field,value,status,source_url,verified_at)')
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();
  const facts = new Map((p.place_facts as FactRow[]).map((f) => [f.field, f]));
  const region = p.regions as { sido: string; sigungu: string } | null;
  const { count: pending } = await supabase
    .from('change_candidates').select('id', { count: 'exact', head: true }).eq('place_id', id).in('status', ['pending', 'on_hold']);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{p.name}</h1>
        {p.is_published && (
          <Link href={`/places/${p.slug}`} className="text-sm text-coral-dark underline underline-offset-4">방문자 화면 보기 ↗</Link>
        )}
      </div>
      <Flash msg={msg} err={err} />

      <PlaceForm
        v={{
          id: p.id, slug: p.slug, name: p.name, sido: region?.sido, sigungu: region?.sigungu, address: p.address,
          category: p.category, description: p.description, official_url: p.official_url, source_url: p.source_url,
          recommended_age: p.recommended_age, verify_status: p.verify_status, last_checked_at: toKstDate(p.last_checked_at),
          is_published: p.is_published, is_test_data: p.is_test_data,
        }}
      />

      <Card title="공식 홈페이지에서 확인">
        <p className="text-sm text-ink-soft">
          공식 URL의 페이지를 읽어 요금·운영시간·휴무일·영유아 무료·수유실·기저귀 교환대 언급을 찾아요. 찾은 값은 바로 반영되지 않고 변경 후보로
          저장돼요. (자바스크립트로 그려지는 페이지·PDF·접근 차단 사이트는 읽지 못해요 → 직접 확인 후 아래 항목에 입력)
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.official_url ? (
            <form action={checkPlace}>
              <input type="hidden" name="id" value={p.id} />
              <button className={btnPrimary}>공식 홈페이지에서 확인</button>
            </form>
          ) : (
            <p className="text-sm text-rose-800">공식 홈페이지 URL을 먼저 저장하세요.</p>
          )}
          <Link href="/admin/review" className={btnGhost}>변경 검토 ({pending ?? 0}건)</Link>
        </div>
      </Card>

      <Card title="항목별 정보 · 출처 · 확인일" id="facts">
        <p className="mb-4 text-sm text-ink-soft">
          값을 비우면 &lsquo;미확인&rsquo;으로 표시돼요. 공식 홈페이지 확인·공식 문의 확인·운영자 방문 확인 상태는 출처 URL과 확인일이 있어야 저장되고,
          이때만 방문자 필터에 &lsquo;있음&rsquo;으로 잡혀요. 편의시설은 &lsquo;있음&rsquo; 또는 &lsquo;없음&rsquo;으로 시작하세요.
        </p>
        <form action={saveFacts} className="grid gap-3">
          <input type="hidden" name="id" value={p.id} />
          {FACT_FIELDS.map((f) => {
            const cur = facts.get(f.field);
            return (
              <fieldset key={f.field} className="grid gap-2 rounded-xl bg-cream p-3 sm:grid-cols-[1.4fr_1fr_1.2fr_0.9fr]">
                <legend className="sr-only">{f.label}</legend>
                <label className="min-w-0">
                  <span className="mb-1 block text-sm font-semibold">{f.label}</span>
                  {f.kind === 'multiline' ? (
                    <textarea name={`${f.field}.value`} rows={2} defaultValue={cur?.value ?? ''} placeholder={f.hint} className={`${inputCls} h-auto py-2`} />
                  ) : (
                    <input name={`${f.field}.value`} defaultValue={cur?.value ?? ''} placeholder={f.hint} className={inputCls} />
                  )}
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-ink-soft">검증 상태</span>
                  <select name={`${f.field}.status`} defaultValue={cur?.status ?? 'needs_check'} className={inputCls}>
                    {VERIFY_KEYS.map((k) => <option key={k} value={k}>{VERIFY_LABELS[k]}</option>)}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-ink-soft">출처 URL</span>
                  <input name={`${f.field}.source_url`} type="url" defaultValue={cur?.source_url ?? ''} className={inputCls} />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-ink-soft">확인일</span>
                  <input name={`${f.field}.verified_at`} type="date" defaultValue={toKstDate(cur?.verified_at ?? null) ?? ''} className={inputCls} />
                </label>
              </fieldset>
            );
          })}
          <div>
            <button className={btnPrimary}>항목 정보 저장</button>
          </div>
        </form>
      </Card>

      <Card title="장소 삭제">
        <p className="text-sm text-ink-soft">
          삭제하면 이 장소의 항목 정보·변경 후보·이력이 함께 지워지고 되돌릴 수 없어요. 잠시 숨기려면 &lsquo;방문자에게 공개&rsquo;를 끄세요.
        </p>
        <form action={deletePlace} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" required className="h-5 w-5 accent-rose-600" /> 되돌릴 수 없음을 확인했어요
          </label>
          <button className="inline-flex h-11 items-center rounded-full bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700">삭제</button>
        </form>
      </Card>
    </div>
  );
}
