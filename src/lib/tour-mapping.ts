// 한국관광공사 관광정보 → 화면용 OutingPlace (아기 무료입장 기준, 수유실, 유모차, 주차 자동 추출 포함)
import type { TourDetail, TourItem } from './tour-api.ts';
import { FEATURE_KEYS, type Category, type FeatureKey, type OutingPlace, type Tri } from './types.ts';

const AREA_CODES: Record<string, string> = {
  '1': '서울특별시', '2': '인천광역시', '3': '대전광역시', '4': '대구광역시', '5': '광주광역시', '6': '부산광역시',
  '7': '울산광역시', '8': '세종특별자치시', '31': '경기도', '32': '강원특별자치도', '33': '충청북도', '34': '충청남도',
  '35': '경상북도', '36': '경상남도', '37': '전북특별자치도', '38': '전라남도', '39': '제주특별자치도',
};

const GYEONGGI_SIGUNGU: Record<string, string> = {
  '1': '가평군', '2': '고양시', '3': '과천시', '4': '광명시', '5': '광주시', '6': '구리시', '7': '군포시',
  '8': '김포시', '9': '남양주시', '10': '동두천시', '11': '부천시', '12': '성남시', '13': '수원시', '14': '시흥시',
  '15': '안산시', '16': '안성시', '17': '안양시', '18': '양주시', '19': '양평군', '20': '여주시', '21': '연천군',
  '22': '오산시', '23': '용인시', '24': '의왕시', '25': '의정부시', '26': '이천시', '27': '파주시', '28': '평택시',
  '29': '포천시', '30': '하남시', '31': '화성시',
};

export const TOUR_ID_PREFIX = 'tour-';

const fmtModified = (m: string | null) => (m && /^\d{8}/.test(m) ? `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}` : null);

function guessCategoryAndEmoji(title: string): { category: Category | null; emoji: string } {
  if (/(박물관|과학관|미술관|전시관|기념관|천문대|도서관|체험관)/.test(title)) return { category: 'museum', emoji: '🏛️' };
  if (/(동물원|아쿠아리움|수족관|목장|농장|주렁주렁|생태)/.test(title)) return { category: 'nature', emoji: '🦁' };
  if (/(수목원|식물원|휴양림|숲|정원|호수|공원)/.test(title)) return { category: 'park', emoji: '🌳' };
  if (/(테마파크|랜드|월드|민속촌|루지|워터파크|유원지)/.test(title)) return { category: 'theme', emoji: '🎠' };
  if (/(키즈|어린이|아기|유아|베이비|놀이터)/.test(title)) return { category: 'indoor', emoji: '🧸' };
  return { category: null, emoji: '📍' };
}

function parseFacilityTri(text: string | null | undefined): Tri {
  if (!text) return 'unknown';
  if (/^(없음|불가|미보유|해당없음|불가능)$/.test(text.trim())) return 'no';
  if (/(없음|불가|미보유)/.test(text) && !/(있음|가능|보유|대여|무료|유료)/.test(text)) return 'no';
  if (/(있음|가능|보유|대여|무료|유료|설치|구비|위치|층|실)/.test(text) || text.trim().length > 1) return 'yes';
  return 'unknown';
}

function extractFreeEntryInfo(useFee: string | null | undefined, overview: string | null | undefined, title: string): { tri: Tri; note?: string; ageCriteria?: string } {
  const combined = `${useFee ?? ''} ${overview ?? ''}`;
  // 1) 상세 요금에서 개월 수 기준 추출 (예: 36개월 미만 무료)
  const monthMatch = combined.match(/(\d{1,2}\s*개월\s*(?:미만|이하)\s*(?:무료|무임)?)/);
  if (monthMatch) {
    const criteria = monthMatch[1].includes('무료') ? monthMatch[1] : `${monthMatch[1]} 무료`;
    return { tri: 'yes', note: criteria, ageCriteria: criteria };
  }
  // 2) 만 나이/영유아 기준 추출
  const ageMatch = combined.match(/((?:만\s*\d+\s*세\s*(?:미만|이하)|영유아|미취학\s*아동|유아)\s*무료)/);
  if (ageMatch) {
    return { tri: 'yes', note: ageMatch[1], ageCriteria: ageMatch[1] };
  }
  // 3) 전체 무료입장인 경우
  if (useFee && /^(무료|무료입장|전액\s*무료)/.test(useFee.trim())) {
    return { tri: 'yes', note: '전 연령 무료입장', ageCriteria: '전 연령 무료입장' };
  }
  if (useFee && /무료/.test(useFee)) {
    return { tri: 'yes', note: useFee.slice(0, 60), ageCriteria: '36개월 미만 무료 (상세요금 확인)' };
  }
  // 4) 목록 화면(상세 조회 전)에서도 이름으로 무료입장 개월 수 기준을 스마트하게 분류
  if (/(호수공원|중앙공원|생태공원|수변공원|도립공원|시립공원|군립공원|문화공원|도서관|육아종합지원센터)/.test(title)) {
    return { tri: 'yes', note: '전 연령 무료입장 (일부 체험 별도)', ageCriteria: '전 연령 무료입장' };
  }
  if (/(어린이박물관|박물관|과학관|미술관|전시관|기념관|생태관|수목원|식물원|자연휴양림|민속촌|테마파크|동물원|아쿠아리움)/.test(title)) {
    return { tri: 'yes', note: '36개월 미만 무료 (기관별 증빙서류 지참)', ageCriteria: '36개월 미만 무료' };
  }
  return { tri: 'unknown' };
}

function extractDiscounts(useFee: string | null | undefined, parkingFee: string | null | undefined, overview: string | null | undefined, title: string): string[] {
  const combined = `${useFee ?? ''} ${parkingFee ?? ''} ${overview ?? ''}`;
  const list: string[] = [];
  if (/(다자녀|다둥이)/.test(combined)) list.push('다자녀(다둥이) 할인 혜택 확인 가능');
  if (/(경주시민|용인시민|파주시민|지역주민|도민|시민\s*할인|구민\s*할인|군민)/.test(combined)) list.push('지역민(시민/도민) 할인 혜택 있음');
  if (/(저공해|경차|친환경)/.test(combined)) list.push('저공해·경차 주차비 할인');
  if (/(할인|감면)/.test(combined) && list.length === 0) list.push('요금 감면·할인 대상 있음 (상세 요금표 참고)');
  if (list.length === 0 && /(박물관|과학관|수목원|휴양림|민속촌|테마파크)/.test(title)) {
    list.push('다자녀·지역민 할인 대상 여부 매표소 확인');
  }
  return list;
}

export function tourItemToOutingPlace(item: TourItem, detail?: TourDetail): OutingPlace {
  const [first, second] = (item.address ?? '').split(/\s+/);
  const fromAddress = first && /(시|도)$/.test(first);
  const sido = fromAddress ? first : (item.areaCode && AREA_CODES[item.areaCode]) || '경기도';
  const sigungu =
    (fromAddress && second && /(시|군|구)$/.test(second) ? second : '') ||
    (item.areaCode === '31' && item.sigunguCode ? GYEONGGI_SIGUNGU[item.sigunguCode] ?? '' : '');

  const modified = fmtModified(item.modifiedAt);
  const { category, emoji } = guessCategoryAndEmoji(item.title);

  const features: Record<FeatureKey, Tri> = Object.fromEntries(FEATURE_KEYS.map((k) => [k, 'unknown'])) as Record<FeatureKey, Tri>;
  const featureNotes: Partial<Record<FeatureKey, string>> = {};
  const fees: { label: string; value: string }[] = [];
  const tips: string[] = [];

  const freeInfo = extractFreeEntryInfo(detail?.useFee, detail?.overview, item.title);
  features.freeEntry = freeInfo.tri;
  if (freeInfo.note) featureNotes.freeEntry = freeInfo.note;

  if (freeInfo.ageCriteria) {
    fees.push({ label: '👶 아기 무료입장 기준', value: `${freeInfo.ageCriteria} (등본·가족관계증명서 등 증빙서류 지참 권장)` });
  }
  if (detail?.useFee) {
    fees.push({ label: '이용 요금 안내', value: detail.useFee });
  }
  if (detail?.parkingFee) {
    fees.push({ label: '주차 요금', value: detail.parkingFee });
  }

  if (detail?.lactationRoom) {
    features.nursingRoom = parseFacilityTri(detail.lactationRoom);
    featureNotes.nursingRoom = detail.lactationRoom;
  }

  const diaperText = [detail?.lactationRoom, detail?.infantsEtc].filter(Boolean).join(' / ');
  if (/(기저귀|수유실)/.test(diaperText)) {
    features.diaperStation = 'yes';
    featureNotes.diaperStation = detail?.infantsEtc ?? detail?.lactationRoom ?? '수유실 내 구비';
  }

  if (detail?.babyCarriage) {
    features.stroller = parseFacilityTri(detail.babyCarriage);
    featureNotes.stroller = detail.babyCarriage;
  }

  const parkingCombined = [detail?.parking, detail?.parkingFee].filter(Boolean).join(' · ');
  if (parkingCombined) {
    features.parking = parseFacilityTri(parkingCombined);
    featureNotes.parking = parkingCombined;
  }

  const discounts = extractDiscounts(detail?.useFee, detail?.parkingFee, detail?.overview, item.title);
  if (discounts.length > 0) {
    features.discount = 'yes';
    featureNotes.discount = discounts.join(', ');
  }

  if (detail?.babySpareChair) tips.push(`아기의자(유아용 보조의자): ${detail.babySpareChair}`);
  if (detail?.infantsEtc) tips.push(`영유아 동반 안내: ${detail.infantsEtc}`);
  if (freeInfo.ageCriteria) tips.push(`무료입장 혜택(${freeInfo.ageCriteria})을 받으려면 개월 수 확인용 서류(주민등록등본, 건강보험증, 정부24 앱 등)를 꼭 챙기세요.`);

  const summaryPrefix = freeInfo.ageCriteria ? `👶 [${freeInfo.ageCriteria}] · ` : '';

  return {
    id: `${TOUR_ID_PREFIX}${item.contentId}`,
    name: item.title,
    isSample: false,
    sido,
    sigungu,
    category,
    summary: `${summaryPrefix}${detail?.overview ?? `${sido} ${sigungu} 아기랑 나들이 장소 (${item.title})`}`,
    address: item.address,
    hours: detail?.hours ?? null,
    closedDays: detail?.closedDays ?? null,
    fees,
    discounts,
    features,
    featureNotes,
    recommendedAge: freeInfo.ageCriteria ? `영유아 동반 (${freeInfo.ageCriteria})` : '전 연령',
    tips,
    officialUrl: detail?.homepage ?? null,
    sourceUrl: detail?.homepage ?? null,
    sourceLabel: `한국관광공사 국문 관광정보(TourAPI) · 콘텐츠 ID ${item.contentId}${modified ? ` · 수정일 ${modified}` : ''}`,
    verifyStatus: 'needs_check',
    lastCheckedAt: modified,
    emoji,
  };
}