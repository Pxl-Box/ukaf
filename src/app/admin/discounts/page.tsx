import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { AdminHeader } from '@/components/admin/shell';
import { Alert } from '@/components/ui/primitives';
import { DiscountManager } from './DiscountManager';

export const metadata: Metadata = {
  title: 'Discounts',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDiscountsPage() {
  await requireRole('MANAGER', '/admin/discounts');

  const [discounts, base] = await Promise.all([
    prisma.discount.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] }),
    getBaseCurrency(),
  ]);

  return (
    <div>
      <AdminHeader
        title="Discount codes"
        description="Codes that can be applied against a reservation deposit or purchase."
      />

      <Alert tone="info" className="mb-4">
        Codes are entered at checkout and validated server-side against their limits and dates. Percentage codes are
        stored as whole numbers; fixed codes in {base.code}.
      </Alert>

      <DiscountManager
        discounts={discounts.map((discount) => ({
          id: discount.id,
          code: discount.code,
          description: discount.description ?? '',
          type: discount.type,
          value: discount.type === 'PERCENTAGE' ? discount.value : discount.value / 100,
          minSubtotal: discount.minSubtotal / 100,
          usageLimit: discount.usageLimit,
          usedCount: discount.usedCount,
          startsAt: discount.startsAt ? discount.startsAt.toISOString().slice(0, 10) : '',
          expiresAt: discount.expiresAt ? discount.expiresAt.toISOString().slice(0, 10) : '',
          isActive: discount.isActive,
        }))}
        currencySymbol={base.symbol}
      />
    </div>
  );
}
