import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/layout/AuthShell';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const isInvite = params.invite === '1';

  return (
    <AuthShell
      title={isInvite ? 'Set your password' : 'Choose a new password'}
      subtitle={
        isInvite
          ? 'Set a password to activate your staff account.'
          : 'Pick something you have not used elsewhere. Setting a new password signs you out of every other device.'
      }
      highlights={[
        'At least 10 characters — length matters more than symbols',
        'All other sessions are signed out immediately',
        'We email you to confirm the change',
        'Never reuse a password from another site',
      ]}
      footer={
        <>
          Changed your mind?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-steel-100" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
