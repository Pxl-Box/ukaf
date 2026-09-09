import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from './db';
import { env, isProduction } from './env';
import { BASE_CURRENCY_CODE, FALLBACK_CURRENCY, type CurrencyInfo } from './money';

export const CURRENCY_COOKIE = 'ukaf_currency';
const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Currency rows change rarely but are read on virtually every request, so they
 * are cached in module scope for a short TTL on top of React's per-request
 * cache. `revalidateCurrencies()` clears it after an admin edit.
 */
let currencyCache: { data: CurrencyInfo[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function toCurrencyInfo(row: {
  code: string;
  name: string;
  symbol: string;
  rateToBase: unknown;
  decimals: number;
  isBase: boolean;
  roundTo: number;
}): CurrencyInfo {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    rateToBase: Number(row.rateToBase),
    decimals: row.decimals,
    isBase: row.isBase,
    roundTo: row.roundTo,
  };
}

export async function getActiveCurrencies(): Promise<CurrencyInfo[]> {
  if (currencyCache && currencyCache.expiresAt > Date.now()) {
    return currencyCache.data;
  }

  try {
    const rows = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: [{ isBase: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });

    const data = rows.length > 0 ? rows.map(toCurrencyInfo) : [FALLBACK_CURRENCY];
    currencyCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  } catch {
    // Database unavailable (e.g. during a build with no DATABASE_URL).
    return [FALLBACK_CURRENCY];
  }
}

export function revalidateCurrencies(): void {
  currencyCache = null;
}

export async function getBaseCurrency(): Promise<CurrencyInfo> {
  const currencies = await getActiveCurrencies();
  return currencies.find((currency) => currency.isBase) ?? currencies[0] ?? FALLBACK_CURRENCY;
}

export async function getCurrencyByCode(code: string): Promise<CurrencyInfo | null> {
  const currencies = await getActiveCurrencies();
  return currencies.find((currency) => currency.code === code.toUpperCase()) ?? null;
}

/**
 * Resolves the currency to present prices in: the `ukaf_currency` cookie when
 * it names an active currency, otherwise the base currency.
 *
 * Memoised per request so a page rendering fifty price tags issues one query.
 */
export const getDisplayCurrency = cache(async (): Promise<CurrencyInfo> => {
  const currencies = await getActiveCurrencies();
  const cookieStore = await cookies();
  const preferred = cookieStore.get(CURRENCY_COOKIE)?.value?.toUpperCase();

  if (preferred) {
    const match = currencies.find((currency) => currency.code === preferred);
    if (match) return match;
  }

  return (
    currencies.find((currency) => currency.isBase) ??
    currencies.find((currency) => currency.code === BASE_CURRENCY_CODE) ??
    currencies[0] ??
    FALLBACK_CURRENCY
  );
});

/** Cookie options shared by the switcher route handler. */
export const currencyCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: CURRENCY_COOKIE_MAX_AGE,
};

/**
 * Rewrites stored rates from an upstream provider. Rates are expressed as
 * units-per-base; a provider quoting against a different base is normalised
 * before being written.
 */
export async function refreshRatesFromProvider(): Promise<{ updated: number; skipped: string[] }> {
  if (!env.fx.apiUrl) {
    return { updated: 0, skipped: ['FX_API_URL not configured'] };
  }

  const base = await getBaseCurrency();
  const url = new URL(env.fx.apiUrl);
  url.searchParams.set('base', base.code);
  if (env.fx.apiKey) url.searchParams.set('access_key', env.fx.apiKey);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`FX provider responded ${response.status}`);
  }

  const payload = (await response.json()) as { rates?: Record<string, number>; base?: string };
  const rates = payload.rates ?? {};
  const providerBase = (payload.base ?? base.code).toUpperCase();
  const normaliser = providerBase === base.code ? 1 : rates[base.code] ?? 1;

  const currencies = await prisma.currency.findMany({ where: { isActive: true } });
  const skipped: string[] = [];
  let updated = 0;

  for (const currency of currencies) {
    if (currency.isBase) continue;
    const raw = rates[currency.code];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
      skipped.push(currency.code);
      continue;
    }

    const rateToBase = raw / normaliser;
    await prisma.$transaction([
      prisma.currency.update({
        where: { code: currency.code },
        data: { rateToBase },
      }),
      prisma.fxRateSnapshot.create({
        data: { currencyCode: currency.code, rateToBase, source: 'api' },
      }),
    ]);
    updated += 1;
  }

  revalidateCurrencies();
  return { updated, skipped };
}
