import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, ok, parseJson } from '@/lib/api';
import { CURRENCY_COOKIE, currencyCookieOptions, getActiveCurrencies } from '@/lib/currency';
import { getCurrentUser } from '@/lib/auth';
import { currencyCodeSchema } from '@/lib/validation';

/** Lists the currencies a visitor may switch to. */
export const GET = handler(async () => {
  const currencies = await getActiveCurrencies();
  return ok(
    currencies.map((currency) => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isBase: currency.isBase,
    })),
  );
});

/** Sets the display currency, and remembers it on the account when signed in. */
export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'api' });
  if (blocked) return blocked;

  const { code } = await parseJson(request, z.object({ code: currencyCodeSchema }));

  const currencies = await getActiveCurrencies();
  const match = currencies.find((currency) => currency.code === code);
  if (!match) {
    return fail('That currency is not available.', 400, { code: 'UNKNOWN_CURRENCY' });
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENCY_COOKIE, match.code, currencyCookieOptions);

  const user = await getCurrentUser();
  if (user) {
    await prisma.user
      .update({ where: { id: user.id }, data: { preferredCurrency: match.code } })
      .catch(() => undefined);
  }

  return ok({ code: match.code, symbol: match.symbol, name: match.name });
});
