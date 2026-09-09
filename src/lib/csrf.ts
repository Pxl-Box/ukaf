import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { generateToken, safeCompare } from './tokens';
import { env, isProduction } from './env';

/**
 * CSRF protection: signed double-submit cookie plus a strict Origin check.
 *
 * The token lives in a readable cookie (the client mirrors it into a header or
 * hidden form field). Because an attacker's page cannot read our cookie under
 * the same-origin policy, matching values prove the request came from our own
 * front-end. The Origin check is the belt to that pair of braces.
 */

export const CSRF_COOKIE = 'ukaf_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_FIELD = '_csrf';

const CSRF_TTL_SECONDS = 60 * 60 * 8;

/**
 * Reads the current CSRF token, minting one if absent. Call from a Server
 * Component or Server Action — Next.js forbids cookie writes during render of
 * a statically generated route, so failures are swallowed and a token is still
 * returned for the form.
 */
export async function ensureCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

  const token = generateToken(24);
  try {
    cookieStore.set(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: CSRF_TTL_SECONDS,
    });
  } catch {
    // Rendering context does not allow Set-Cookie; the middleware seeds it instead.
  }
  return token;
}

export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE)?.value ?? null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Verifies a state-changing request. Returns null when valid, or a human
 * readable reason when it should be rejected with 403.
 */
export async function verifyCsrf(request: NextRequest | Request): Promise<string | null> {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  // 1. Origin / Referer must match the configured site origin.
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const expectedOrigin = new URL(env.siteUrl).origin;

  const candidate = origin ?? (referer ? safeOrigin(referer) : null);
  if (!candidate) {
    return 'Missing Origin header on a state-changing request.';
  }
  if (candidate !== expectedOrigin && !isLocalhostPair(candidate, expectedOrigin)) {
    return 'Request origin is not allowed.';
  }

  // 2. Double-submit token.
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  if (!cookieToken) return 'CSRF token cookie is missing. Please reload the page.';

  let submitted = request.headers.get(CSRF_HEADER);

  if (!submitted) {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('form')) {
      // Clone so the caller can still read the body.
      const form = await request.clone().formData();
      const field = form.get(CSRF_FIELD);
      submitted = typeof field === 'string' ? field : null;
    }
  }

  if (!submitted) return 'CSRF token was not supplied.';
  if (!safeCompare(submitted, cookieToken)) return 'CSRF token mismatch.';

  return null;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Treats http://localhost:3000 and http://127.0.0.1:3000 as equivalent in dev. */
function isLocalhostPair(a: string, b: string): boolean {
  if (isProduction) return false;
  const local = (value: string) => value.replace('127.0.0.1', 'localhost');
  return local(a) === local(b);
}
