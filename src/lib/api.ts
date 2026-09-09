import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type output as ZodOutput } from 'zod';
import { isProduction } from './env';
import { verifyCsrf } from './csrf';
import { rateLimit, rateLimitHeaders, type RateLimitName } from './rate-limit';
import { getCurrentUser, hasRole, type SessionUser } from './auth';
import type { Role } from '@prisma/client';

/** Uniform JSON envelope so the client can handle every endpoint the same way. */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(
  error: string,
  status = 400,
  extra: { code?: string; fieldErrors?: Record<string, string[]>; headers?: Record<string, string> } = {},
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false as const, error, code: extra.code, fieldErrors: extra.fieldErrors },
    { status, headers: extra.headers },
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = () => fail('You need to sign in to do that.', 401, { code: 'UNAUTHENTICATED' });
export const forbidden = () => fail('You do not have permission to do that.', 403, { code: 'FORBIDDEN' });
export const notFound = (what = 'Resource') => fail(`${what} not found.`, 404, { code: 'NOT_FOUND' });

/**
 * Wraps a route handler with error normalisation. Unexpected errors are logged
 * server-side and reported generically so internals never leak to the client.
 */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.message, error.status, { code: error.code });
      }
      if (error instanceof ZodError) {
        return fail('Please check the highlighted fields.', 422, {
          code: 'VALIDATION_ERROR',
          fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
        });
      }
      console.error('[api] Unhandled error:', error);
      return fail(
        isProduction ? 'Something went wrong. Please try again.' : String(error),
        500,
        { code: 'INTERNAL_ERROR' },
      );
    }
  };
}

/**
 * Parses and validates a JSON body, throwing a ZodError the wrapper converts.
 *
 * Generic over the schema rather than its type so that schemas which transform
 * their input (e.g. "12,500" -> 1250000) resolve to the *output* type.
 */
export async function parseJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ZodOutput<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
  return schema.parse(body);
}

/** Parses and validates a form submission. */
export async function parseForm<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ZodOutput<S>> {
  const form = await request.formData();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key === '_csrf') continue;
    if (key in raw) {
      const existing = raw[key];
      raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      raw[key] = value;
    }
  }
  return schema.parse(raw);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    '0.0.0.0'
  );
}

/**
 * Standard guard for mutating endpoints: CSRF, then rate limit.
 * Returns a Response to short-circuit with, or null to continue.
 */
export async function guard(
  request: Request,
  options: { csrf?: boolean; limit?: RateLimitName; identifier?: string } = {},
): Promise<Response | null> {
  const { csrf = true, limit, identifier } = options;

  if (csrf) {
    const reason = await verifyCsrf(request);
    if (reason) {
      if (!isProduction) console.warn('[csrf]', reason);
      return fail('Your session has expired. Please refresh the page and try again.', 403, {
        code: 'CSRF_FAILED',
      });
    }
  }

  if (limit) {
    const result = await rateLimit(limit, identifier ?? clientIp(request));
    if (!result.ok) {
      return fail('Too many requests. Please wait a moment and try again.', 429, {
        code: 'RATE_LIMITED',
        headers: rateLimitHeaders(result),
      });
    }
  }

  return null;
}

/** Resolves the caller, or returns a 401/403 response. */
export async function requireApiUser(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return user;
}

export async function requireApiRole(minimum: Role): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!hasRole(user, minimum)) return forbidden();
  return user;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

/** Cursor/offset pagination parsing shared by list endpoints. */
export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit = 24, maxLimit = 96 } = {},
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const requested = Number(searchParams.get('limit') ?? String(defaultLimit)) || defaultLimit;
  const limit = Math.min(Math.max(1, requested), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
