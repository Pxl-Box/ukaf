import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fullName, initials, requireStaff, ROLE_LABELS } from '@/lib/auth';
import { AdminNav } from './AdminNav';

/**
 * Admin shell. `requireStaff` is the real access check — the middleware only
 * does a cheap cookie-presence test before this runs.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  const [newLeads, pendingOrders, draftStock, overdueTasks] = await Promise.all([
    prisma.lead.count({ where: { status: 'NEW' } }).catch(() => 0),
    prisma.order.count({ where: { status: { in: ['PAID', 'IN_PREPARATION'] } } }).catch(() => 0),
    prisma.truck.count({ where: { status: 'DRAFT' } }).catch(() => 0),
    prisma.activity
      .count({ where: { completedAt: null, dueAt: { lt: new Date() } } })
      .catch(() => 0),
  ]);

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-steel-100">
      <div className="mx-auto flex w-full max-w-[100rem] gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-28 rounded-xl border border-steel-200 bg-white p-3 shadow-card">
            <div className="mb-3 flex items-center gap-2.5 px-2 py-1.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-steel-950 text-xs font-bold text-white"
              >
                {initials(user)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-steel-900">{fullName(user)}</p>
                <p className="truncate text-[11px] text-steel-500">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>

            <AdminNav
              role={user.role}
              badges={{
                leads: newLeads,
                orders: pendingOrders,
                stock: draftStock,
                tasks: overdueTasks,
              }}
            />

            <div className="mt-3 border-t border-steel-100 pt-3">
              <Link href="/" className="btn-ghost btn-sm w-full justify-start">
                View storefront
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 lg:px-0 lg:py-0">
          <div className="lg:hidden">
            <AdminNav
              role={user.role}
              badges={{ leads: newLeads, orders: pendingOrders, stock: draftStock, tasks: overdueTasks }}
              variant="horizontal"
            />
          </div>

          <div className="mt-4 lg:mt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
