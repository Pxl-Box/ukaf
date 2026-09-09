import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDate, relativeTime } from '@/lib/utils';
import { Badge, Stat } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Pagination } from '@/components/ui/Pagination';
import { AdminCustomerSearch } from './AdminCustomerSearch';

export const metadata: Metadata = {
  title: 'Customers',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({
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

  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    status: { not: 'DELETED' },
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, customers, base, newThisMonth, withOrders] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        marketingOptIn: true,
        lastLoginAt: true,
        createdAt: true,
        orders: {
          where: { paymentStatus: 'SUCCEEDED' },
          select: { baseTotal: true },
        },
        _count: { select: { orders: true, savedTrucks: true, leads: true } },
      },
    }),
    getBaseCurrency(),
    prisma.user.count({
      where: {
        role: 'CUSTOMER',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER', orders: { some: { paymentStatus: 'SUCCEEDED' } } } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader
        title="Customers"
        description={`${total} registered ${total === 1 ? 'customer' : 'customers'}`}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total customers" value={total} />
        <Stat label="New (30 days)" value={newThisMonth} tone="info" />
        <Stat
          label="Have purchased"
          value={withOrders}
          hint={total > 0 ? `${Math.round((withOrders / total) * 100)}% of registrations` : undefined}
          tone="success"
        />
      </div>

      <AdminCard padded={false}>
        <div className="border-b border-steel-200 p-4">
          <AdminCustomerSearch />
        </div>

        <TableWrap>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th align="center">Orders</Th>
              <Th align="right">Lifetime value</Th>
              <Th align="center">Activity</Th>
              <Th>Registered</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <EmptyRow colSpan={7} message="No customers match that search." />
            ) : (
              customers.map((customer) => {
                const lifetime = customer.orders.reduce((sum, order) => sum + order.baseTotal, 0);

                return (
                  <tr key={customer.id} className="hover:bg-steel-50">
                    <Td>
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {customer.firstName} {customer.lastName}
                      </Link>
                      {customer.companyName ? (
                        <span className="block truncate text-xs text-steel-400">{customer.companyName}</span>
                      ) : null}
                    </Td>
                    <Td className="text-xs">
                      <span className="block truncate">{customer.email}</span>
                      {customer.phone ? (
                        <span className="block text-steel-400">{customer.phone}</span>
                      ) : null}
                    </Td>
                    <Td align="center" className="tabular-nums">
                      {customer._count.orders}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums">
                      {lifetime > 0 ? formatMoney(lifetime, base) : <span className="text-steel-300">—</span>}
                    </Td>
                    <Td align="center" className="whitespace-nowrap text-xs text-steel-500">
                      {customer._count.leads} enq · {customer._count.savedTrucks} saved
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-500">
                      {formatDate(customer.createdAt)}
                      <span className="block text-steel-400">
                        {customer.lastLoginAt ? `Seen ${relativeTime(customer.lastLoginAt)}` : 'Never signed in'}
                      </span>
                    </Td>
                    <Td>
                      {customer.status === 'SUSPENDED' ? (
                        <Badge tone="danger">Suspended</Badge>
                      ) : !customer.emailVerifiedAt ? (
                        <Badge tone="warning">Unverified</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
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
        basePath="/admin/customers"
      />
    </div>
  );
}
