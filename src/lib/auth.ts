import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Role, User } from '@prisma/client';
import { prisma } from './db';
import { generateToken, hashToken, signValue, verifySignedValue } from './tokens';
import { isProduction } from './env';

export const SESSION_COOKIE = '__Host-ukaf_session';
/** Fallback name for http:// development, where the __Host- prefix is invalid. */
export const SESSION_COOKIE_DEV = 'ukaf_session';

export const sessionCookieName = isProduction ? SESSION_COOKIE : SESSION_COOKIE_DEV;

/** 30 days, refreshed on activity. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sessions idle for longer than this are treated as dead. */
const SESSION_IDLE_MS = 14 * 24 * 60 * 60 * 1000;
/** Only touch lastSeenAt at most once an hour to avoid a write per request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'status'
  | 'emailVerifiedAt'
  | 'preferredCurrency'
  | 'companyName'
  | 'phone'
  | 'stripeCustomerId'
>;

const SESSION_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  preferredCurrency: true,
  companyName: true,
  phone: true,
  stripeCustomerId: true,
} as const;

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

/** Best-effort client IP from proxy headers. */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    headerList.get('cf-connecting-ip') ||
    null;
  return { ipAddress, userAgent: headerList.get('user-agent') };
}

/**
 * Issues a new session and sets the cookie. The raw token never touches the
 * database — only its HMAC does.
 */
export async function createSession(userId: string, context?: RequestContext): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent?.slice(0, 500) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

/**
 * Resolves the current session. Memoised per request with React `cache` so
 * layouts, pages and route handlers share a single query.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      user: { select: SESSION_USER_SELECT },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > SESSION_IDLE_MS) return null;
  if (session.user.status !== 'ACTIVE') return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Sliding expiry — deliberately not awaited on the critical path.
    void prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => undefined);
  }

  return { user: session.user, sessionId: session.id };
});

/** Signs a short-lived challenge identifying which user an MFA code belongs to. */
export function createMfaChallenge(userId: string): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + 10 * 60 * 1000 });
  return signValue(payload, 'mfa-login');
}

/** Resolves a challenge back to its user id, or null if invalid/expired. */
export function readMfaChallenge(mfaToken: string): string | null {
  const payload = verifySignedValue(mfaToken, 'mfa-login');
  if (!payload) return null;
  try {
    const { uid, exp } = JSON.parse(payload) as { uid: string; exp: number };
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** Revokes the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  cookieStore.set(sessionCookieName, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/** Revokes every session for a user — used on password change and by admins. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  SALES: 10,
  MANAGER: 20,
  ADMIN: 30,
  SUPERADMIN: 40,
};

export function hasRole(user: { role: Role } | null | undefined, minimum: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

/** Any role that may enter the /admin area. */
export function isStaff(user: { role: Role } | null | undefined): boolean {
  return hasRole(user, 'SALES');
}

/**
 * Guard for pages. Redirects to login (preserving the intended destination)
 * when unauthenticated, or to a 403 page when under-privileged.
 */
export async function requireUser(redirectTo = '/account'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}

export async function requireRole(minimum: Role, redirectTo = '/admin'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  if (!hasRole(user, minimum)) {
    redirect('/403');
  }
  return user;
}

export async function requireStaff(redirectTo = '/admin'): Promise<SessionUser> {
  return requireRole('SALES', redirectTo);
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: { firstName: string; lastName: string }): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  SALES: 'Sales executive',
  MANAGER: 'Sales manager',
  ADMIN: 'Administrator',
  SUPERADMIN: 'Owner',
};
