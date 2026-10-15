import type { FeatureKey, OutingPlace } from './types.ts';

export interface SearchQuery {
  keyword?: string;
  sido?: string;    // '' 또는 undefined = 전체
  features?: FeatureKey[]; // 선택한 조건을 모두 만족(AND)
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 검색·필터. 편의시설은 'yes'로 확인된 장소만 통과한다 (확인 필요/없음은 제외). */
export function searchPlaces(places: OutingPlace[], q: SearchQuery): OutingPlace[] {
  const kw = norm(q.keyword ?? '');
  const features = q.features ?? [];
  return places.filter((p) => {
    if (q.sido && p.sido !== q.sido) return false;
    if (kw) {
      const hay = norm([p.name, p.sido, p.sigungu, p.address ?? '', p.summary].join(' '));
      if (!hay.includes(kw)) return false;
    }
    return features.every((f) => p.features[f] === 'yes');
  });
}

/** 데이터에 실제로 있는 시·도만 목록으로 (가나다순) */
export function listSido(places: OutingPlace[]): string[] {
  return [...new Set(places.map((p) => p.sido))].sort((a, b) => a.localeCompare(b, 'ko'));
}
