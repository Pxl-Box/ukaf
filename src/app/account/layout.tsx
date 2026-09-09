import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fullName, initials, isStaff, requireUser } from '@/lib/auth';
import { Alert } from '@/components/ui/primitives';
import { AccountNav } from './AccountNav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/account');

  const [orderCount, savedCount, enquiryCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }).catch(() => 0),
    prisma.savedTruck.count({ where: { userId: user.id } }).catch(() => 0),
    prisma.lead.count({ where: { OR: [{ userId: user.id }, { email: user.email }] } }).catch(() => 0),
  ]);

  return (
    <div className="container-page py-8">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside>
          <div className="mb-5 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white"
            >
              {initials(user)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-steel-900">{fullName(user)}</p>
              <p className="truncate text-xs text-steel-500">{user.email}</p>
            </div>
          </div>

          <AccountNav counts={{ orders: orderCount, saved: savedCount, enquiries: enquiryCount }} />

          {isStaff(user) ? (
            <Link href="/admin" className="btn-secondary btn-sm mt-4 w-full">
              Admin dashboard
            </Link>
          ) : null}
        </aside>

        <div className="min-w-0">
          {!user.emailVerifiedAt ? (
            <Alert tone="warning" title="Confirm your email address" className="mb-6">
              Reservations and checkout unlock once you confirm your email.{' '}
              <Link href="/verify-email" className="font-medium underline">
                Resend the confirmation link
              </Link>
              .
            </Alert>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
