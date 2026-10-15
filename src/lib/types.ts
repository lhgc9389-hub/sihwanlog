// 시환로그 — 방문자 화면용 장소 데이터 형식
import type { VerifyStatus } from '../core/types.ts';

/** 확인 결과: 있음 / 없음 / 아직 확인 못 함. 확인 못 한 항목은 절대 '있음'으로 취급하지 않는다. */
export type Tri = 'yes' | 'no' | 'unknown';

export const FEATURE_LABELS = {
  freeEntry: '무료입장',
  discount: '할인',
  nursingRoom: '수유실',
  diaperStation: '기저귀 교환대',
  stroller: '유모차 편의',
  parking: '주차',
} as const;

export type FeatureKey = keyof typeof FEATURE_LABELS;
export const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

export const CATEGORY_LABELS = { indoor: '실내', outdoor: '야외', experience: '체험' } as const;
export type Category = keyof typeof CATEGORY_LABELS;

export const VERIFY_LABELS: Record<VerifyStatus, string> = {
  official_site: '공식 홈페이지 확인',
  official_inquiry: '공식 문의 확인',
  visited: '운영자 방문 확인',
  review_reference: '후기 참고',
  needs_check: '미확인',
  stale: '오래되어 재확인 필요',
};

/** 이 상태일 때만 '확인된 정보'로 취급한다 (필터 통과 대상) */
export const CONFIRMED_STATUSES: readonly VerifyStatus[] = ['official_site', 'official_inquiry', 'visited'];
export const isConfirmed = (s: VerifyStatus) => CONFIRMED_STATUSES.includes(s);

/** 항목 하나의 확인 상태·출처·확인일 */
export interface FactMeta {
  status: VerifyStatus;
  sourceUrl: string | null;
  verifiedAt: string | null; // YYYY-MM-DD
}

export type FactKey = 'hours' | 'closedDays' | FeatureKey;

export interface OutingPlace {
  id: string;
  name: string;
  /** true면 실제로 확인하지 않은 화면 확인용 예시 데이터 → 모든 화면에 '예시 데이터' 표시 */
  isSample: boolean;
  sido: string;
  sigungu: string;
  category: Category | null;
  summary: string;
  address: string | null;
  hours: string | null;
  closedDays: string | null;
  fees: { label: string; value: string; meta?: FactMeta }[];
  discounts: string[];
  features: Record<FeatureKey, Tri>;
  /** 편의시설 세부 설명 (예: 수유실 위치) */
  featureNotes: Partial<Record<FeatureKey, string>>;
  recommendedAge: string | null;
  tips: string[];
  officialUrl: string | null;
  /** 장소 정보를 확인한 대표 출처 URL (공식 홈페이지, 공공데이터 등) */
  sourceUrl?: string | null;
  /** URL이 없는 출처 설명 (예: 한국관광공사 TourAPI) */
  sourceLabel?: string;
  /** 항목별 확인 상태 (DB에서 온 장소만 있음) */
  factMeta?: Partial<Record<FactKey, FactMeta>>;
  verifyStatus: VerifyStatus;
  /** 마지막 확인일 (YYYY-MM-DD). 확인한 적 없으면 null */
  lastCheckedAt: string | null;
  /** 사진 대신 쓰는 아이콘 (가짜 사진은 쓰지 않음) */
  emoji: string;
}
