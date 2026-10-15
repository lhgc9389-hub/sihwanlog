'use client';

import { useMemo, useState } from 'react';
import { listSido, searchPlaces } from '@/lib/search.ts';
import { FEATURE_KEYS, FEATURE_LABELS, type FeatureKey, type OutingPlace } from '@/lib/types.ts';
import { PlaceCard } from './PlaceCard';

const FEATURE_ICONS: Record<FeatureKey, string> = {
  freeEntry: '🎟️',
  discount: '💸',
  nursingRoom: '🍼',
  diaperStation: '🧷',
  stroller: '👶',
  parking: '🚗',
};

type AgeFilter = 'all' | 'under12' | 'under24' | 'under36' | 'allFree';

const AGE_BUTTONS: { id: AgeFilter; label: string }[] = [
  { id: 'all', label: '전체 연령' },
  { id: 'under12', label: '👶 ~12개월 무료' },
  { id: 'under24', label: '👧 12~24개월 무료' },
  { id: 'under36', label: '🧒 24~36개월 무료' },
  { id: 'allFree', label: '🟢 전 연령 무료만' },
];

type ThemeFilter = 'all' | 'animal' | 'vehicle' | 'indoor' | 'nature' | 'themePark';

const THEME_BUTTONS: { id: ThemeFilter; label: string; sub: string }[] = [
  { id: 'all', label: '🌈 전체 테마', sub: '모든 나들이 장소' },
  { id: 'animal', label: '🐘 동물·아쿠아리움', sub: '에버랜드·안성팜랜드·서울대공원·아쿠아플라넷 등' },
  { id: 'vehicle', label: '🚂 탈것·기차·공룡', sub: '의왕 철도박물관·자동차·항공·공룡 테마' },
  { id: 'indoor', label: '☔ 비 오는 날 실내', sub: '어린이박물관·아쿠아리움·버드파크·과학관' },
  { id: 'nature', label: '🌳 평지 자연·수목원', sub: '일월/영흥수목원·화담숲·호수공원 산책' },
  { id: 'themePark', label: '🎠 테마파크·민속촌', sub: '에버랜드·한국민속촌·롯데월드·유원지' },
];

/** 장소가 선택한 테마(동물, 탈것, 비오는날 실내, 자연 산책 등)에 해당하는지 판별 */
function matchesTheme(place: OutingPlace, theme: ThemeFilter): boolean {
  if (theme === 'all') return true;
  const text = `${place.name} ${place.summary}`;

  if (theme === 'animal') {
    return /(동물|주렁주렁|팜랜드|목장|양떼|버드파크|아쿠아|수족관|에버랜드|서울대공원|어린이대공원|생태|사파리|조류|곤충|나비)/.test(text);
  }
  if (theme === 'vehicle') {
    return /(철도|기차|열차|레일|자동차|교통|항공|비행기|우주|공룡|다이노|선박|함상|모노레일|루지|케이블카)/.test(text);
  }
  if (theme === 'indoor') {
    // 야외 위주인 수목원·숲·호수공원은 제외하고 실내 관람 시설만 필터링
    if (/(수목원|휴양림|호수공원|해수욕장|산성)/.test(place.name)) return false;
    return (
      place.category === 'indoor' ||
      place.category === 'museum' ||
      /(박물관|과학관|미술관|아쿠아|수족관|버드파크|전시관|기념관|체험관|실내|도서관|육아종합|키즈|베이비|롯데월드)/.test(text)
    );
  }
  if (theme === 'nature') {
    return (
      place.category === 'park' ||
      /(수목원|식물원|화담숲|휴양림|유아숲|숲체원|호수공원|생태공원|습지|정원|공원|팜랜드|목장)/.test(text)
    );
  }
  if (theme === 'themePark') {
    return (
      place.category === 'theme' ||
      /(에버랜드|롯데월드|서울랜드|민속촌|테마파크|어린이대공원|서울대공원|유원지|랜드|월드|루지)/.test(text)
    );
  }
  return true;
}

function getMaxFreeMonths(place: OutingPlace): number {
  const text = [
    place.summary,
    place.recommendedAge,
    place.featureNotes?.freeEntry,
    ...place.fees.map((f) => `${f.label} ${f.value}`),
  ]
    .filter(Boolean)
    .join(' ');

  if (/전\s*연령\s*무료|전액\s*무료|무료\s*개방|모두\s*무료/.test(text)) return 999;
  const m = text.match(/(\d{1,2})\s*개월\s*(?:미만|이하)/);
  if (m) return Number(m[1]);
  if (/만\s*6\s*세|미취학/.test(text)) return 72;
  if (/만\s*3\s*세/.test(text)) return 36;
  if (/만\s*2\s*세/.test(text)) return 24;
  if (place.features.freeEntry === 'yes') return 36;
  return 0;
}

const triToKorean = (v: string | undefined) => (v === 'yes' ? 'O (있음)' : v === 'no' ? 'X (없음)' : '상세페이지 확인');

export function PlaceExplorer({ places }: { places: OutingPlace[] }) {
  const [keyword, setKeyword] = useState('');
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [features, setFeatures] = useState<FeatureKey[]>([]);

  const sidoList = useMemo(() => listSido(places), [places]);

  const sigunguList = useMemo(() => {
    const filtered = sido ? places.filter((p) => p.sido === sido) : places;
    return [...new Set(filtered.map((p) => p.sigungu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [places, sido]);

  const results = useMemo(() => {
    const base = searchPlaces(places, { keyword, sido, features });
    return base.filter((p) => {
      if (sigungu && p.sigungu !== sigungu) return false;
      if (!matchesTheme(p, themeFilter)) return false;
      if (ageFilter === 'all') return true;
      const maxMonths = getMaxFreeMonths(p);
      if (ageFilter === 'allFree') return maxMonths >= 999;
      if (ageFilter === 'under12') return maxMonths >= 12;
      if (ageFilter === 'under24') return maxMonths >= 24;
      if (ageFilter === 'under36') return maxMonths >= 36;
      return true;
    });
  }, [places, keyword, sido, sigungu, themeFilter, ageFilter, features]);

  const hasFilter =
    keyword !== '' || sido !== '' || sigungu !== '' || themeFilter !== 'all' || ageFilter !== 'all' || features.length > 0;

  const toggle = (k: FeatureKey) =>
    setFeatures((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const reset = () => {
    setKeyword('');
    setSido('');
    setSigungu('');
    setThemeFilter('all');
    setAgeFilter('all');
    setFeatures([]);
  };

  const downloadExcel = () => {
    if (results.length === 0) return;

    const headers = [
      '장소명',
      '시·도',
      '시·군·구',
      '주소',
      '무료입장 기준',
      '할인 혜택',
      '수유실',
      '기저귀교환대',
      '유모차',
      '주차',
      '운영시간',
      '휴무일',
      '요약 및 팁',
      '상세페이지 링크',
    ];

    const esc = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

    const rows = results.map((p) => [
      p.name,
      p.sido,
      p.sigungu,
      p.address ?? '',
      p.featureNotes?.freeEntry ?? p.recommendedAge ?? triToKorean(p.features.freeEntry),
      p.featureNotes?.discount ?? (p.discounts.join(', ') || triToKorean(p.features.discount)),
      p.featureNotes?.nursingRoom ?? triToKorean(p.features.nursingRoom),
      p.featureNotes?.diaperStation ?? triToKorean(p.features.diaperStation),
      p.featureNotes?.stroller ?? triToKorean(p.features.stroller),
      p.featureNotes?.parking ?? triToKorean(p.features.parking),
      p.hours ?? '',
      p.closedDays ?? '',
      p.summary,
      `${window.location.origin}/places/${p.id}`,
    ]);

    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const regionName = [sido, sigungu].filter(Boolean).join('_') || '전국';
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `아기랑나들이_${regionName}_${results.length}곳_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section id="search" className="mx-auto max-w-5xl px-4">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="-mt-8 rounded-3xl border border-sand bg-white p-4 shadow-lg sm:p-6"
      >
        {/* 1. 지역(시·도 / 시·군·구) 및 키워드 검색 */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sm:w-40">
            <span className="sr-only">시·도 선택</span>
            <select
              value={sido}
              onChange={(e) => {
                setSido(e.target.value);
                setSigungu('');
              }}
              className="h-12 w-full rounded-xl border border-sand bg-cream px-3 text-base focus:border-coral focus:outline-none"
            >
              <option value="">전체 시·도</option>
              {sidoList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="sm:w-40">
            <span className="sr-only">시·군·구 선택</span>
            <select
              value={sigungu}
              onChange={(e) => setSigungu(e.target.value)}
              className="h-12 w-full rounded-xl border border-sand bg-cream px-3 text-base focus:border-coral focus:outline-none"
            >
              <option value="">전체 시·군·구</option>
              {sigunguList.map((sg) => (
                <option key={sg} value={sg}>
                  {sg}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1">
            <span className="sr-only">장소 이름이나 지역 검색</span>
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="장소 이름, 지역(예: 용인, 파주, 수목원, 철도박물관) 검색"
              className="h-12 w-full rounded-xl border border-sand bg-cream px-4 text-base placeholder:text-ink-soft/70 focus:border-coral focus:outline-none"
            />
          </label>
        </div>

        {/* 2. ✨ 아이 취향 & 날씨별 테마 선택 버튼 (신규 추가!) */}
        <fieldset className="mt-4 border-t border-sand/60 pt-4">
          <legend className="mb-2 text-sm font-semibold text-ink-soft">
            🎈 아이 취향 · 날씨별 테마 <span className="font-normal">(동물, 탈것, 비 오는 날 실내, 평지 산책 등)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {THEME_BUTTONS.map((btn) => {
              const on = themeFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  title={btn.sub}
                  aria-pressed={on}
                  onClick={() => setThemeFilter(btn.id)}
                  className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-semibold leading-none shadow-sm transition ${
                    on
                      ? 'border-coral bg-coral text-white hover:bg-coral-dark'
                      : 'border-sand bg-cream text-ink hover:border-sage hover:bg-sage-light'
                  }`}
                >
                  <span>{on ? `✓ ${btn.label}` : btn.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 3. 우리 아기 개월 수별 무료입장 선택 버튼 */}
        <fieldset className="mt-4 border-t border-sand/60 pt-4">
          <legend className="mb-2 text-sm font-semibold text-ink-soft">
            👶 우리 아기 개월 수 무료입장 기준 <span className="font-normal">(개월 수에 맞춰 무료로 갈 수 있는 곳만 골라드려요)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {AGE_BUTTONS.map((btn) => {
              const on = ageFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAgeFilter(btn.id)}
                  className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-semibold leading-none shadow-sm transition ${
                    on
                      ? 'border-coral bg-coral text-white hover:bg-coral-dark'
                      : 'border-sand bg-cream text-ink hover:border-sage hover:bg-sage-light'
                  }`}
                >
                  <span>{on ? `✓ ${btn.label}` : btn.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 4. 편의시설 및 할인 필터 */}
        <fieldset className="mt-4 border-t border-sand/60 pt-4">
          <legend className="mb-2 text-sm font-semibold text-ink-soft">
            필요한 편의시설·혜택을 고르세요
          </legend>
          <div className="flex flex-wrap gap-2">
            {FEATURE_KEYS.map((k) => {
              const on = features.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(k)}
                  className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-semibold leading-none shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                    on
                      ? 'border-coral bg-coral text-white hover:bg-coral-dark'
                      : 'border-sand bg-cream text-ink hover:border-sage hover:bg-sage-light'
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">
                    {on ? '✓' : FEATURE_ICONS[k]}
                  </span>
                  <span>{FEATURE_LABELS[k]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>

      {/* 검색 결과 수 & 엑셀 다운로드 버튼 */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft" aria-live="polite">
          검색 결과 <strong className="text-ink">{results.length}</strong>곳
        </p>
        <div className="flex items-center gap-3">
          {hasFilter && (
            <button type="button" onClick={reset} className="text-sm font-medium text-coral-dark underline underline-offset-4">
              조건 초기화
            </button>
          )}
          {results.length > 0 && (
            <button
              type="button"
              onClick={downloadExcel}
              className="inline-flex items-center gap-1.5 rounded-full bg-sage px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
            >
              <span>📥</span>
              <span>엑셀(CSV) 저장</span>
            </button>
          )}
        </div>
      </div>

      {results.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-sand bg-white p-10 text-center">
          <p className="text-3xl" aria-hidden>
            🔍
          </p>
          <p className="mt-2 font-bold">조건에 맞는 장소가 아직 없어요</p>
          <p className="mt-1 text-sm text-ink-soft">
            조건을 줄여 보세요. 상세 편의시설 정보는 장소를 클릭하면 실시간으로 더 자세히 불러와요!
          </p>
          <button type="button" onClick={reset} className="mt-4 rounded-full bg-coral px-5 py-2 text-sm font-bold text-white hover:bg-coral-dark">
            조건 초기화
          </button>
        </div>
      )}
    </section>
  );
}