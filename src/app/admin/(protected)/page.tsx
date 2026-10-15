import Link from 'next/link';
import { runAllChecks } from '../actions';
import { VerifyBadge } from '@/components/Badges';
import { Card, Flash, btnGhost, btnPrimary, inputCls } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth.ts';
import { toKstDate } from '@/lib/place-mapping.ts';
import type { VerifyStatus } from '@/core/types.ts';

const OUTCOME: Record<string, string> = {
  ok: '성공', fetch_failed: '접속 실패', extract_failed: '추출 실패', skipped_no_url: 'URL 없음',
};

type Search = { q?: string; msg?: string; err?: string };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Search> }) {
  const { q = '', msg, err } = await searchParams;
  const { supabase } = await requireAdmin();

  let placesQuery = supabase
    .from('places')
    .select('id,slug,name,is_published,is_test_data,verify_status,last_checked_at,official_url,regions(sido,sigungu)')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (q) placesQuery = placesQuery.ilike('name', `%${q.replace(/[%_,()]/g, '')}%`);

  const [places, pending, runs, failures] = await Promise.all([
    placesQuery,
    supabase.from('change_candidates').select('id', { count: 'exact', head: true }).in('status', ['pending', 'on_hold']),
    supabase.from('check_runs').select('id,trigger,started_at,finished_at,places_total,places_ok,places_failed,candidates_created').order('started_at', { ascending: false }).limit(5),
    supabase.from('check_results').select('outcome,fail_kind,detail,created_at,places(name)').neq('outcome', 'ok').order('created_at', { ascending: false }).limit(10),
  ]);
  const rows = places.data ?? [];

  return (
    <div className="grid gap-4">
      <Flash msg={msg} err={err ?? (places.error ? '장소 목록을 불러오지 못했어요.' : undefined)} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="등록 장소" value={`${rows.length}${rows.length === 100 ? '+' : ''}곳`} />
        <Stat label="공개 중" value={`${rows.filter((r) => r.is_published).length}곳`} />
        <Link href="/admin/review" className="rounded-2xl border border-sand bg-white p-4 hover:border-coral">
          <p className="text-sm text-ink-soft">검토 대기 변경 후보</p>
          <p className="mt-1 text-2xl font-extrabold text-coral-dark">{pending.count ?? 0}건 →</p>
        </Link>
      </div>

      <Card title="장소 목록">
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q} placeholder="장소 이름 검색" className={inputCls} />
          <button className={btnGhost}>검색</button>
          <Link href="/admin/places/new" className={`${btnPrimary} shrink-0`}>+ 추가</Link>
        </form>
        {rows.length === 0 ? (
          <p className="text-ink-soft">등록된 장소가 없어요. 공식 홈페이지에서 확인한 장소를 추가하세요.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {rows.map((p) => {
              const region = p.regions as unknown as { sido: string; sigungu: string } | null;
              return (
                <li key={p.id}>
                  <Link href={`/admin/places/${p.id}`} className="flex flex-col gap-1 py-3 hover:bg-cream sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="ml-2 text-sm text-ink-soft">{region ? `${region.sido} ${region.sigungu}` : '지역 미정'}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      {p.is_test_data && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">테스트</span>}
                      <span className={`rounded-full px-2 py-0.5 ${p.is_published ? 'bg-sage-light text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                        {p.is_published ? '공개' : '비공개'}
                      </span>
                      <VerifyBadge status={p.verify_status as VerifyStatus} />
                      {!p.official_url && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-800">공식 URL 없음</span>}
                      <span className="text-ink-soft">확인일 {toKstDate(p.last_checked_at) ?? '없음'}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="공식 홈페이지 점검">
        <p className="text-sm text-ink-soft">
          공식 URL이 있는 모든 장소의 홈페이지를 읽어 요금·운영시간 등이 달라졌는지 확인해요. 달라진 값은 바로 반영되지 않고 &lsquo;변경 검토&rsquo;에 쌓여요.
          장소 수에 따라 몇 분 걸릴 수 있어요.
        </p>
        <form action={runAllChecks} className="mt-3">
          <button className={btnPrimary}>지금 전체 점검 실행</button>
        </form>
        <h3 className="mt-6 font-bold">최근 실행 기록</h3>
        {(runs.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">아직 실행 기록이 없어요. (자동 점검은 배포 후 Vercel Cron 설정이 있어야 실행돼요)</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {runs.data!.map((r) => (
              <li key={r.id} className="rounded-lg bg-cream px-3 py-2">
                {new Date(r.started_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {r.trigger === 'schedule' ? '자동' : '수동'} ·{' '}
                {r.finished_at ? `${r.places_total}곳 중 성공 ${r.places_ok} / 실패 ${r.places_failed} / 새 후보 ${r.candidates_created}` : '진행 중'}
              </li>
            ))}
          </ul>
        )}
        {(failures.data ?? []).length > 0 && (
          <>
            <h3 className="mt-6 font-bold">최근 확인 실패 (직접 확인 필요)</h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {failures.data!.map((f, i) => (
                <li key={i} className="rounded-lg bg-rose-50 px-3 py-2 text-rose-900">
                  {(f.places as unknown as { name: string } | null)?.name ?? '삭제된 장소'} · {OUTCOME[f.outcome] ?? f.outcome}
                  {f.fail_kind ? ` (${f.fail_kind})` : ''} {f.detail ? `· ${f.detail}` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sand bg-white p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
