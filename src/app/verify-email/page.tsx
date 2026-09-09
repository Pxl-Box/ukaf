import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { AlertIcon, CheckCircleIcon, MailIcon } from '@/components/ui/Icons';
import { ResendVerificationButton } from './ResendVerificationButton';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

const STATES = {
  verified: {
    icon: <CheckCircleIcon className="text-4xl text-emerald-600" />,
    title: 'Email confirmed',
    body: 'Thanks — your account is fully active. You can now reserve vehicles and check out.',
    tone: 'success' as const,
  },
  already: {
    icon: <CheckCircleIcon className="text-4xl text-emerald-600" />,
    title: 'Already confirmed',
    body: 'This email address was confirmed previously. Nothing more to do.',
    tone: 'success' as const,
  },
  expired: {
    icon: <AlertIcon className="text-4xl text-amber-600" />,
    title: 'That link has expired',
    body: 'Confirmation links are valid for 24 hours. Sign in and request a new one below.',
    tone: 'warning' as const,
  },
  invalid: {
    icon: <AlertIcon className="text-4xl text-red-600" />,
    title: 'This link is not valid',
    body: 'The link may have been used already or copied incompletely. Sign in and request a new one.',
    tone: 'danger' as const,
  },
  pending: {
    icon: <MailIcon className="text-4xl text-brand-600" />,
    title: 'Confirm your email address',
    body: 'We have sent you a link to confirm your email address. Click it to activate reservations and checkout.',
    tone: 'info' as const,
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.status === 'string' && params.status in STATES ? params.status : 'pending';
  const state = STATES[key as keyof typeof STATES];

  const user = await getCurrentUser();
  const needsResend = key !== 'verified' && key !== 'already' && user && !user.emailVerifiedAt;

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg text-center">
        {state.icon}
        <h1 className="mt-4 text-2xl font-bold">{state.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">{state.body}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {needsResend ? <ResendVerificationButton /> : null}

          {user ? (
            <Link href="/account" className="btn-secondary">
              Go to my account
            </Link>
          ) : (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}

          <Link href="/trucks" className="btn-ghost">
            Browse stock
          </Link>
        </div>

        <p className="mt-8 text-xs text-steel-400">
          Still not arriving? Check your spam folder, or{' '}
          <Link href="/contact" className="underline hover:text-steel-600">
            contact us
          </Link>{' '}
          and we will confirm it manually.
        </p>
      </div>
    </div>
  );
}
