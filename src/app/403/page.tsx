import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentUser, isStaff, ROLE_LABELS } from '@/lib/auth';
import { ShieldIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Access denied',
  robots: { index: false, follow: false },
};

export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <ShieldIcon className="mx-auto text-5xl text-steel-300" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Error 403</p>
        <h1 className="mt-2 text-2xl font-bold">You do not have access to that page</h1>

        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
          {user
            ? `You are signed in as ${user.email} with the ${ROLE_LABELS[user.role]} role, which does not include this area. If you think that is wrong, ask an administrator to review your permissions.`
            : 'You need to sign in with an account that has permission to view this page.'}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {user ? (
            <>
              <Link href={isStaff(user) ? '/admin' : '/account'} className="btn-primary">
                {isStaff(user) ? 'Back to the dashboard' : 'Back to my account'}
              </Link>
              <Link href="/" className="btn-secondary">
                Go to the homepage
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
              <Link href="/" className="btn-secondary">
                Go to the homepage
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
