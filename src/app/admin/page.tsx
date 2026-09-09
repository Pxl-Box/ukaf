import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getSalesSummary, ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { getCrmSummary, LEAD_STATUS_LABELS } from '@/lib/leads';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, humanise, relativeTime } from '@/lib/utils';
import { Badge, Stat } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import {
  AlertIcon,
  ChartIcon,
  MailIcon,
  ReceiptIcon,
  TruckIcon,
} from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireStaff();

  const [sales, crm, base, stock, recentLeads, overdue] = await Promise.all([
    getSalesSummary(30),
    getCrmSummary(30),
    getBaseCurrency(),
    prisma.truck.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        ref: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        score: true,
        createdAt: true,
        truck: { select: { title: true } },
        assignedTo: { select: { firstName: true } },
      },
    }),
    // Same definition of "overdue" as the banner and /admin/leads?filter=overdue:
    // an open enquiry whose next action date has passed.
    prisma.lead.findMany({
      where: { status: { notIn: ['WON', 'LOST'] }, nextActionAt: { lt: new Date() } },
      orderBy: { nextActionAt: 'asc' },
      take: 5,
      select: {
        id: true,
        ref: true,
        firstName: true,
        lastName: true,
        company: true,
        nextActionAt: true,
        assignedTo: { select: { firstName: true } },
      },
    }),
  ]);

  const stockByStatus = Object.fromEntries(stock.map((entry) => [entry.status, entry._count._all]));
  const available = stockByStatus.AVAILABLE ?? 0;

  return (
    <div>
      <AdminHeader
        title="Dashboard"
        description="Trading and pipeline over the last 30 days."
        action={
          <Link href="/admin/trucks/new" className="btn-primary btn-sm">
            Add vehicle
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue (30 days)"
          value={formatMoney(sales.revenueBase, base, { compact: sales.revenueBase > 1_000_000_00 })}
          hint={`${sales.paidOrders} paid ${sales.paidOrders === 1 ? 'order' : 'orders'}`}
          tone="success"
          icon={<ReceiptIcon />}
        />
        <Stat
          label="Vehicles available"
          value={available}
          hint={`${stockByStatus.RESERVED ?? 0} reserved · ${stockByStatus.DRAFT ?? 0} draft`}
          icon={<TruckIcon />}
        />
        <Stat
          label="Open enquiries"
          value={crm.open}
          hint={`${crm.total} received in 30 days`}
          tone={crm.overdue > 0 ? 'warning' : 'neutral'}
          icon={<MailIcon />}
        />
        <Stat
          label="Conversion rate"
          value={`${crm.conversionRate}%`}
          hint={`${crm.won} won · ${crm.lost} lost`}
          tone="info"
          icon={<ChartIcon />}
        />
      </div>

      {crm.overdue > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertIcon className="text-base" />
            {crm.overdue} {crm.overdue === 1 ? 'enquiry needs' : 'enquiries need'} following up today
          </p>
          <Link href="/admin/leads?filter=overdue" className="btn-secondary btn-sm">
            Review now
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <AdminCard
          title="Recent orders"
          className="xl:col-span-2"
          padded={false}
          action={
            <Link href="/admin/orders" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          }
        >
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Type</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sales.recentOrders.length === 0 ? (
                <EmptyRow colSpan={5} message="No orders yet." />
              ) : (
                sales.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-steel-50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="block text-xs text-steel-400">{formatDate(order.createdAt)}</span>
                    </Td>
                    <Td>
                      <span className="block truncate">{order.billingName ?? '—'}</span>
                      <span className="block truncate text-xs text-steel-400">{order.billingEmail}</span>
                    </Td>
                    <Td className="text-xs">
                      {order.purchaseType === 'RESERVATION' ? 'Reservation' : 'Full purchase'}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {order.currencyCode} {(order.total / 100).toLocaleString('en-GB')}
                    </Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                        {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
                      </Badge>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </AdminCard>

        <AdminCard
          title="Overdue follow-ups"
          action={
            <Link href="/admin/leads" className="text-xs font-medium text-brand-600 hover:underline">
              All enquiries
            </Link>
          }
        >
          {overdue.length === 0 ? (
            <p className="py-8 text-center text-sm text-steel-400">Nothing overdue. Good work.</p>
          ) : (
            <ul className="space-y-3">
              {overdue.map((lead) => (
                <li key={lead.id} className="border-b border-steel-100 pb-3 last:border-0 last:pb-0">
                  <Link
                    href={`/admin/leads/${lead.id}`}
                    className="text-sm font-medium text-steel-900 hover:text-brand-700"
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                  <p className="text-xs text-steel-500">
                    {lead.company ? `${lead.company} · ` : ''}
                    {lead.ref}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-amber-700">
                    Due {relativeTime(lead.nextActionAt)}
                    {lead.assignedTo ? ` · ${lead.assignedTo.firstName}` : ' · unassigned'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title="Latest enquiries"
        className="mt-4"
        padded={false}
        action={
          <Link href="/admin/leads" className="text-xs font-medium text-brand-600 hover:underline">
            View all
          </Link>
        }
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Contact</Th>
              <Th>Vehicle</Th>
              <Th align="center">Score</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.length === 0 ? (
              <EmptyRow colSpan={6} message="No enquiries yet." />
            ) : (
              recentLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-steel-50">
                  <Td>
                    <Link href={`/admin/leads/${lead.id}`} className="font-medium text-brand-600 hover:underline">
                      {lead.ref}
                    </Link>
                    <span className="block text-xs text-steel-400">{relativeTime(lead.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="block truncate">
                      {lead.firstName} {lead.lastName}
                    </span>
                    {lead.company ? (
                      <span className="block truncate text-xs text-steel-400">{lead.company}</span>
                    ) : null}
                  </Td>
                  <Td className="max-w-56 truncate text-xs">{lead.truck?.title ?? 'General enquiry'}</Td>
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
                  <Td className="text-xs">{lead.assignedTo?.firstName ?? 'Unassigned'}</Td>
                  <Td>
                    <Badge tone={lead.status === 'NEW' ? 'info' : lead.status === 'WON' ? 'success' : 'neutral'}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </AdminCard>
    </div>
  );
}
