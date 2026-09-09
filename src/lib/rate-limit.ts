import { prisma } from './db';
import { digest } from './tokens';

/**
 * Fixed-window rate limiting.
 *
 * A process-local map absorbs bursts cheaply; the database table makes the
 * limit hold across multiple instances (serverless included). If the database
 * is unreachable we fall back to the in-memory result rather than failing the
 * request — availability beats perfect accounting for a login form.
 */

export type RateLimitRule = {
  /** Maximum number of requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  enquiry: { limit: 10, windowSeconds: 60 * 60 },
  newsletter: { limit: 5, windowSeconds: 60 * 60 },
  checkout: { limit: 20, windowSeconds: 60 * 60 },
  search: { limit: 120, windowSeconds: 60 },
  api: { limit: 300, windowSeconds: 60 },
  adminWrite: { limit: 240, windowSeconds: 60 },
  upload: { limit: 60, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window rolls over. */
  retryAfter: number;
  resetAt: Date;
};

type MemoryEntry = { count: number; resetAt: number };
const memory = new Map<string, MemoryEntry>();

function memoryCheck(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const existing = memory.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memory.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      retryAfter: 0,
      resetAt: new Date(resetAt),
    };
  }

  existing.count += 1;
  const ok = existing.count <= rule.limit;
  return {
    ok,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfter: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
    resetAt: new Date(existing.resetAt),
  };
}

/** Occasionally evict expired in-memory entries so the map cannot grow forever. */
function sweepMemory(): void {
  if (memory.size < 5000) return;
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
}

/**
 * Consumes one unit from the bucket identified by `name` + `identifier`
 * (typically an IP address, email, or user id).
 */
export async function rateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  const key = `${name}:${digest(identifier).slice(0, 32)}`;

  sweepMemory();
  const local = memoryCheck(key, rule);
  if (!local.ok) return local;

  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  try {
    const record = await prisma.rateLimit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    const ok = record.count <= rule.limit;
    return {
      ok,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - record.count),
      retryAfter: ok ? 0 : Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
      resetAt: expiresAt,
    };
  } catch {
    return local;
  }
}

/** Removes a bucket early, e.g. after a successful login. */
export async function clearRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const key = `${name}:${digest(identifier).slice(0, 32)}`;
  memory.delete(key);
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => undefined);
}

/** Housekeeping for the cron endpoint. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };
  if (!result.ok) headers['Retry-After'] = String(result.retryAfter);
  return headers;
}
