import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { SampleBadge } from '@/components/Badges';
import { SampleNotice } from '@/components/SampleNotice';
import { loadPlace } from '@/lib/place-source.ts';
import { CATEGORY_LABELS, type OutingPlace } from '@/lib/types.ts';

type Props = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

const getPlaceData = cache((id: string) => loadPlace(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { place } = await getPlaceData((await params).id);
  return { title: place ? place.name : '장소를 찾을 수 없어요' };
}

const safeHref = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

interface CuratedGuide {
  regionShort?: string;
  freeTip: string[];
  parkingTip: string[];
  goodPoints: string[];
  strollerTip: string;
  mealCourse: string;
  recommendFor: string;
}

const CURATED_DB: { match: RegExp; guide: CuratedGuide }[] = [
  {
    match: /국립중앙박물관.*어린이박물관|국립중앙박물관/,
    guide: {
      regionShort: '용산',
      freeTip: [
        '전 연령 무료 (0세부터 어른까지 100% 무료)',
        "[Tip] 어린이박물관은 100% 온라인 사전예약 필수(회차별 운영). 36개월 미만 아기도 인원에 포함해 '0원 예약' 필수.",
      ],
      parkingTip: [
        '✅ [지하주차장 실내 직결] 박물관 지하 대형 주차장 완비 (엘리베이터로 비 안 맞고 바로 진입 가능!)',
        '기본 2시간 2,000원 (이후 30분당 500원) · 서울 시내 박물관 중 주차 난이도 최하.',
      ],
      goodPoints: [
        '공간이 매우 넓고 쾌적하며, 영유아 감각놀이부터 옛 선조들의 생활 도구 체험까지 퀄리티가 국내 최고 수준입니다.',
        '날씨가 좋으면 야외 거울못과 용산가족공원으로 이어지는 야외 산책로를 걷기 좋습니다.',
      ],
      strollerTip: '전 층 엘리베이터 및 완만한 경사로로 유모차 주행 환경 최상급. 안내데스크 유모차 대여 및 대형 수유실 완비.',
      mealCourse: '박물관 내 푸드코트 또는 거울못식당 / 이촌역 인근 브런치·한식당',
      recommendFor: '비 오는 날에도 지하주차장에서 비 한 방울 안 맞고 최고의 실내 데이트를 즐기고 싶은 날',
    },
  },
  {
    match: /경기도어린이박물관/,
    guide: {
      regionShort: '용인 기흥',
      freeTip: [
        '12개월 미만 무료 (12개월 이상 전 연령 4,000원 / 경기도민 50% 할인 시 2,000원)',
        '[Tip] 100% 온라인 사전예약제 운영. 경기도민이라면 등본 지참 시 반값(2,000원), 다자녀(2자녀 이상)는 무료입장 혜택 꼭 챙기세요!',
      ],
      parkingTip: [
        '⚠️ [야외 주차장 주의] 박물관 관람은 실내지만, 전용 주차장과 상갈동 공영주차장 모두 지붕 없는 야외 주차장입니다!',
        '[비 오는 날 Tip] 주차 후 입구까지 야외로 걸어 들어가야 하니, 비·눈 오는 날에는 아기 우비나 유모차 레인커버·큰 우산을 꼭 챙기세요.',
      ],
      goodPoints: [
        '1층 자연놀이터와 아기둥지는 걸음마 시기 영유아에게 특화되어 있어 돌~두 돌 아기도 알차게 놀 수 있습니다.',
        '튼튼놀이터, 물놀이 체험 등 층별로 신체·감각 활동이 가득해 반나절 코스로 최고입니다.',
      ],
      strollerTip: '전 층 엘리베이터가 넓고 바닥이 평탄해 유모차 이동이 매우 편합니다. 1층 의무실 옆 대형 수유실(전자레인지·정수기·기저귀교환대) 완비.',
      mealCourse: '도보 컷 기흥역 AK플라자(여기는 지하주차장 실내 직결!) 식당가 / 백남준아트센터 인근 식당',
      recommendFor: '미세먼지 심한 날이나 맑은 날, 가성비 최고 대형 실내 체험관을 찾는 집',
    },
  },
  {
    match: /아쿠아플라넷\s*광교|아쿠아플라넷/,
    guide: {
      regionShort: '수원 광교',
      freeTip: [
        '36개월 미만 무료입장 (직계가족 동반 및 증빙서류 지참 시 적용)',
        '[Tip] 네이버 예매나 통신사(SKT/KT 등) 멤버십 할인을 적용하면 훨씬 저렴하게 입장할 수 있어요.',
      ],
      parkingTip: [
        '✅ [지하주차장 실내 직결] 광교 갤러리아백화점 / 포레나 광교 지하주차장 이용 (비·더위·추위 걱정 0%!)',
        '아쿠아플라넷 매표소/입구에서 차량번호 등록 시 무료 주차 시간 지원.',
      ],
      goodPoints: [
        '거대한 메인 수조의 가오리·상어 먹이주기 공연과 알록달록한 해파리존은 돌 전후 아기들도 넋을 놓고 바라봅니다.',
        '펭귄 마을과 수달 등 아이 눈높이에 맞춘 투명 관람창이 잘 되어 있어 사진 찍기 최고입니다.',
      ],
      strollerTip: '100% 실내 평지 및 엘리베이터 동선으로 유모차 주행 최상급! 내부 수유실 완비 및 바로 옆 갤러리아백화점 유아휴게실도 함께 이용 가능.',
      mealCourse: '실내로 연결된 광교 갤러리아백화점 식당가·푸드코트 / 광교 앨리웨이 브런치·맛집',
      recommendFor: '폭우·폭염·한파에도 지하주차장부터 식사까지 비 한 방울 안 맞고 해결하고 싶은 날',
    },
  },
  {
    match: /에버랜드/,
    guide: {
      regionShort: '용인 처인',
      freeTip: [
        '36개월 미만 무료입장 (주민등록등본·건강보험증 등 개월 수 증빙서류 필수)',
        '[Tip] 36개월 미만 아기는 입장료는 무료지만, 회전목마 등 아기 놀이기구 탑승 시 유아 이용권이 별도로 필요할 수 있어요.',
      ],
      parkingTip: [
        '☀️ [전 구역 야외 주차장] 정문 유료주차장(카카오T 주차 앱 등록 시 5,000원 할인) 및 외곽 무료주차장 모두 야외입니다.',
        '[Tip] 유모차와 짐이 많다면 셔틀을 타야 하는 외곽 주차장보다 정문 주차장(발레파킹 사전예약 가능)이 압도적으로 편합니다.',
      ],
      goodPoints: [
        '로스트밸리, 사파리월드, 판다월드 등 아기들이 눈을 떼지 못하는 동물 관람 동선이 최고입니다.',
        '포시즌스가든은 사계절 꽃밭과 평지 산책로로 되어 있어 인생샷 찍기 좋습니다.',
      ],
      strollerTip: '정문 우측 유모차 대여소 운영(웨건 대여 가능). 베이비케어센터(수유실)에 이유식 전자레인지, 수유 쿠션, 기저귀 교환대 완벽 구비.',
      mealCourse: '원내 가든테라스·한가람(한식, 아기의자 구비) / 마성IC 인근 든든한 한식당',
      recommendFor: '아기에게 처음으로 실제 기린·코끼리·판다를 보여주고 싶은 날',
    },
  },
  {
    match: /안성팜랜드/,
    guide: {
      regionShort: '안성 공도',
      freeTip: [
        '36개월 미만 무료입장 (등본·건강보험증 등 증빙서류 필수 지참)',
        '[Tip] 네이버 사전예매 시 입장권 할인이 적용되며, 오후 늦게 방문하면 오후권 할인을 받을 수 있어요.',
      ],
      parkingTip: [
        '☀️ [대형 야외 주차장] 전 구역 야외 무료 주차장 운영 (제1주차장이 정문 매표소와 가장 가깝습니다)',
      ],
      goodPoints: [
        '양, 소, 당나귀, 토끼 등 초식동물에게 직접 건초 먹이를 주는 체험이 가능해 동물을 좋아하는 아이들에게 천국입니다.',
        '끝없이 펼쳐진 초원과 계절별 꽃밭이 전부 완만한 길이라 아기가 뛰어놀기 최고입니다.',
      ],
      strollerTip: '전 구간 포장도로가 잘 되어 있어 유모차·웨건 끌기 매우 편함. 정문 입구 유모차/전동차 대여소 및 쾌적한 수유실(전자레인지 구비) 완비.',
      mealCourse: '팜랜드 내 목원식당(한식)·푸드코트 / 안성 스타필드(지하주차장 완비, 차량 15분) 식당가',
      recommendFor: '동물 먹이주기 체험과 탁 트인 초원 산책을 동시에 즐기고 싶은 날',
    },
  },
  {
    match: /철도박물관/,
    guide: {
      regionShort: '의왕 부곡',
      freeTip: [
        '36개월 미만(만 3세 미만) 무료 / 어린이(만 4세~12세) 1,000원 / 성인 2,000원',
        '[Tip] 입장료가 믿기지 않을 만큼 저렴한 국공립급 갓성비 명소입니다!',
      ],
      parkingTip: [
        '☀️ [야외 주차장] 박물관 바로 앞 야외 전용 주차장 무료 이용 가능 (입구와 바로 붙어 있어 동선은 짧아요!)',
      ],
      goodPoints: [
        '실제 크기의 거대한 기차·KTX·대통령 전용 열차를 눈앞에서 보고 직접 객실 안에 올라타 볼 수 있어 탈것 홀릭 아기들이 열광합니다.',
        '실내 전시관의 미니 기차 디오라마(모형 철도) 운행 시간은 아이들이 가장 좋아하는 하이라이트입니다.',
      ],
      strollerTip: '야외 기차 전시장 전체가 평지라 유모차 이동이 수월하며, 본관 내 수유실 및 기저귀 교환대가 마련되어 있습니다.',
      mealCourse: '인근 왕송호수공원 카페·맛집 거리 / 의왕 타임빌라스(지하주차장·실내몰) 식당가',
      recommendFor: '기차·칙칙폭폭에 푹 빠진 아이에게 실물 기차를 실컷 보여주고 싶은 날',
    },
  },
  {
    match: /버드파크/,
    guide: {
      regionShort: '오산 시청옆',
      freeTip: [
        '36개월 미만 무료입장 (증빙서류 지참 필수, 단 단체 입장 제외)',
        '[Tip] 네이버 사전예매 할인 또는 오산시민·다자녀 할인을 꼭 확인하세요.',
      ],
      parkingTip: [
        '✅ [지하 + 지상 주차장] 오산시청 지하주차장 및 지상 주차장 함께 이용 (버드파크 관람 시 주차 할인 등록 지원)',
        '[Tip] 비 오는 날에는 오산시청 지하주차장에 대고 이동하시면 훨씬 편합니다.',
      ],
      goodPoints: [
        '실내 식물원처럼 사계절 따뜻하고 쾌적한 공간에서 앵무새·펭귄·카피바라·수달을 코앞에서 교감할 수 있습니다.',
        '새가 손등에 직접 내려앉는 먹이주기 체험은 아이들에게 잊지 못할 추억이 됩니다.',
      ],
      strollerTip: '전 층 엘리베이터 및 실내 경사로가 잘 되어 있어 비 오는 날에도 유모차로 전 구간 관람 가능. 내부 수유실 구비.',
      mealCourse: '내부 카페테리아 / 오산시청 앞 먹자골목 가족 식당·칼국수 맛집',
      recommendFor: '비 오거나 추운 날, 따뜻한 실내에서 동물·새 먹이주기 체험을 하고 싶은 날',
    },
  },
  {
    match: /일월수목원|영흥수목원/,
    guide: {
      regionShort: '수원',
      freeTip: [
        '36개월 미만(만 3세 미만) 무료입장 / 성인 4,000원 (수원시민·다자녀 할인 혜택 큼!)',
        '[Tip] 수원시민이거나 다자녀 가정이라면 신분증·등본 지참 시 대폭 할인됩니다.',
      ],
      parkingTip: [
        '☀️ [야외 지상 주차장] 수목원 입구 야외 주차장 구비 (3시간 기준 소액 유료, 저공해·경차·다자녀 50% 감면)',
        '주차장에서 방문자센터(실내 온실 입구)까지 평지로 바로 연결되어 유모차 내리기 아주 편합니다.',
      ],
      goodPoints: [
        '수원시에서 새로 지은 최신식 수목원이라 온실(전시온실)과 야외 정원 시설이 새것처럼 반짝반짝하고 깨끗합니다.',
        '경사가 거의 없는 평지 데크길 위주라 걸음마 연습하는 아기나 유모차 산책 코스로 완벽합니다.',
      ],
      strollerTip: '방문자센터 유모차 대여 가능, 수유실(기저귀교환대·전자레인지·정수기)이 백화점 수준으로 매우 깨끗하게 완비되어 있습니다.',
      mealCourse: '방문자센터 내 카페 / 일월저수지·영통 인근 브런치 카페 및 가족 식당',
      recommendFor: '계단이나 오르막 없는 평지 자연 속에서 아기와 여유롭게 꽃·나무 산책을 즐기고 싶은 날',
    },
  },
  {
    match: /화담숲/,
    guide: {
      regionShort: '광주 도척',
      freeTip: [
        '24개월 미만 유아 무료입장 (※ 주의: 화담숲은 36개월이 아니라 24개월 미만이 무료 기준입니다!)',
        '[Tip] 100% 온라인 사전예약제! 모노레일도 아기와 타려면 온라인 예매 오픈일에 맞춰 1구간이라도 꼭 선점하세요.',
      ],
      parkingTip: [
        '☀️ [야외 다단 주차장 + 실내 주차타워] 곤지암리조트/화담숲 주차장 무료 이용',
        '[Tip] 슬로프 쪽 야외 주차장은 입구까지 경사가 있으니, 유모차 동반 시 순환버스를 타거나 일찍 도착해 위쪽 구역에 주차하세요.',
      ],
      goodPoints: [
        '국내 최초로 전 구간(약 5km)이 계단 없는 완만한 무장애 데크길로 만들어져 있어 유모차로 숲 전체를 돌 수 있는 유일무이한 명소입니다.',
        '입구 쪽 민물고기 생태관(실내 수족관)과 모노레일 탑승은 아이들이 정말 좋아합니다.',
      ],
      strollerTip: '전 구간 무장애 데크길로 유모차 산책 가능! 단, 모노레일 탑승 시에는 유모차를 접어서 타야 하니 휴대용(폴딩형) 유모차를 강력 추천합니다.',
      mealCourse: '화담숲 내 번지없는주막(해물파전·두부김치)·힐링식당 / 곤지암 소머리국밥·한식당',
      recommendFor: '계단 걱정 전혀 없이 유모차 끌고 맑은 피톤치드 숲길과 모노레일을 즐기고 싶은 날',
    },
  },
  {
    match: /한국민속촌/,
    guide: {
      regionShort: '용인 기흥',
      freeTip: [
        '36개월 미만 무료입장 (증빙서류 지참 필수)',
        '[Tip] 용인시민 할인, 다자녀 할인 및 네이버 사전예매 할인을 비교해서 결제하세요.',
      ],
      parkingTip: [
        '☀️ [대형 야외 주차장] 소형 2,000원 정액제로 시간제한 없이 여유롭게 주차 가능 (지붕 없는 야외 주차장)',
        '정문 입구와 가까운 앞쪽 줄에 주차하면 유모차 내리기가 훨씬 수월합니다.',
      ],
      goodPoints: [
        '전통 가옥 산책로가 평지로 잘 다져져 있고, 마상무예·농악 등 아기들의 시선을 끄는 야외 공연이 풍성합니다.',
        '놀이마을 구역에 아기들과 함께 탈 수 있는 순한 회전목마·기차 놀이기구도 있습니다.',
      ],
      strollerTip: '흙길이 있으나 단단하게 다져져 있어 디럭스·절충형 유모차 주행 무난. 정문 의무실 옆 및 놀이마을 내 수유실(전자레인지 구비) 완비.',
      mealCourse: '민속촌 내 장터 국밥·해물파전 / 보라동·기흥 호수공원 인근 가족 식당',
      recommendFor: '탁 트인 야외에서 유모차 산책하며 전통 공연과 장터 먹거리를 즐기고 싶은 날',
    },
  },
  {
    match: /서울대공원|서울동물원/,
    guide: {
      regionShort: '과천',
      freeTip: [
        '만 5세 이하(미취학 영유아) 동물원·테마가든 무료입장!',
        '[Tip] 동물원 입구까지 걷지 말고 코끼리열차(36개월 미만 무료)를 타면 체력을 아낄 수 있어요.',
      ],
      parkingTip: [
        '☀️ [대형 야외 주차장] 카카오T 주차 앱 사전 정산 시 대폭 할인 (경차·저공해·다자녀 50% 할인)',
        '[Tip] 주차장이 매우 넓어 매표소(코끼리열차 타는 곳)와 가까운 중앙 구역에 주차해야 덜 걷습니다.',
      ],
      goodPoints: [
        '국공립 동물원이라 입장료가 매우 저렴하면서도 공간이 넓고 동물 종류가 압도적입니다.',
        '유모차로 천천히 숲길을 걸으며 기린, 코끼리, 홍학을 가까이서 볼 수 있습니다.',
      ],
      strollerTip: '코끼리열차에 유모차를 접어서 탑승 가능. 동물원 정문 유모차 대여소 및 원내 곳곳에 아기쉼터(수유실) 구비.',
      mealCourse: '동물원 내 푸드코트·도시락 피크닉 / 대공원역·경마공원 인근 한식당',
      recommendFor: '부담 없는 입장료로 자연 속에서 동물원 나들이를 실컷 하고 싶은 날',
    },
  },
];

/** 일반 장소도 주차장 유형(지하/실내 vs 야외)을 텍스트와 장소 특성으로 자동 추론 */
function inferParkingTypeTip(place: OutingPlace): string {
  const text = `${place.name} ${place.featureNotes?.parking ?? ''} ${place.summary}`;
  if (/지하\s*주차|실내\s*주차|주차\s*타워|백화점|아울렛|스타필드|몰/.test(text)) {
    return '✅ [지하/실내 주차장 확인] 실내 이동 동선이 있는지 진입 전 층별 안내도를 확인하세요.';
  }
  if (/야외\s*주차|옥외|노상|수목원|공원|휴양림|민속촌|목장|팜랜드|생태|호수|유원지/.test(text)) {
    return '☀️ [야외 지상 주차장 위주] 지붕 없는 야외 주차장일 가능성이 높으니 비·눈 오는 날에는 우산과 유모차 레인커버를 챙기세요.';
  }
  return '💡 [주차장 실내/야외 여부] 박물관·전시관이라도 주차장은 야외인 경우가 있으니, 비 오는 날엔 위 [네이버 육아맘 후기] 버튼으로 지하주차장 유무를 꼭 확인하세요!';
}

function buildMomPickGuide(place: OutingPlace): CuratedGuide {
  const matched = CURATED_DB.find((c) => c.match.test(place.name));
  if (matched) return matched.guide;

  const regionShort = [place.sido.replace(/(특별자치|광역|특별)?(시|도)$/, ''), place.sigungu].filter(Boolean).join(' ');

  const freeTip: string[] = [];
  const freeCriteria = place.featureNotes?.freeEntry || (place.features.freeEntry === 'yes' ? '영유아 무료입장 대상' : '방문 전 요금 확인 권장');
  freeTip.push(freeCriteria);
  const useFeeRow = place.fees.find((f) => f.label.includes('이용 요금'));
  if (useFeeRow) freeTip.push(`기본 요금: ${useFeeRow.value}`);
  if (place.discounts.length > 0) {
    freeTip.push(`[Tip] ${place.discounts.join(' / ')} 혜택 및 36개월 미만 증빙서류(등본·건강보험증 앱)를 꼭 챙기세요.`);
  } else {
    freeTip.push('[Tip] 영유아 무료입장 혜택 적용 시 개월 수 확인용 증빙서류(등본 등) 지참 필수.');
  }

  const parkingTip: string[] = [];
  if (place.featureNotes?.parking) {
    parkingTip.push(place.featureNotes.parking);
  } else {
    parkingTip.push(place.features.parking === 'yes' ? '전용 주차장 또는 인근 공영주차장 이용 가능' : '방문 전 주변 주차장 확인 필요');
  }
  parkingTip.push(inferParkingTypeTip(place));

  const cleanSummary = place.summary.replace(/^👶\s*\[[^\]]+\]\s*·\s*/, '');
  const goodPoints: string[] = [cleanSummary];
  if (/(박물관|과학관|미술관|전시|체험)/.test(place.name)) {
    goodPoints.push('실내 위주 관람 동선이라 더위·추위·미세먼지에 구애받지 않고 아기와 쾌적하게 둘러보기 좋습니다.');
  } else if (/(수목원|공원|호수|숲|자연|생태)/.test(place.name)) {
    goodPoints.push('탁 트인 자연 산책로가 조성되어 있어 아기와 계절 풍경을 보며 유모차 산책하기 좋습니다.');
  }

  const strollerParts: string[] = [];
  if (place.featureNotes?.stroller) strollerParts.push(`유모차: ${place.featureNotes.stroller}`);
  else strollerParts.push('유모차 이동 동선 및 대여 여부는 안내데스크에서 확인 가능');
  if (place.featureNotes?.nursingRoom) strollerParts.push(`수유실: ${place.featureNotes.nursingRoom}`);
  else if (place.features.nursingRoom === 'yes') strollerParts.push('수유실 구비');
  const strollerTip = strollerParts.join(' / ');

  const areaName = place.sigungu || place.sido;
  const mealCourse = `내부 카페·편의시설 또는 ${areaName} 인근 아기의자 구비 가족 식당·브런치 카페`;
  const recommendFor = /(박물관|과학관|미술관|체험)/.test(place.name)
    ? `날씨 걱정 없이 ${areaName}에서 쾌적하게 실내 나들이를 즐기고 싶은 날`
    : `여유롭게 유모차 산책하며 ${areaName}에서 아기와 사진 찍고 힐링하고 싶은 날`;

  return { regionShort, freeTip, parkingTip, goodPoints, strollerTip, mealCourse, recommendFor };
}

export default async function PlacePage({ params }: Props) {
  const { mode, place, error } = await getPlaceData((await params).id);
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p role="alert" className="text-rose-800">
          {error}
        </p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-coral px-6 py-2.5 font-bold text-white hover:bg-coral-dark">
          처음으로 돌아가기
        </Link>
      </div>
    );
  }
  if (!place) notFound();
  const officialHref = safeHref(place.officialUrl);
  const guide = buildMomPickGuide(place);

  const copyTemplateText = [
    `${place.emoji} ${place.name}`,
    `📍 ${guide.regionShort || `${place.sido}${place.sigungu}`.trim()}`,
    `👶 무료입장 & 요금`,
    ...guide.freeTip.map((t) => `- ${t}`),
    `🅿️ 주차`,
    ...guide.parkingTip.map((t) => `- ${t}`),
    `👶 아이와 가면 좋은 포인트`,
    ...guide.goodPoints.map((t) => `- ${t}`),
    `🛒 유모차 TIP`,
    `- ${guide.strollerTip}`,
    `🍚 같이 묶기 좋은 식사 동선`,
    `➡️ ${guide.mealCourse}`,
    `⭐ 이런 집에 추천`,
    `${guide.recommendFor}`,
  ].join('\n');

  // 네이버 후기 검색 시 '주차장(지하/야외) + 수유실'이 한 번에 나오도록 검색어 고도화
  const naverSearchQuery = encodeURIComponent(`${place.name} 아기랑 주차장 수유실`);

  return (
    <>
      {place.isSample && <SampleNotice allSample={mode === 'sample'} />}
      <div className="mx-auto max-w-3xl px-4 py-6 wrap-break-word">
        <Link href="/" className="text-sm font-medium text-ink-soft hover:text-coral-dark">
          ← 목록으로 돌아가기
        </Link>

        {/* 1. 상단 타이틀 카드 */}
        <div className="mt-3 overflow-hidden rounded-3xl border border-sand bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {place.isSample && <SampleBadge />}
            {place.category && (
              <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                {CATEGORY_LABELS[place.category]}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            {place.emoji} {place.name}
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-coral-dark">
            📍 {guide.regionShort || `${place.sido} ${place.sigungu}`} {place.address ? `· ${place.address}` : ''}
          </p>
          {(place.hours || place.closedDays) && (
            <p className="mt-2 text-xs text-ink-soft">
              🕒 운영시간: {place.hours ?? '홈페이지 참고'} {place.closedDays ? `(휴무: ${place.closedDays})` : ''}
            </p>
          )}
        </div>

        {/* 2. 핵심 큐레이션 카드 */}
        <section className="mt-4 rounded-3xl border-2 border-coral/40 bg-cream/60 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand pb-3">
            <h2 className="text-lg font-extrabold text-coral-dark">✨ 아기랑 나들이 핵심 요약</h2>
            <div className="flex flex-wrap gap-2">
              {officialHref && (
                <a
                  href={officialHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-coral px-3.5 py-1.5 text-xs font-bold text-white hover:bg-coral-dark"
                >
                  🏠 공식 홈페이지 ↗
                </a>
              )}
              <a
                href={`https://search.naver.com/search.naver?where=view&query=${naverSearchQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-sage px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                🔍 주차장·수유실 육아맘 후기 ↗
              </a>
            </div>
          </div>

          <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink">
            <div>
              <h3 className="text-base font-bold">👶 무료입장 &amp; 요금</h3>
              <ul className="mt-1 space-y-1 pl-1">
                {guide.freeTip.map((t, idx) => (
                  <li key={idx}>- {t}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-base font-bold">🅿️ 주차 (실내/야외 동선)</h3>
              <ul className="mt-1 space-y-1 pl-1">
                {guide.parkingTip.map((t, idx) => (
                  <li key={idx}>- {t}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-base font-bold">👶 아이와 가면 좋은 포인트</h3>
              <ul className="mt-1 space-y-1 pl-1">
                {guide.goodPoints.map((t, idx) => (
                  <li key={idx}>- {t}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-base font-bold">🛒 유모차 &amp; 수유실 TIP</h3>
              <p className="mt-1 pl-1">- {guide.strollerTip}</p>
            </div>

            <div>
              <h3 className="text-base font-bold">🍚 같이 묶기 좋은 식사 동선</h3>
              <p className="mt-1 pl-1 font-medium">➡️ {guide.mealCourse}</p>
            </div>

            <div className="rounded-xl border border-sand bg-white p-3.5">
              <h3 className="text-base font-bold text-coral-dark">⭐ 이런 집에 추천</h3>
              <p className="mt-1 font-semibold">{guide.recommendFor}</p>
            </div>
          </div>

          {/* 인스타·블로그 복사용 원문 박스 */}
          <details className="mt-5 rounded-xl border border-sand bg-white p-3.5">
            <summary className="cursor-pointer text-xs font-bold text-coral-dark hover:underline">
              📋 인스타·블로그용 텍스트 원문 펼쳐보기 (클릭 후 복사하세요!)
            </summary>
            <pre className="mt-2 select-all whitespace-pre-wrap rounded-lg bg-cream p-3 text-xs leading-relaxed text-ink">
              {copyTemplateText}
            </pre>
          </details>

          {place.sourceLabel && (
            <p className="mt-4 text-right text-[11px] text-ink-soft/70">{place.sourceLabel}</p>
          )}
        </section>
      </div>
    </>
  );
}