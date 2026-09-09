import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUSES } from '@/lib/leads';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, relativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Pagination } from '@/components/ui/Pagination';
import { AdminLeadFilters } from './AdminLeadFilters';

export const metadata: Metadata = {
  title: 'Enquiries',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const page = Math.max(1, Number(single('page') ?? '1') || 1);
  const q = single('q');
  const status = single('status');
  const owner = single('owner');
  const filter = single('filter');

  const where: Prisma.LeadWhereInput = {
    ...(status ? { status: status as Prisma.EnumLeadStatusFilter['equals'] } : {}),
    ...(owner === 'unassigned' ? { assignedToId: null } : owner ? { assignedToId: owner } : {}),
    ...(filter === 'overdue'
      ? { status: { notIn: ['WON', 'LOST'] }, nextActionAt: { lt: new Date() } }
      : {}),
    ...(filter === 'open' ? { status: { notIn: ['WON', 'LOST'] } } : {}),
    ...(q
      ? {
          OR: [
            { ref: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, leads, staff, base, statusCounts] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        ref: true,
        status: true,
        source: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        score: true,
        estimatedValue: true,
        nextActionAt: true,
        createdAt: true,
        truck: { select: { title: true, stockNumber: true, priceNet: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    getBaseCurrency(),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader
        title="Enquiries"
        description={`${total} matching ${total === 1 ? 'enquiry' : 'enquiries'}`}
        action={
          <Link href="/admin/pipeline" className="btn-secondary btn-sm">
            Pipeline view
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/leads?filter=overdue"
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            filter === 'overdue'
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
          }`}
        >
          Needs follow-up
        </Link>
        {LEAD_STATUSES.map((entry) => (
          <Link
            key={entry}
            href={status === entry ? '/admin/leads' : `/admin/leads?status=${entry}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              status === entry
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
            }`}
          >
            {LEAD_STATUS_LABELS[entry]}{' '}
            <span className="tabular-nums text-steel-400">{byStatus[entry] ?? 0}</span>
          </Link>
        ))}
      </div>

      <AdminCard padded={false}>
        <div className="border-b border-steel-200 p-4">
          <AdminLeadFilters staff={staff} />
        </div>

        <TableWrap>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Contact</Th>
              <Th>Interest</Th>
              <Th align="right">Value</Th>
              <Th align="center">Score</Th>
              <Th>Owner</Th>
              <Th>Next action</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <EmptyRow colSpan={8} message="No enquiries match those filters." />
            ) : (
              leads.map((lead) => {
                const overdue =
                  lead.nextActionAt &&
                  lead.nextActionAt < new Date() &&
                  !['WON', 'LOST'].includes(lead.status);

                return (
                  <tr key={lead.id} className="hover:bg-steel-50">
                    <Td>
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {lead.ref}
                      </Link>
                      <span className="block text-xs text-steel-400">
                        {formatDate(lead.createdAt)} · {LEAD_SOURCE_LABELS[lead.source]}
                      </span>
                    </Td>
                    <Td>
                      <span className="block truncate font-medium text-steel-900">
                        {lead.firstName} {lead.lastName}
                      </span>
                      <span className="block truncate text-xs text-steel-400">
                        {lead.company ? `${lead.company} · ` : ''}
                        {lead.phone}
                        {lead.email ? ` · ${lead.email}` : ''}
                      </span>
                    </Td>
                    <Td className="max-w-56">
                      {lead.truck ? (
                        <>
                          <span className="block truncate text-xs">{lead.truck.title}</span>
                          <span className="block text-xs text-steel-400">{lead.truck.stockNumber}</span>
                        </>
                      ) : (
                        <span className="text-xs text-steel-400">General enquiry</span>
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                      {lead.estimatedValue ?? lead.truck?.priceNet
                        ? formatMoney(lead.estimatedValue ?? lead.truck?.priceNet ?? 0, base)
                        : '—'}
                    </Td>
                    <Td align="center">
                      <span
                        className={
                          lead.score >= 70
                            ? 'font-semibold text-emerald-600'
                            : lead.score >= 40
                              ? 'font-medium text-amber-600'
                              : 'text-steel-400'
                        }
                      >
                        {lead.score}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {lead.assignedTo ? (
                        `${lead.assignedTo.firstName} ${lead.assignedTo.lastName.charAt(0)}.`
                      ) : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {lead.nextActionAt ? (
                        <span className={overdue ? 'font-medium text-red-600' : 'text-steel-500'}>
                          {relativeTime(lead.nextActionAt)}
                        </span>
                      ) : (
                        <span className="text-steel-300">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          lead.status === 'NEW'
                            ? 'info'
                            : lead.status === 'WON'
                              ? 'success'
                              : lead.status === 'LOST'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {LEAD_STATUS_LABELS[lead.status]}
                      </Badge>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </AdminCard>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        searchParams={params}
        basePath="/admin/leads"
      />
    </div>
  );
}
