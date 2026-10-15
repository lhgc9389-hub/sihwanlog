// 시환로그 — 검색은 제가 합니다!
export const FIELD_LABELS = {
  adult_fee: '성인 입장료',
  child_fee: '아동 입장료',
  infant_free: '영유아 무료입장',
  opening_hours: '운영시간',
  closed_days: '휴무일',
  nursing_room: '수유실',
  diaper_station: '기저귀 교환대',
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;

/** 가격·무료입장은 이용자에게 중요 → 항상 관리자 검토 필수 (자동 승인 없음) */
export const CRITICAL_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'adult_fee',
  'child_fee',
  'infant_free',
]);

/** 정보 확인 상태 (요구사항 6가지) */
export type VerifyStatus =
  | 'official_site'      // 1. 공식 홈페이지에서 확인
  | 'official_inquiry'   // 2. 공식 기관에 문의해 확인
  | 'visited'            // 3. 운영자가 직접 방문해 확인
  | 'review_reference'   // 4. 신뢰할 수 있는 후기에서 참고
  | 'needs_check'        // 5. 확인 필요
  | 'stale';             // 6. 오래되어 재확인 필요

export type Confidence = 'high' | 'low';

export interface Extracted {
  field: FieldKey;
  value: string;
  confidence: Confidence;
  evidence: string; // 근거가 된 원문 일부
}

export type PublicData = Partial<Record<FieldKey, string | null>>;

export interface Place {
  id: string;
  name: string;
  officialUrl: string | null;
  isTestData?: boolean;
  publicData: PublicData;
}

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'on_hold';

export interface Candidate {
  id: string;
  placeId: string;
  field: FieldKey;
  oldValue: string | null;
  newValue: string;
  confidence: Confidence;
  evidence: string;
  sourceUrl: string;
  checkedAt: string;
  critical: boolean;
  status: CandidateStatus;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
}

export type FetchFailKind =
  | 'invalid_url' | 'blocked_private' | 'timeout' | 'network'
  | 'http_error' | 'blocked_by_site' | 'not_html' | 'too_large';

export type FetchResult =
  | { ok: true; html: string; finalUrl: string; fetchedAt: string }
  | { ok: false; kind: FetchFailKind; detail: string };
