import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { currencySchema, currencyCodeSchema } from '@/lib/validation';
import { refreshRatesFromProvider, revalidateCurrencies } from '@/lib/currency';
import { recordAudit } from '@/lib/audit';

/**
 * Currency and FX rate administration.
 *
 * Rates are "units of this currency per 1 unit of the base currency", so the
 * base row is always exactly 1 and cannot be edited away.
 */

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, currencySchema);

  const existing = await prisma.currency.findUnique({ where: { code: input.code } });
  if (existing) {
    return fail('That currency already exists.', 409, {
      fieldErrors: { code: ['That currency already exists.'] },
    });
  }

  const currency = await prisma.currency.create({
    data: {
      code: input.code,
      name: input.name,
      symbol: input.symbol,
      rateToBase: input.rateToBase,
      decimals: input.decimals,
      roundTo: input.roundTo ?? 1,
      isActive: input.isActive,
      sortOrder: input.sortOrder ?? 0,
      isBase: false,
    },
  });

  await prisma.fxRateSnapshot.create({
    data: { currencyCode: currency.code, rateToBase: input.rateToBase, source: 'manual' },
  });

  revalidateCurrencies();

  await recordAudit({
    action: 'currency.updated',
    actor: user,
    entity: 'Currency',
    entityId: currency.code,
    summary: `Added ${currency.code} at ${input.rateToBase}`,
  });

  return ok({ currency: { ...currency, rateToBase: Number(currency.rateToBase) } });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const input = await parseJson(request, currencySchema);

  const existing = await prisma.currency.findUnique({ where: { code: input.code } });
  if (!existing) return notFound('Currency');

  // The base currency is the unit of account — its rate is 1 by definition.
  const rateToBase = existing.isBase ? 1 : input.rateToBase;

  if (existing.isBase && !input.isActive) {
    return fail('The base currency cannot be deactivated.', 400, { code: 'BASE_CURRENCY' });
  }

  const currency = await prisma.currency.update({
    where: { code: input.code },
    data: {
      name: input.name,
      symbol: input.symbol,
      rateToBase,
      decimals: input.decimals,
      roundTo: input.roundTo ?? 1,
      isActive: input.isActive,
      sortOrder: input.sortOrder ?? existing.sortOrder,
    },
  });

  if (Number(existing.rateToBase) !== Number(rateToBase)) {
    await prisma.fxRateSnapshot.create({
      data: { currencyCode: currency.code, rateToBase, source: 'manual' },
    });
  }

  revalidateCurrencies();

  await recordAudit({
    action: 'currency.updated',
    actor: user,
    entity: 'Currency',
    entityId: currency.code,
    summary: `${currency.code}: rate ${Number(existing.rateToBase)} → ${Number(rateToBase)}`,
  });

  return ok({ currency: { ...currency, rateToBase: Number(currency.rateToBase) } });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  const { code } = await parseJson(request, z.object({ code: currencyCodeSchema }));

  const currency = await prisma.currency.findUnique({
    where: { code },
    select: { code: true, isBase: true, _count: { select: { orders: true } } },
  });
  if (!currency) return notFound('Currency');

  if (currency.isBase) {
    return fail('The base currency cannot be removed.', 400, { code: 'BASE_CURRENCY' });
  }

  // Orders reference their currency for reporting — deactivate rather than delete.
  if (currency._count.orders > 0) {
    await prisma.currency.update({ where: { code }, data: { isActive: false } });
    revalidateCurrencies();

    return ok({
      deleted: false,
      deactivated: true,
      message: 'This currency is used by existing orders, so it was deactivated instead of deleted.',
    });
  }

  await prisma.currency.delete({ where: { code } });
  revalidateCurrencies();

  await recordAudit({
    action: 'currency.updated',
    actor: user,
    entity: 'Currency',
    entityId: code,
    summary: `Removed ${code}`,
  });

  return ok({ deleted: true, deactivated: false });
});

/** Pulls fresh rates from the configured FX provider. */
export const PUT = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('MANAGER');
  if (isResponse(user)) return user;

  try {
    const result = await refreshRatesFromProvider();

    await recordAudit({
      action: 'currency.rates_refreshed',
      actor: user,
      entity: 'Currency',
      summary: `Refreshed ${result.updated} rates from the FX provider`,
      metadata: { skipped: result.skipped },
    });

    return ok(result);
  } catch (error) {
    console.error('[admin] FX refresh failed:', error);
    return fail(
      error instanceof Error ? error.message : 'Could not reach the exchange rate provider.',
      502,
      { code: 'FX_PROVIDER_ERROR' },
    );
  }
});
