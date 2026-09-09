/**
 * Browser-side fetch helper.
 *
 * Mirrors the CSRF cookie into the `x-csrf-token` header on every mutating
 * request and unwraps the standard { ok, data | error } envelope so callers
 * only deal with a value or a thrown error.
 */

export const CSRF_COOKIE = 'ukaf_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const method = (rest.method ?? (json ? 'POST' : 'GET')).toUpperCase();

  const requestHeaders = new Headers(headers);
  if (json !== undefined) requestHeaders.set('content-type', 'application/json');

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) requestHeaders.set(CSRF_HEADER, token);
  }

  const response = await fetch(url, {
    ...rest,
    method,
    headers: requestHeaders,
    credentials: 'same-origin',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. an HTML error page from a proxy).
  }

  if (!response.ok || !payload || payload.ok === false) {
    const message =
      payload && payload.ok === false ? payload.error : `Request failed (${response.status}).`;
    throw new ApiClientError(
      message,
      response.status,
      payload && payload.ok === false ? payload.code : undefined,
      payload && payload.ok === false ? payload.fieldErrors : undefined,
    );
  }

  return payload.data;
}

/** Local-storage backed list of vehicle ids in the comparison tray. */
export const COMPARE_KEY = 'ukaf_compare';
export const COMPARE_LIMIT = 4;

export function readCompare(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string').slice(0, COMPARE_LIMIT) : [];
  } catch {
    return [];
  }
}

export function writeCompare(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, COMPARE_LIMIT)));
    window.dispatchEvent(new CustomEvent('ukaf:compare-changed', { detail: ids }));
  } catch {
    // Storage disabled (private browsing) — comparison simply will not persist.
  }
}
