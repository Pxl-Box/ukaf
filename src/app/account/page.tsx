import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { currencyFromRow, FALLBACK_CURRENCY, formatMoney } from '@/lib/money';
import { formatDate, humanise, relativeTime } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/orders';
import { LEAD_STATUS_LABELS } from '@/lib/leads';
import { Badge, EmptyState, Stat } from '@/components/ui/primitives';
import { HeartIcon, MailIcon, ReceiptIcon, TruckIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountDashboardPage() {
  const user = await requireUser();

  const [orders, enquiries, savedCount, spend] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { currency: true, items: { select: { name: true }, take: 2 } },
    }),
    prisma.lead.findMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        ref: true,
        subject: true,
        status: true,
        createdAt: true,
        truck: { select: { slug: true, title: true } },
      },
    }),
    prisma.savedTruck.count({ where: { userId: user.id } }),
    prisma.order.aggregate({
      where: { userId: user.id, paymentStatus: 'SUCCEEDED' },
      _sum: { baseTotal: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Hello, {user.firstName}</h1>
        <p className="mt-1 text-sm text-steel-500">
          Here is what is happening on your account.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Orders & reservations"
          value={spend._count._all}
          hint={
            spend._sum.baseTotal
              ? `${formatMoney(spend._sum.baseTotal, FALLBACK_CURRENCY)} lifetime`
              : 'No payments yet'
          }
          icon={<ReceiptIcon />}
        />
        <Stat label="Open enquiries" value={enquiries.filter((lead) => !['WON', 'LOST'].includes(lead.status)).length} icon={<MailIcon />} />
        <Stat label="Saved vehicles" value={savedCount} icon={<HeartIcon />} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={<TruckIcon />}
            title="No orders yet"
            description="When you reserve a vehicle it will appear here with its status and paperwork."
            action={
              <Link href="/trucks" className="btn-primary">
                Browse stock
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brand-300"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-steel-900">{order.orderNumber}</p>
                    <p className="mt-0.5 truncate text-xs text-steel-500">
                      {order.items.map((item) => item.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(order.total, currencyFromRow(order.currency))}
                    </span>
                    <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                      {ORDER_STATUS_LABELS[order.status] ?? humanise(order.status)}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent enquiries</h2>
          <Link href="/account/enquiries" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        {enquiries.length === 0 ? (
          <EmptyState
            icon={<MailIcon />}
            title="No enquiries yet"
            description="Ask us about any vehicle and the conversation will be tracked here."
            action={
              <Link href="/contact" className="btn-secondary">
                Contact us
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {enquiries.map((lead) => (
              <li key={lead.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-steel-900">
                    {lead.truck ? (
                      <Link href={`/trucks/${lead.truck.slug}`} className="hover:text-brand-700">
                        {lead.truck.title}
                      </Link>
                    ) : (
                      lead.subject ?? 'General enquiry'
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-steel-500">
                    {lead.ref} · {formatDate(lead.createdAt)} ({relativeTime(lead.createdAt)})
                  </p>
                </div>
                <Badge tone={lead.status === 'WON' ? 'success' : lead.status === 'LOST' ? 'neutral' : 'info'}>
                  {LEAD_STATUS_LABELS[lead.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
