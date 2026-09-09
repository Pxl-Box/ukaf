import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { newsletterSchema } from '@/lib/validation';
import { signValue } from '@/lib/tokens';
import { sendNewsletterConfirmation } from '@/lib/email';

/**
 * Double opt-in newsletter signup.
 *
 * The address is stored as PENDING and only becomes SUBSCRIBED once the
 * confirmation link is followed, which is what PECR expects for marketing to
 * non-customers.
 */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'newsletter', identifier: clientIp(request) });
  if (blocked) return blocked;

  const input = await parseJson(request, newsletterSchema);

  if (input.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: input.email },
    select: { id: true, status: true },
  });

  if (existing?.status === 'SUBSCRIBED') {
    return ok({ subscribed: true, alreadySubscribed: true, message: 'You are already on the list.' });
  }

  await prisma.newsletterSubscriber.upsert({
    where: { email: input.email },
    create: { email: input.email, status: 'PENDING', source: input.source || 'website' },
    update: { status: 'PENDING', unsubscribedAt: null },
  });

  // Stateless signed link — no token row to store or expire.
  const token = signValue(input.email, 'newsletter-confirm');
  await sendNewsletterConfirmation(input.email, token);

  return ok({
    subscribed: false,
    pending: true,
    message: 'Almost there — check your inbox and confirm your subscription.',
  });
});
