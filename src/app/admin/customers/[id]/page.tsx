import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { currencyFromRow, formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, relativeTime } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { LEAD_STATUS_LABELS } from '@/lib/leads';
import { Badge, DataRow, Stat } from '@/components/ui/primitives';
import { AdminCard, AdminHeader } from '@/components/admin/shell';

export const metadata: Metadata = {
  title: 'Customer',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff();

  const [customer, base] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        vatNumber: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
        preferredCurrency: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        notes: true,
        addresses: { orderBy: [{ isDefault: 'desc' }] },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: { currency: true, items: { select: { id: true, name: true, sku: true } } },
        },
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            ref: true,
            status: true,
            subject: true,
            createdAt: true,
            truck: { select: { title: true } },
          },
        },
        savedTrucks: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            truck: { select: { id: true, title: true, stockNumber: true, priceNet: true, status: true } },
          },
        },
      },
    }),
    getBaseCurrency(),
  ]);

  if (!customer) notFound();

  const paidOrders = customer.orders.filter((order) => order.paymentStatus === 'SUCCEEDED');
  const lifetime = paidOrders.reduce((sum, order) => sum + order.baseTotal, 0);

  return (
    <div>
      <AdminHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={`${customer.email} · registered ${formatDate(customer.createdAt)}`}
        breadcrumb={{ label: 'Back to customers', href: '/admin/customers' }}
        action={
          customer.status === 'SUSPENDED' ? (
            <Badge tone="danger">Suspended</Badge>
          ) : customer.emailVerifiedAt ? (
            <Badge tone="success">Verified</Badge>
          ) : (
            <Badge tone="warning">Email unverified</Badge>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Lifetime value" value={formatMoney(lifetime, base)} tone="success" />
        <Stat label="Orders" value={customer.orders.length} hint={`${paidOrders.length} paid`} />
        <Stat label="Enquiries" value={customer.leads.length} />
        <Stat label="Saved vehicles" value={customer.savedTrucks.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <AdminCard title="Orders" padded={false}>
            {customer.orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-steel-400">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {customer.orders.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-steel-500">
                        {formatDate(order.createdAt)} · {order.items.map((item) => item.sku).join(', ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(order.total, currencyFromRow(order.currency))}
                      </span>
                      <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Enquiries" padded={false}>
            {customer.leads.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-steel-400">No enquiries yet.</p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {customer.leads.map((lead) => (
                  <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {lead.ref}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-steel-500">
                        {lead.truck?.title ?? lead.subject ?? 'General enquiry'} ·{' '}
                        {relativeTime(lead.createdAt)}
                      </p>
                    </div>
                    <Badge
                      tone={lead.status === 'WON' ? 'success' : lead.status === 'LOST' ? 'danger' : 'neutral'}
                    >
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          {customer.savedTrucks.length > 0 ? (
            <AdminCard
              title="Saved vehicles"
              description="What they are watching — useful context before a call."
              padded={false}
            >
              <ul className="divide-y divide-steel-100">
                {customer.savedTrucks.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link
                      href={`/admin/trucks/${entry.truck.id}`}
                      className="min-w-0 truncate text-sm text-brand-600 hover:underline"
                    >
                      {entry.truck.title}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-steel-500">
                      {formatMoney(entry.truck.priceNet, base)} · {entry.truck.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <AdminCard title="Details">
            <dl>
              <DataRow
                label="Email"
                value={
                  <a href={`mailto:${customer.email}`} className="text-brand-600 hover:underline">
                    {customer.email}
                  </a>
                }
                className="border-b border-steel-100"
              />
              <DataRow
                label="Phone"
                value={
                  customer.phone ? (
                    <a
                      href={`tel:${customer.phone.replace(/\s/g, '')}`}
                      className="text-brand-600 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
                className="border-b border-steel-100"
              />
              <DataRow
                label="Company"
                value={customer.companyName ?? '—'}
                className="border-b border-steel-100"
              />
              <DataRow label="VAT number" value={customer.vatNumber ?? '—'} className="border-b border-steel-100" />
              <DataRow
                label="Currency"
                value={customer.preferredCurrency}
                className="border-b border-steel-100"
              />
              <DataRow
                label="Marketing"
                value={
                  customer.marketingOptIn ? (
                    <Badge tone="success">Opted in</Badge>
                  ) : (
                    <Badge tone="neutral">Opted out</Badge>
                  )
                }
                className="border-b border-steel-100"
              />
              <DataRow
                label="Last sign-in"
                value={customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : 'Never'}
              />
            </dl>
          </AdminCard>

          {customer.addresses.length > 0 ? (
            <AdminCard title="Addresses">
              <ul className="space-y-3">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-lg bg-steel-50 p-3">
                    <p className="mb-1 flex items-center gap-1.5">
                      <Badge tone={address.type === 'BILLING' ? 'info' : 'neutral'}>
                        {address.type === 'BILLING' ? 'Billing' : 'Delivery'}
                      </Badge>
                      {address.isDefault ? <Badge tone="success">Default</Badge> : null}
                    </p>
                    <address className="text-xs not-italic leading-relaxed text-steel-600">
                      {address.fullName}
                      <br />
                      {address.line1}
                      {address.line2 ? (
                        <>
                          <br />
                          {address.line2}
                        </>
                      ) : null}
                      <br />
                      {address.city}, {address.postcode}
                      <br />
                      {address.country}
                    </address>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : null}

          {customer.notes ? (
            <AdminCard title="Internal notes">
              <p className="whitespace-pre-wrap text-sm text-steel-700">{customer.notes}</p>
            </AdminCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
