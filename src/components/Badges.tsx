import type { VerifyStatus } from '@/core/types.ts';
import { FEATURE_LABELS, VERIFY_LABELS, type FeatureKey, type Tri } from '@/lib/types.ts';

export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
      예시 데이터
    </span>
  );
}

const VERIFY_STYLE: Record<VerifyStatus, string> = {
  official_site: 'bg-sage-light text-emerald-800',
  official_inquiry: 'bg-sage-light text-emerald-800',
  visited: 'bg-sage-light text-emerald-800',
  review_reference: 'bg-sky-50 text-sky-800',
  needs_check: 'bg-stone-100 text-stone-700',
  stale: 'bg-rose-50 text-rose-800',
};

export function VerifyBadge({ status }: { status: VerifyStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${VERIFY_STYLE[status]}`}>
      {VERIFY_LABELS[status]}
    </span>
  );
}

const TRI_TEXT: Record<Tri, string> = { yes: '있음', no: '없음', unknown: '미확인' };

/** 편의시설 표시. 무료입장·할인은 '있음/없음' 대신 자연스러운 말로 바꾼다. */
export function triText(key: FeatureKey, v: Tri): string {
  if (v === 'unknown') return '미확인';
  if (key === 'freeEntry') return v === 'yes' ? '무료입장 대상 있음' : '무료입장 없음';
  if (key === 'discount') return v === 'yes' ? '할인 있음' : '할인 없음';
  return TRI_TEXT[v];
}

export function FeatureChip({ k, v }: { k: FeatureKey; v: Tri }) {
  if (v !== 'yes') return null; // 카드에는 확인된 '있음'만 노출
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-peach/50 px-2 py-0.5 text-xs font-medium text-ink">
      ✓ {FEATURE_LABELS[k]}
    </span>
  );
}
