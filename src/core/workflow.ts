import { CRITICAL_FIELDS, type Candidate, type Extracted, type FieldKey, type Place, type PublicData } from './types.ts';
import { extractFields } from './extract.ts';
import { fetchOfficialPage, type FetchOptions } from './fetcher.ts';

/** 현재 공개 값과 추출값을 비교해 "달라진 것만" 변경 후보로 만든다. 공개 데이터는 건드리지 않는다. */
export function diffToCandidates(
  place: Place, extracted: Extracted[], sourceUrl: string, checkedAt: string, newId: () => string,
): Candidate[] {
  const out: Candidate[] = [];
  for (const e of extracted) {
    const cur = place.publicData[e.field] ?? null;
    if (cur === e.value) continue;
    out.push({
      id: newId(), placeId: place.id, field: e.field, oldValue: cur, newValue: e.value,
      confidence: e.confidence, evidence: e.evidence, sourceUrl, checkedAt,
      critical: CRITICAL_FIELDS.has(e.field), status: 'pending',
    });
  }
  return out;
}

export class WorkflowError extends Error {
  constructor(public code: 'not_found' | 'not_pending' | 'conflict' | 'reason_required' | 'edit_required', msg: string) { super(msg); }
}

export interface HistoryEntry {
  at: string; admin: string; candidateId: string; placeId: string; field: FieldKey;
  action: 'approved' | 'approved_with_edit' | 'rejected' | 'on_hold';
  before: string | null; after: string | null; reason?: string;
}

/** DB 없이 규칙을 검증하기 위한 참조 구현. 실제 서비스에서는 같은 규칙을 Supabase 위에 구현한다. */
export class ReviewStore {
  places = new Map<string, Place>();
  candidates = new Map<string, Candidate>();
  history: HistoryEntry[] = [];
  private seq = 0;
  constructor(places: Place[], private now: () => string = () => new Date().toISOString()) {
    for (const p of places) this.places.set(p.id, structuredClone(p));
  }
  newId = () => `c${++this.seq}`;

  addCandidates(list: Candidate[]) {
    for (const c of list) {
      // 같은 장소·항목·값의 대기 후보가 이미 있으면 중복 생성 안 함
      const dup = [...this.candidates.values()].some(
        (x) => x.placeId === c.placeId && x.field === c.field && x.newValue === c.newValue && x.status === 'pending');
      if (!dup) this.candidates.set(c.id, c);
    }
  }
  pending() { return [...this.candidates.values()].filter((c) => c.status === 'pending'); }

  private get(id: string) {
    const c = this.candidates.get(id);
    if (!c) throw new WorkflowError('not_found', '후보를 찾을 수 없음');
    if (c.status !== 'pending' && c.status !== 'on_hold') throw new WorkflowError('not_pending', '이미 처리된 후보');
    return c;
  }
  private apply(c: Candidate, value: string) {
    const place = this.places.get(c.placeId)!;
    // 후보 생성 이후 공개 값이 바뀌었다면(다른 승인 등) 덮어쓰지 않고 충돌 처리
    if ((place.publicData[c.field] ?? null) !== c.oldValue) throw new WorkflowError('conflict', '후보 생성 후 공개 값이 바뀜 — 재확인 필요');
    place.publicData[c.field] = value;
  }
  private log(c: Candidate, admin: string, action: HistoryEntry['action'], after: string | null, reason?: string) {
    this.history.push({ at: this.now(), admin, candidateId: c.id, placeId: c.placeId, field: c.field, action, before: c.oldValue, after, reason });
    c.decidedBy = admin; c.decidedAt = this.now(); if (reason) c.reason = reason;
  }

  approve(id: string, admin: string) {
    const c = this.get(id);
    // 확신이 낮은 후보는 그대로 승인 불가 → 사람이 값을 확인·수정해야 함
    if (c.confidence === 'low') throw new WorkflowError('edit_required', '확신 낮음: 값을 확인해 "수정 후 승인"을 사용하세요');
    this.apply(c, c.newValue); c.status = 'approved'; this.log(c, admin, 'approved', c.newValue);
  }
  approveWithEdit(id: string, admin: string, editedValue: string) {
    const c = this.get(id);
    this.apply(c, editedValue); c.status = 'approved'; this.log(c, admin, 'approved_with_edit', editedValue);
  }
  reject(id: string, admin: string, reason: string) {
    const c = this.get(id);
    if (!reason.trim()) throw new WorkflowError('reason_required', '거절 사유 필수');
    c.status = 'rejected'; this.log(c, admin, 'rejected', c.oldValue, reason);
  }
  hold(id: string, admin: string, reason: string) {
    const c = this.get(id); c.status = 'on_hold'; this.log(c, admin, 'on_hold', c.oldValue, reason);
  }
}

// ───────────── 주간 확인 실행기 ─────────────
export type PlaceOutcome =
  | { placeId: string; status: 'skipped_no_url' }
  | { placeId: string; status: 'fetch_failed'; kind: string; detail: string }
  | { placeId: string; status: 'extract_failed'; detail: string }
  | { placeId: string; status: 'ok'; candidates: number; unchanged: boolean };

export interface RunSummary { startedAt: string; finishedAt: string; outcomes: PlaceOutcome[]; candidatesCreated: number; failed: number }

let running = false; // 단일 프로세스 중복 실행 방지 (실서비스는 DB 락 사용)

export async function runWeeklyCheck(
  store: ReviewStore,
  opts: { fetch?: FetchOptions; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<RunSummary> {
  if (running) throw new Error('이미 실행 중입니다 (중복 실행 방지)');
  running = true;
  const startedAt = new Date().toISOString();
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const outcomes: PlaceOutcome[] = [];
  let created = 0;
  try {
    for (const place of store.places.values()) {
      if (!place.officialUrl) { outcomes.push({ placeId: place.id, status: 'skipped_no_url' }); continue; }
      const res = await fetchOfficialPage(place.officialUrl, opts.fetch);
      if (!res.ok) {
        // 접속 실패 ≠ 추출 실패. 실패한 정보는 최신으로 취급하지 않고 공개 데이터는 그대로 둔다.
        outcomes.push({ placeId: place.id, status: 'fetch_failed', kind: res.kind, detail: res.detail });
      } else {
        const extracted = extractFields(res.html);
        if (extracted.length === 0) {
          outcomes.push({ placeId: place.id, status: 'extract_failed', detail: '읽을 수 있는 항목 없음 (JS 렌더링/구조 변경 가능성)' });
        } else {
          const cands = diffToCandidates(place, extracted, res.finalUrl, res.fetchedAt, store.newId);
          store.addCandidates(cands);
          created += cands.length;
          outcomes.push({ placeId: place.id, status: 'ok', candidates: cands.length, unchanged: cands.length === 0 });
        }
      }
      await sleep(opts.delayMs ?? 2000); // 요청 분산
    }
  } finally { running = false; }
  return { startedAt, finishedAt: new Date().toISOString(), outcomes, candidatesCreated: created,
    failed: outcomes.filter((o) => o.status === 'fetch_failed' || o.status === 'extract_failed').length };
}
