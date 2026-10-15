// Supabase(supabase/migrations) 행 → 화면용 OutingPlace 변환.
// 원칙: 확인 상태(official_site/official_inquiry/visited) + 확인일이 있는 값만 '확인된 정보'.
//      그 외 값은 화면에 '확인 필요' 등으로 표시하고, 편의시설 필터에서는 제외한다.
import type { VerifyStatus } from '../core/types.ts';
import { isConfirmed, type Category, type FactMeta, type FeatureKey, type OutingPlace, type Tri } from './types.ts';

/** 확인일이 이보다 오래되면 '오래되어 재확인 필요'로 표시 */
export const STALE_DAYS = 180;

export interface FactRow {
  field: string;
  value: string | null;
  status: VerifyStatus;
  source_url: string | null;
  verified_at: string | null;
}

export interface PlaceRow {
  slug: string;
  name: string;
  address: string | null;
  category: Category | null;
  description: string | null;
  official_url: string | null;
  source_url?: string | null;      // 0002 마이그레이션
  verify_status?: VerifyStatus;    // 0002 마이그레이션
  recommended_age: string | null;
  is_test_data: boolean;
  last_checked_at: string | null;
  regions: { sido: string; sigungu: string } | null;
  place_facts: FactRow[] | null;
}

/** place_facts.field 이름 (adult_fee 등은 src/core/types.ts FIELD_LABELS와 동일) */
const FEATURE_FIELDS: Record<FeatureKey, string> = {
  freeEntry: 'free_entry',
  discount: 'discount',
  nursingRoom: 'nursing_room',
  diaperStation: 'diaper_station',
  stroller: 'stroller',
  parking: 'parking',
};

const FEE_FIELDS = [
  ['adult_fee', '성인'],
  ['child_fee', '어린이'],
  ['infant_free', '영유아'],
] as const;

const CATEGORY_EMOJI: Record<Category, string> = { indoor: '🏛️', outdoor: '🌳', experience: '🎨' };

/** ISO 시각 → 한국 날짜 YYYY-MM-DD */
export function toKstDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** 저장된 상태를 화면용 상태로: 확인 상태라도 확인일이 없으면 '확인 필요', 오래됐으면 '재확인 필요' */
export function effectiveStatus(status: VerifyStatus, verifiedAt: string | null, now: Date): VerifyStatus {
  if (!isConfirmed(status)) return status;
  if (!verifiedAt) return 'needs_check';
  const t = new Date(verifiedAt).getTime();
  if (Number.isNaN(t)) return 'needs_check';
  return now.getTime() - t > STALE_DAYS * 86_400_000 ? 'stale' : status;
}

/** '있음(1층)', '있음: 다둥이 30%', '없음' 형식 해석. 그 밖의 값(예: '홈페이지에 언급됨: …')은 판단하지 않음 */
export function parseTri(value: string | null): { tri: Tri; note: string | null } {
  const v = (value ?? '').trim();
  const m = v.match(/^(있음|없음)\s*[:：(\-–]?\s*(.*?)\)?\s*$/);
  if (!m) return { tri: 'unknown', note: v || null };
  return { tri: m[1] === '있음' ? 'yes' : 'no', note: m[2] || null };
}

const formatFee = (v: string) => (/^\d+$/.test(v) ? `${Number(v).toLocaleString('ko-KR')}원` : v);

export function rowToOutingPlace(row: PlaceRow, now: Date = new Date()): OutingPlace {
  const facts = new Map((row.place_facts ?? []).map((f) => [f.field, f]));
  const metaOf = (f: FactRow): FactMeta => ({
    status: effectiveStatus(f.status, f.verified_at, now),
    sourceUrl: f.source_url,
    verifiedAt: toKstDate(f.verified_at),
  });
  const factMeta: OutingPlace['factMeta'] = {};

  const text = (field: string, key: 'hours' | 'closedDays') => {
    const f = facts.get(field);
    if (!f?.value) return null;
    factMeta[key] = metaOf(f);
    return f.value;
  };

  const features = {} as Record<FeatureKey, Tri>;
  const featureNotes: OutingPlace['featureNotes'] = {};
  let discounts: string[] = [];
  for (const [key, field] of Object.entries(FEATURE_FIELDS) as [FeatureKey, string][]) {
    const f = facts.get(field);
    if (!f) { features[key] = 'unknown'; continue; }
    const meta = metaOf(f);
    factMeta[key] = meta;
    const { tri, note } = parseTri(f.value);
    // 확인되지 않은 '있음/없음'은 사실로 쓰지 않는다
    features[key] = isConfirmed(meta.status) ? tri : 'unknown';
    if (note) {
      if (key === 'discount' && features[key] === 'yes') discounts = [note];
      else featureNotes[key] = note;
    }
  }

  const fees: OutingPlace['fees'] = [];
  for (const [field, label] of FEE_FIELDS) {
    const f = facts.get(field);
    if (f?.value) fees.push({ label, value: formatFee(f.value), meta: metaOf(f) });
  }

  const tips = (facts.get('visit_tips')?.value ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

  return {
    id: row.slug,
    name: row.name,
    isSample: row.is_test_data,
    sido: row.regions?.sido ?? '지역 미정',
    sigungu: row.regions?.sigungu ?? '',
    category: row.category,
    summary: row.description ?? '',
    address: row.address,
    hours: text('opening_hours', 'hours'),
    closedDays: text('closed_days', 'closedDays'),
    fees,
    discounts,
    features,
    featureNotes,
    recommendedAge: row.recommended_age,
    tips,
    officialUrl: row.official_url,
    sourceUrl: row.source_url ?? null,
    factMeta,
    verifyStatus: effectiveStatus(row.verify_status ?? 'needs_check', row.last_checked_at, now),
    lastCheckedAt: toKstDate(row.last_checked_at),
    emoji: row.category ? CATEGORY_EMOJI[row.category] : '📍',
  };
}
