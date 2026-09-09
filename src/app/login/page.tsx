import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/layout/AuthShell';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your UKAF account to manage saved vehicles, reservations and enquiries.',
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to pick up where you left off."
      footer={
        <>
          Not registered yet?{' '}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-steel-100" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
