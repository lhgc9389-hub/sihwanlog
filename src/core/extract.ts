import type { Extracted } from './types.ts';

const ENT: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|table|ul|ol|section)>|<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m] ?? m)
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const num = (s: string) => s.replace(/[^\d]/g, '');

function collect(text: string, re: RegExp, pick: (m: RegExpExecArray) => string) {
  const found = new Map<string, string>();
  for (const m of text.matchAll(new RegExp(re.source, 'g'))) {
    const v = pick(m as RegExpExecArray);
    if (!found.has(v)) found.set(v, m[0].trim());
  }
  return found;
}

/**
 * 보수적 추출: 확실히 읽히는 것만 high, 값이 여러 개로 갈리면 low(관리자 검토).
 * 못 읽으면 아무것도 반환하지 않는다 (추정 금지).
 */
export function extractFields(html: string): Extracted[] {
  const text = htmlToText(html);
  const out: Extracted[] = [];

  const money = (field: 'adult_fee' | 'child_fee', words: string) => {
    const re = new RegExp(`(?:${words})[^\\n\\d]{0,10}([\\d,]{3,9})\\s*원`);
    const found = collect(text, re, (m) => num(m[1]));
    if (found.size === 0) return;
    const values = [...found.keys()];
    out.push({
      field,
      value: values.join(' / '),
      confidence: values.length === 1 ? 'high' : 'low',
      evidence: [...found.values()].join(' | ').slice(0, 300),
    });
  };
  money('adult_fee', '성인|어른|대인|일반');
  money('child_fee', '어린이|아동|청소년|소인');

  const infant = text.match(/[^\n]*(?:영유아|유아|만\s?\d+\s?세\s?(?:이하|미만)|\d+\s?개월\s?(?:이하|미만))[^\n]{0,20}무료[^\n]*/);
  if (infant) out.push({ field: 'infant_free', value: infant[0].slice(0, 120), confidence: 'high', evidence: infant[0].slice(0, 300) });

  const hours = collect(
    text,
    /(?:운영시간|관람시간|이용시간|개관시간)\s*[:：]?\s*([0-2]?\d:[0-5]\d\s*[~\-–]\s*[0-2]?\d:[0-5]\d)/,
    (m) => m[1].replace(/\s+/g, ''),
  );
  if (hours.size) {
    const v = [...hours.keys()];
    out.push({ field: 'opening_hours', value: v.join(' / '), confidence: v.length === 1 ? 'high' : 'low', evidence: [...hours.values()].join(' | ').slice(0, 300) });
  }

  const closed = collect(text, /(?:휴관일|휴무일|정기휴무|정기휴관)\s*[:：]?\s*([^\n]{1,40})/, (m) => m[1].trim());
  if (closed.size) {
    const v = [...closed.keys()];
    out.push({ field: 'closed_days', value: v.join(' / '), confidence: v.length === 1 ? 'high' : 'low', evidence: [...closed.values()].join(' | ').slice(0, 300) });
  }

  // 편의시설은 "있음/없음"을 단정하지 않고 항상 low → 관리자 확인
  for (const [field, word] of [['nursing_room', '수유실'], ['diaper_station', '기저귀\\s?교환대']] as const) {
    const m = text.match(new RegExp(`[^\\n]*${word}[^\\n]*`));
    if (m) out.push({ field, value: `홈페이지에 언급됨: ${m[0].slice(0, 80)}`, confidence: 'low', evidence: m[0].slice(0, 300) });
  }
  return out;
}
