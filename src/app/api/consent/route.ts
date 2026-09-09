import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { clientIp, guard, handler, ok, parseJson } from '@/lib/api';
import { cookieConsentSchema } from '@/lib/validation';
import { CONSENT_ANON_COOKIE, CONSENT_COOKIE, CONSENT_MAX_AGE, serialiseConsent } from '@/lib/consent';
import { getCurrentUser, getRequestContext } from '@/lib/auth';
import { digest, generateToken } from '@/lib/tokens';
import { isProduction } from '@/lib/env';
import { POLICY_VERSION } from '@/lib/settings';

/**
 * Records a cookie consent decision.
 *
 * Two things happen: the browser gets a preference cookie that gates optional
 * scripts, and the database gets an immutable record of the decision so the
 * business can evidence consent under UK GDPR Article 7(1). The visitor's IP is
 * stored only as a salted hash.
 */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const input = await parseJson(request, cookieConsentSchema);
  const cookieStore = await cookies();

  const categories = {
    necessary: true as const,
    analytics: input.analytics,
    marketing: input.marketing,
    preferences: input.preferences,
  };

  cookieStore.set(CONSENT_COOKIE, serialiseConsent(categories), {
    httpOnly: false, // the banner reads it to decide whether to show
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: CONSENT_MAX_AGE,
  });

  // Clear preference-scoped cookies the visitor has just withdrawn consent for.
  if (!input.preferences) {
    cookieStore.set('ukaf_compare', '', { path: '/', maxAge: 0 });
  }

  let anonId = cookieStore.get(CONSENT_ANON_COOKIE)?.value;
  if (!anonId) {
    anonId = generateToken(16);
    cookieStore.set(CONSENT_ANON_COOKIE, anonId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: CONSENT_MAX_AGE,
    });
  }

  const [user, context] = await Promise.all([getCurrentUser(), getRequestContext()]);
  const ip = context.ipAddress ?? clientIp(request);

  await prisma.cookieConsent
    .create({
      data: {
        userId: user?.id ?? null,
        anonId,
        analytics: input.analytics,
        marketing: input.marketing,
        preferences: input.preferences,
        policyVersion: input.policyVersion || POLICY_VERSION,
        ipHash: ip ? digest(ip).slice(0, 32) : null,
        userAgent: context.userAgent?.slice(0, 300) ?? null,
      },
    })
    .catch(() => undefined);

  return ok({ saved: true, ...categories, version: POLICY_VERSION });
});
