import type { FetchResult } from './types.ts';

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;     // 네트워크 오류/5xx에만 적용, 기본 2
  maxBytes?: number;       // 기본 2MB
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i;

export function validateOfficialUrl(raw: string):
  | { ok: true; url: URL }
  | { ok: false; kind: 'invalid_url' | 'blocked_private'; detail: string } {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, kind: 'invalid_url', detail: 'URL 형식 오류' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, kind: 'invalid_url', detail: 'http/https만 허용' };
  if (PRIVATE_HOST.test(url.hostname)) return { ok: false, kind: 'blocked_private', detail: '내부 주소 접근 금지' };
  return { ok: true, url };
}

/** 사이트 차단(403/429/401)은 우회하지 않고 그대로 실패로 기록한다. */
export async function fetchOfficialPage(rawUrl: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const v = validateOfficialUrl(rawUrl);
  if (!v.ok) return v;
  const f = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 2;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  let last: FetchResult = { ok: false, kind: 'network', detail: '시도 없음' };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await f(v.url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': opts.userAgent ?? 'SihwanlogCheckBot/0.1', accept: 'text/html' },
      });
      if ([401, 403, 429].includes(res.status)) return { ok: false, kind: 'blocked_by_site', detail: `HTTP ${res.status} (우회하지 않음)` };
      if (res.status >= 500) { last = { ok: false, kind: 'http_error', detail: `HTTP ${res.status}` }; continue; }
      if (!res.ok) return { ok: false, kind: 'http_error', detail: `HTTP ${res.status}` };
      const ctype = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml/i.test(ctype)) return { ok: false, kind: 'not_html', detail: `content-type: ${ctype || '없음'} (PDF 등은 수동 확인)` };
      const body = await res.text();
      if (body.length > maxBytes) return { ok: false, kind: 'too_large', detail: `${body.length} bytes` };
      return { ok: true, html: body, finalUrl: res.url || v.url.toString(), fetchedAt: new Date().toISOString() };
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError';
      last = { ok: false, kind: aborted ? 'timeout' : 'network', detail: aborted ? '시간 초과' : String((e as Error)?.message ?? e) };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}
