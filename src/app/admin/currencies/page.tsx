import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/utils';
import { AdminCard, AdminHeader } from '@/components/admin/shell';
import { Alert } from '@/components/ui/primitives';
import { CurrencyManager } from './CurrencyManager';

export const metadata: Metadata = {
  title: 'Currencies',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCurrenciesPage() {
  await requireRole('MANAGER', '/admin/currencies');

  const [currencies, snapshots] = await Promise.all([
    prisma.currency.findMany({
      orderBy: [{ isBase: 'desc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { orders: true } } },
    }),
    prisma.fxRateSnapshot.findMany({
      orderBy: { capturedAt: 'desc' },
      take: 12,
      select: { id: true, currencyCode: true, rateToBase: true, source: true, capturedAt: true },
    }),
  ]);

  const base = currencies.find((currency) => currency.isBase);

  return (
    <div>
      <AdminHeader
        title="Currencies & exchange rates"
        description="Prices are stored once in the base currency and converted for display. Orders record the rate used at the moment of sale."
      />

      {!base ? (
        <Alert tone="danger" title="No base currency is set" className="mb-4">
          One currency must be marked as the base. Run the seed script or set the flag directly in the database.
        </Alert>
      ) : (
        <Alert tone="info" className="mb-4">
          <strong>{base.code}</strong> is the base currency: all catalogue prices are stored in {base.code} and every
          rate below is expressed as &ldquo;how many units of that currency equal one {base.code}&rdquo;.
        </Alert>
      )}

      <CurrencyManager
        currencies={currencies.map((currency) => ({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          rateToBase: Number(currency.rateToBase),
          decimals: currency.decimals,
          roundTo: currency.roundTo,
          isBase: currency.isBase,
          isActive: currency.isActive,
          sortOrder: currency.sortOrder,
          orderCount: currency._count.orders,
          updatedAt: currency.updatedAt.toISOString(),
        }))}
        baseCode={base?.code ?? env.baseCurrency}
        providerConfigured={Boolean(env.fx.apiUrl)}
      />

      <AdminCard title="Recent rate changes" className="mt-4">
        {snapshots.length === 0 ? (
          <p className="py-6 text-center text-sm text-steel-400">No rate history yet.</p>
        ) : (
          <ul className="divide-y divide-steel-100 text-sm">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-medium text-steel-800">
                  {snapshot.currencyCode}{' '}
                  <span className="ml-1 font-normal tabular-nums text-steel-600">
                    {Number(snapshot.rateToBase).toFixed(6)}
                  </span>
                </span>
                <span className="text-xs text-steel-400">
                  {snapshot.source} · {formatDateTime(snapshot.capturedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
