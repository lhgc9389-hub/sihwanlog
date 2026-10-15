// 공식 홈페이지 점검 실행 + 결과를 DB에 기록. 점검 로직은 src/core를 그대로 재사용한다.
// - 공개 정보(place_facts)는 절대 바꾸지 않고 change_candidates(변경 후보)에만 저장 → 관리자 검토 후 반영
// - 실행 기록: check_runs / check_results (접속 실패·추출 실패·URL 없음 구분)
// - 중복 실행 방지: check_runs_single_active 고유 인덱스(DB) + core의 프로세스 내 잠금
import type { SupabaseClient } from '@supabase/supabase-js';
import { FIELD_LABELS, type Candidate, type FieldKey, type Place } from '../../core/types.ts';
import { ReviewStore, runWeeklyCheck } from '../../core/workflow.ts';

const CORE_FIELDS = new Set(Object.keys(FIELD_LABELS));

export interface CheckPlaceRow {
  id: string;
  name: string;
  official_url: string | null;
  is_test_data: boolean;
  place_facts: { field: string; value: string | null }[] | null;
}

/** DB 행 → core Place (core가 다루는 항목만 비교 대상) */
export function toCorePlace(r: CheckPlaceRow): Place {
  const publicData: Place['publicData'] = {};
  for (const f of r.place_facts ?? []) if (CORE_FIELDS.has(f.field)) publicData[f.field as FieldKey] = f.value;
  return { id: r.id, name: r.name, officialUrl: r.official_url, isTestData: r.is_test_data, publicData };
}

export function candidateToRow(c: Candidate) {
  return {
    id: c.id, place_id: c.placeId, field: c.field, old_value: c.oldValue, new_value: c.newValue,
    confidence: c.confidence, evidence: c.evidence.slice(0, 300), source_url: c.sourceUrl,
    checked_at: c.checkedAt, critical: c.critical, status: 'pending' as const,
  };
}

export type CheckRunResult =
  | { ok: true; runId: string; total: number; okCount: number; failed: number; created: number }
  | { ok: false; reason: 'already_running' };

const STALE_LOCK_MS = 30 * 60_000;

export async function runAndRecordCheck(
  db: SupabaseClient,
  trigger: 'schedule' | 'manual',
  opts: { placeId?: string; delayMs?: number } = {},
): Promise<CheckRunResult> {
  // 비정상 종료로 30분 넘게 '진행 중'인 실행은 종료 처리 (잠금 해제)
  await db.from('check_runs').update({ finished_at: new Date().toISOString() })
    .is('finished_at', null).lt('started_at', new Date(Date.now() - STALE_LOCK_MS).toISOString());

  const { data: run, error: runErr } = await db.from('check_runs').insert({ trigger }).select('id').single();
  if (runErr) {
    if (runErr.code === '23505') return { ok: false, reason: 'already_running' };
    throw new Error(`실행 기록 생성 실패: ${runErr.message}`);
  }

  try {
    let q = db.from('places').select('id,name,official_url,is_test_data,place_facts(field,value)');
    if (opts.placeId) q = q.eq('id', opts.placeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(`장소 조회 실패: ${error.message}`);

    const store = new ReviewStore((rows as CheckPlaceRow[]).map(toCorePlace));
    store.newId = () => crypto.randomUUID();

    // 이미 대기 중인 후보를 먼저 넣어 core의 중복 방지 규칙이 그대로 적용되게 한다
    const { data: pending, error: pErr } = await db.from('change_candidates').select('id,place_id,field,new_value').eq('status', 'pending');
    if (pErr) throw new Error(`대기 후보 조회 실패: ${pErr.message}`);
    const existing = new Set<string>();
    store.addCandidates((pending ?? []).map((p) => {
      existing.add(p.id);
      return { id: p.id, placeId: p.place_id, field: p.field, newValue: p.new_value, status: 'pending' } as Candidate;
    }));

    const summary = await runWeeklyCheck(store, { delayMs: opts.delayMs ?? 2000 });

    let created = 0;
    for (const c of store.candidates.values()) {
      if (existing.has(c.id)) continue;
      const { error: insErr } = await db.from('change_candidates').insert(candidateToRow(c));
      if (!insErr) created++;
      else if (insErr.code !== '23505') throw new Error(`후보 저장 실패: ${insErr.message}`);
    }

    if (summary.outcomes.length) {
      const { error: rErr } = await db.from('check_results').insert(summary.outcomes.map((o) => ({
        run_id: run.id,
        place_id: o.placeId,
        outcome: o.status,
        fail_kind: o.status === 'fetch_failed' ? o.kind : null,
        detail: 'detail' in o ? o.detail.slice(0, 300) : o.status === 'ok' ? `새 변경 후보 ${o.candidates}건` : null,
      })));
      if (rErr) throw new Error(`점검 결과 저장 실패: ${rErr.message}`);
    }

    const okCount = summary.outcomes.filter((o) => o.status === 'ok').length;
    await db.from('check_runs').update({
      finished_at: new Date().toISOString(), places_total: summary.outcomes.length,
      places_ok: okCount, places_failed: summary.failed, candidates_created: created,
    }).eq('id', run.id);

    return { ok: true, runId: run.id, total: summary.outcomes.length, okCount, failed: summary.failed, created };
  } catch (e) {
    await db.from('check_runs').update({ finished_at: new Date().toISOString() }).eq('id', run.id);
    throw e;
  }
}
