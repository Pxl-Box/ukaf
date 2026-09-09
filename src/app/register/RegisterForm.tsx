'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import {
  CheckboxField,
  FormMessage,
  Honeypot,
  PasswordStrength,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { CheckCircleIcon } from '@/components/ui/Icons';

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        json: Object.fromEntries(form.entries()),
      });
      setDone(true);
      router.refresh();
    } catch (caught) {
      setPending(false);
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not create your account. Please try again.');
      }
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircleIcon className="mx-auto text-3xl text-emerald-600" />
        <h2 className="mt-3 text-base font-semibold text-emerald-900">Check your inbox</h2>
        <p className="mt-1.5 text-sm text-emerald-800">
          We have sent you a link to confirm your email address. You can start browsing straight away — confirming
          unlocks reservations and checkout.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/trucks" className="btn-primary">
            Browse stock
          </Link>
          <Link href="/account" className="btn-secondary">
            Go to my account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="First name"
          autoComplete="given-name"
          required
          error={firstError(fieldErrors, 'firstName')}
        />
        <TextField
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          required
          error={firstError(fieldErrors, 'lastName')}
        />
      </div>

      <TextField
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={firstError(fieldErrors, 'email')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="phone"
          type="tel"
          label="Phone (optional)"
          autoComplete="tel"
          error={firstError(fieldErrors, 'phone')}
        />
        <TextField
          name="companyName"
          label="Company (optional)"
          autoComplete="organization"
          error={firstError(fieldErrors, 'companyName')}
        />
      </div>

      <div>
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="At least 10 characters. A short phrase you will remember beats a complicated word."
          error={firstError(fieldErrors, 'password')}
        />
        <PasswordStrength password={password} />
      </div>

      <TextField
        name="confirmPassword"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        error={firstError(fieldErrors, 'confirmPassword')}
      />

      <Honeypot />

      <div className="space-y-3 pt-1">
        <CheckboxField
          name="acceptTerms"
          value="true"
          required
          label={
            <>
              I accept the{' '}
              <Link href="/legal/terms" target="_blank" className="font-medium text-brand-600 underline underline-offset-2">
                terms &amp; conditions
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" target="_blank" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
          error={firstError(fieldErrors, 'acceptTerms')}
        />

        <CheckboxField
          name="marketingOptIn"
          value="true"
          label="Email me when new stock arrives that matches what I am looking for. (Optional — unsubscribe any time.)"
        />
      </div>

      <SubmitButton pending={pending} pendingLabel="Creating account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
