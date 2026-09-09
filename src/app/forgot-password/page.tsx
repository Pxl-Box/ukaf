import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address on your account and we will send you a link to choose a new password."
      highlights={[
        'The link expires after 60 minutes and can only be used once',
        'Resetting signs you out of every other device',
        'We never email you your existing password — we cannot read it',
        'Contact us if you no longer have access to your email address',
      ]}
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
