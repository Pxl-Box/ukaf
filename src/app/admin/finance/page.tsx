import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, humanise } from '@/lib/utils';
import { Badge, Stat } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';

export const metadata: Metadata = {
  title: 'Finance enquiries',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  DECLINED: 'danger',
  WITHDRAWN: 'neutral',
};

export default async function AdminFinancePage() {
  await requireStaff();

  const [applications, base, counts] = await Promise.all([
    prisma.financeApplication.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        truck: { select: { id: true, title: true, stockNumber: true } },
        user: { select: { id: true } },
      },
    }),
    getBaseCurrency(),
    prisma.financeApplication.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all]));
  const pipelineValue = applications
    .filter((application) => !['DECLINED', 'WITHDRAWN'].includes(application.status))
    .reduce((sum, application) => sum + application.vehiclePriceNet, 0);

  return (
    <div>
      <AdminHeader
        title="Finance enquiries"
        description="Broker enquiries submitted through the site. No credit search is performed here — these are handed to the lender."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Open enquiries" value={(byStatus.SUBMITTED ?? 0) + (byStatus.UNDER_REVIEW ?? 0)} tone="info" />
        <Stat label="Approved" value={byStatus.APPROVED ?? 0} tone="success" />
        <Stat label="Declined" value={byStatus.DECLINED ?? 0} />
        <Stat label="Pipeline value" value={formatMoney(pipelineValue, base, { compact: true })} tone="info" />
      </div>

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Applicant</Th>
              <Th>Vehicle</Th>
              <Th align="right">Price</Th>
              <Th align="right">Deposit</Th>
              <Th align="center">Term</Th>
              <Th align="right">Est. monthly</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <EmptyRow colSpan={8} message="No finance enquiries yet." />
            ) : (
              applications.map((application) => (
                <tr key={application.id} className="hover:bg-steel-50">
                  <Td>
                    <span className="font-mono text-xs font-semibold text-steel-900">{application.ref}</span>
                    <span className="block text-xs text-steel-400">{formatDate(application.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="block truncate font-medium text-steel-900">
                      {application.firstName} {application.lastName}
                    </span>
                    <span className="block truncate text-xs text-steel-400">
                      {application.company ? `${application.company} · ` : ''}
                      {application.email}
                    </span>
                  </Td>
                  <Td className="max-w-56">
                    {application.truck ? (
                      <Link
                        href={`/admin/trucks/${application.truck.id}`}
                        className="block truncate text-xs text-brand-600 hover:underline"
                      >
                        {application.truck.title}
                      </Link>
                    ) : (
                      <span className="text-xs text-steel-400">Not specified</span>
                    )}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                    {formatMoney(application.vehiclePriceNet, base)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                    {formatMoney(application.depositNet, base)}
                  </Td>
                  <Td align="center" className="whitespace-nowrap text-xs">
                    {application.termMonths} mo
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums text-xs font-medium">
                    {application.estimatedMonthly ? formatMoney(application.estimatedMonthly, base) : '—'}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[application.status] ?? 'neutral'}>
                      {humanise(application.status)}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </AdminCard>

      <p className="mt-3 text-xs leading-relaxed text-steel-400">
        Figures are indicative only, calculated at the representative APR set in{' '}
        <Link href="/admin/settings" className="underline hover:text-brand-600">
          settings
        </Link>
        . The lender&rsquo;s decision and terms take precedence.
      </p>
    </div>
  );
}
