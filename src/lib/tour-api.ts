// 한국관광공사 국문 관광정보 서비스_GW (KorService2) 조회 — 서버 전용.
export const TOUR_API_BASE = 'https://apis.data.go.kr/B551011/KorService2';
export const CONTENT_TYPE_TOURIST_SPOT = '12'; // 관광지
export const CONTENT_TYPE_CULTURE = '14'; // 문화시설(박물관·미술관·과학관·어린이체험관 등)

export interface TourItem {
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string | null;
  areaCode: string | null;
  sigunguCode: string | null;
  tel: string | null;
  imageUrl: string | null;
  mapX: number | null;
  mapY: number | null;
  modifiedAt: string | null;
  cat3?: string | null;
}

export interface TourListResult {
  items: TourItem[];
  totalCount: number;
  source: { provider: '한국관광공사 TourAPI'; operation: string; fetchedAt: string };
}

export class TourApiError extends Error {
  constructor(public code: 'no_key' | 'http' | 'auth' | 'api' | 'format' | 'network', message: string) {
    super(message);
  }
}

export function normalizeServiceKey(raw: string): string {
  const k = raw.trim();
  if (!k.includes('%')) return k;
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}

export function buildTourUrl(operation: string, serviceKey: string, params: Record<string, string | number>): string {
  const q = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: 'ETC',
    MobileApp: 'sihwanlog',
    _type: 'json',
  });
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  return `${TOUR_API_BASE}/${operation}?${q.toString()}`;
}

const s = (v: unknown) => {
  const t = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return t || null;
};
const n = (v: unknown) => {
  const x = Number(v);
  return v === '' || v == null || !Number.isFinite(x) ? null : x;
};

const cleanHtml = (v: unknown) => {
  const str = String(v ?? '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return str || null;
};

export function mapTourItem(raw: Record<string, unknown>): TourItem {
  const addr = [s(raw.addr1), s(raw.addr2)].filter(Boolean).join(' ');
  return {
    contentId: s(raw.contentid) ?? '',
    contentTypeId: s(raw.contenttypeid) ?? '',
    title: s(raw.title) ?? '',
    address: addr || null,
    areaCode: s(raw.areacode),
    sigunguCode: s(raw.sigungucode),
    tel: s(raw.tel),
    imageUrl: s(raw.firstimage)?.replace(/^http:\/\//, 'https://') ?? null,
    mapX: n(raw.mapx),
    mapY: n(raw.mapy),
    modifiedAt: s(raw.modifiedtime),
    cat3: s(raw.cat3),
  };
}

export function parseTourResponse(text: string): { items: TourItem[]; totalCount: number } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    const auth = text.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>/)?.[1] ?? text.match(/<errMsg>([^<]+)<\/errMsg>/)?.[1];
    if (auth) throw new TourApiError('auth', `인증 오류: ${auth}`);
    throw new TourApiError('format', '응답이 JSON 형식이 아니에요.');
  }
  const res = (json as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: Record<string, unknown> } }).response;
  if (!res?.header) {
    const msg = (json as { resultMsg?: string; message?: string }).resultMsg ?? (json as { message?: string }).message;
    throw new TourApiError('format', `예상과 다른 응답이에요${msg ? `: ${msg}` : ''}.`);
  }
  if (res.header.resultCode !== '0000') {
    throw new TourApiError('api', `API 오류 ${res.header.resultCode}: ${res.header.resultMsg ?? ''}`.trim());
  }
  const body = res.body ?? {};
  const itemsField = body.items as { item?: unknown } | string | undefined;
  const raw = typeof itemsField === 'object' && itemsField ? itemsField.item : undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { items: list.map((r) => mapTourItem(r as Record<string, unknown>)), totalCount: Number(body.totalCount ?? list.length) || 0 };
}

export interface TourRequestOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  revalidateSeconds?: number;
}

export interface TourListOptions extends TourRequestOptions {
  numOfRows?: number;
  pageNo?: number;
  contentTypeId?: string;
  areaCode?: string;
  sigunguCode?: string;
}

export function hasTourApiKey(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.TOUR_API_KEY?.trim();
}

const EXCLUDE_TITLE_REGEX = /(묘역|능|원|고분|산성|전적지|위령탑|추모|기념탑|사당|향교|서원|사지|폐사|대첩비|낚시|골프|카지노|유흥|클라이밍|패러글라이딩|모텔|호텔|펜션|리조트|맛집|식당|카페)/;

/** 전국 + 수도권 아기 나들이 필수 코스를 테마별로 핀셋 수집 */
export async function fetchAreaBasedList(opts: TourListOptions = {}): Promise<TourListResult> {
  const operation = 'areaBasedList2';
  const isDefaultBulkLoad = (opts.numOfRows ?? 10) >= 30 && !opts.areaCode && !opts.contentTypeId;

  if (!isDefaultBulkLoad) {
    const params: Record<string, string | number> = {
      numOfRows: Math.min(Math.max(opts.numOfRows ?? 10, 1), 100),
      pageNo: Math.max(opts.pageNo ?? 1, 1),
      arrange: 'C',
      contentTypeId: opts.contentTypeId ?? CONTENT_TYPE_TOURIST_SPOT,
    };
    if (opts.areaCode) params.areaCode = opts.areaCode;
    if (opts.sigunguCode) params.sigunguCode = opts.sigunguCode;
    const { items, totalCount } = await requestTour(operation, params, opts);
    return { items, totalCount, source: { provider: '한국관광공사 TourAPI', operation, fetchedAt: new Date().toISOString() } };
  }

  // 엄마들이 가장 많이 찾는 핵심 키워드 + 요청하신 명소(안성팜랜드, 철도박물관, 버드파크, 아쿠아플라넷, 화담숲, 일월/영흥수목원 등) 100% 수집!
  const babyKeywords = [
    '어린이박물관',
    '에버랜드',
    '안성팜랜드',
    '서울대공원',
    '철도박물관',
    '버드파크',
    '아쿠아플라넷',
    '아쿠아리움',
    '화담숲',
    '일월수목원',
    '영흥수목원',
    '한국민속촌',
    '롯데월드',
    '어린이대공원',
    '동물원',
    '과학관',
    '수목원',
    '생태공원',
    '공룡',
    '자동차박물관',
    '항공박물관',
    '유아숲',
    '호수공원',
  ];

  const keywordTasks = babyKeywords.map((kw) =>
    requestTour('searchKeyword2', { keyword: kw, numOfRows: 30, pageNo: 1, arrange: 'Q' }, opts).catch(() => ({
      items: [] as TourItem[],
      totalCount: 0,
    })),
  );

  const areaTasks = [
    requestTour(operation, { numOfRows: 60, pageNo: 1, arrange: 'Q', areaCode: '31', sigunguCode: '23' }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 60, pageNo: 1, arrange: 'Q', areaCode: '31', sigunguCode: '27' }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 80, pageNo: 1, arrange: 'Q', areaCode: '31', contentTypeId: CONTENT_TYPE_CULTURE }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 80, pageNo: 1, arrange: 'Q', areaCode: '31', contentTypeId: CONTENT_TYPE_TOURIST_SPOT }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 50, pageNo: 1, arrange: 'Q', areaCode: '1', contentTypeId: CONTENT_TYPE_CULTURE }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 50, pageNo: 1, arrange: 'Q', areaCode: '2', contentTypeId: CONTENT_TYPE_TOURIST_SPOT }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 50, pageNo: 1, arrange: 'Q', areaCode: '32', contentTypeId: CONTENT_TYPE_TOURIST_SPOT }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
    requestTour(operation, { numOfRows: 50, pageNo: 1, arrange: 'Q', areaCode: '39', contentTypeId: CONTENT_TYPE_TOURIST_SPOT }, opts).catch(() => ({ items: [] as TourItem[], totalCount: 0 })),
  ];

  const allResults = await Promise.all([...keywordTasks, ...areaTasks]);

  const seen = new Set<string>();
  const combined: TourItem[] = [];

  for (const res of allResults) {
    for (const item of res.items) {
      if (!item.contentId || !item.title) continue;
      if (seen.has(item.contentId)) continue;
      if (item.contentTypeId && item.contentTypeId !== '12' && item.contentTypeId !== '14') continue;
      if (EXCLUDE_TITLE_REGEX.test(item.title)) continue;
      seen.add(item.contentId);
      combined.push(item);
    }
  }

  return {
    items: combined,
    totalCount: combined.length,
    source: { provider: '한국관광공사 TourAPI', operation, fetchedAt: new Date().toISOString() },
  };
}

export interface TourDetail {
  item: TourItem;
  homepage: string | null;
  overview: string | null;
  useFee: string | null;
  hours: string | null;
  closedDays: string | null;
  parking: string | null;
  parkingFee: string | null;
  babyCarriage: string | null;
  lactationRoom: string | null;
  babySpareChair: string | null;
  infantsEtc: string | null;
}

export async function fetchDetailCommon(contentId: string, opts: TourRequestOptions = {}): Promise<TourDetail | null> {
  if (!/^\d{1,12}$/.test(contentId)) return null;
  const { items, raw } = await requestTour('detailCommon2', { contentId }, opts);
  const first = raw[0];
  const baseItem = items[0];
  if (!baseItem || !first) return null;

  const hp = String(first.homepage ?? '');
  const homepage = hp.match(/href=["']?(https?:\/\/[^"'\s>]+)/i)?.[1] ?? hp.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? null;
  const overview = cleanHtml(first.overview);

  const contentTypeId = baseItem.contentTypeId || CONTENT_TYPE_TOURIST_SPOT;

  const [introRes, barrierRes] = await Promise.all([
    requestTour('detailIntro2', { contentId, contentTypeId }, opts).catch(() => null),
    requestTour('detailWithTour2', { contentId }, opts).catch(() => null),
  ]);

  const intro = introRes?.raw?.[0] ?? {};
  const barrier = barrierRes?.raw?.[0] ?? {};

  return {
    item: baseItem,
    homepage,
    overview: overview ? overview.slice(0, 500) + (overview.length > 500 ? '…' : '') : null,
    useFee: cleanHtml(intro.usefee ?? intro.usefeeleports ?? intro.usetimeculture),
    hours: cleanHtml(intro.usetime ?? intro.usetimeculture ?? intro.usetimeleports),
    closedDays: cleanHtml(intro.restdate ?? intro.restdateculture ?? intro.restdateleports),
    parking: cleanHtml(intro.parking ?? intro.parkingculture ?? intro.parkingleports ?? barrier.parking),
    parkingFee: cleanHtml(intro.parkingfee ?? intro.parkingfeeculture),
    babyCarriage: cleanHtml(barrier.stroller ?? intro.chkbabycarriage ?? intro.chkbabycarriageculture),
    lactationRoom: cleanHtml(barrier.lactationroom),
    babySpareChair: cleanHtml(barrier.babysparechair),
    infantsEtc: cleanHtml(barrier.infantsEtc ?? barrier.infantsfamilyetc),
  };
}

async function requestTour(
  operation: string,
  params: Record<string, string | number>,
  opts: TourRequestOptions,
): Promise<{ items: TourItem[]; totalCount: number; raw: Record<string, unknown>[] }> {
  const key = (opts.env ?? process.env).TOUR_API_KEY?.trim();
  if (!key) throw new TourApiError('no_key', 'TOUR_API_KEY가 설정되지 않았어요.');
  const f = opts.fetchImpl ?? fetch;
  const init: RequestInit & { next?: { revalidate: number } } = opts.revalidateSeconds
    ? { next: { revalidate: opts.revalidateSeconds }, signal: AbortSignal.timeout(10_000) }
    : { cache: 'no-store', signal: AbortSignal.timeout(10_000) };
  let res: Response;
  try {
    res = await f(buildTourUrl(operation, key, params), init);
  } catch (e) {
    const name = (e as Error)?.name;
    throw new TourApiError('network', name === 'TimeoutError' || name === 'AbortError' ? '응답 시간 초과' : '네트워크 연결 실패');
  }
  const text = await res.text();
  if (!res.ok) {
    try {
      parseTourResponse(text);
    } catch (e) {
      if (e instanceof TourApiError && e.code === 'auth') throw e;
    }
    throw new TourApiError('http', `HTTP ${res.status}`);
  }
  const { items, totalCount } = parseTourResponse(text);
  return { items, totalCount, raw: rawItems(text) };
}

function rawItems(text: string): Record<string, unknown>[] {
  const item = (JSON.parse(text) as { response?: { body?: { items?: { item?: unknown } } } }).response?.body?.items?.item;
  return (Array.isArray(item) ? item : item ? [item] : []) as Record<string, unknown>[];
}