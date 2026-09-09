import { prisma } from '@/lib/db';
import { guard, handler, isResponse, ok, parseJson, requireApiUser } from '@/lib/api';
import { updateProfileSchema } from '@/lib/validation';
import { getActiveCurrencies } from '@/lib/currency';
import { recordAudit, diffRecords } from '@/lib/audit';

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const user = await requireApiUser();
  if (isResponse(user)) return user;

  const input = await parseJson(request, updateProfileSchema);

  // Only accept a currency we actually offer.
  let preferredCurrency: string | undefined;
  if (input.preferredCurrency) {
    const currencies = await getActiveCurrencies();
    if (currencies.some((currency) => currency.code === input.preferredCurrency)) {
      preferredCurrency = input.preferredCurrency;
    }
  }

  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      vatNumber: true,
      marketingOptIn: true,
      preferredCurrency: true,
    },
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      companyName: input.companyName || null,
      vatNumber: input.vatNumber || null,
      marketingOptIn: input.marketingOptIn,
      ...(preferredCurrency ? { preferredCurrency } : {}),
    },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      vatNumber: true,
      marketingOptIn: true,
      preferredCurrency: true,
    },
  });

  // Keep the newsletter list in step with the marketing preference.
  if (input.marketingOptIn) {
    await prisma.newsletterSubscriber
      .upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          status: 'SUBSCRIBED',
          source: 'account-profile',
          confirmedAt: new Date(),
        },
        update: { status: 'SUBSCRIBED', unsubscribedAt: null },
      })
      .catch(() => undefined);
  } else if (before?.marketingOptIn) {
    await prisma.newsletterSubscriber
      .updateMany({
        where: { email: user.email },
        data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
      })
      .catch(() => undefined);
  }

  await recordAudit({
    action: 'user.updated',
    actor: { id: user.id, email: user.email },
    entity: 'User',
    entityId: user.id,
    summary: 'Profile updated',
    metadata: before ? diffRecords(before, updated) : undefined,
  });

  return ok({ saved: true, profile: updated });
});
