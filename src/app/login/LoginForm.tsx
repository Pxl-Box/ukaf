'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { safeRedirectPath } from '@/lib/utils';
import { FormMessage, SubmitButton, TextField, firstError } from '@/components/forms/fields';

type LoginResult = { signedIn: true; redirectTo: string } | { mfaRequired: true; mfaToken: string; redirectTo: string; maskedEmail: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [mfa, setMfa] = useState<{ mfaToken: string; maskedEmail: string; redirectTo: string } | null>(null);
  const [resent, setResent] = useState(false);

  const next = safeRedirectPath(searchParams.get('next'), '');
  const notice = searchParams.get('notice');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const result = await apiFetch<LoginResult>('/api/auth/login', {
        method: 'POST',
        json: {
          email: form.get('email'),
          password: form.get('password'),
          next: next || undefined,
        },
      });

      if ('mfaRequired' in result) {
        setPending(false);
        setMfa({ mfaToken: result.mfaToken, maskedEmail: result.maskedEmail, redirectTo: result.redirectTo });
        return;
      }

      router.push(result.redirectTo);
      router.refresh();
    } catch (caught) {
      setPending(false);
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not sign you in. Please try again.');
      }
    }
  }

  async function onVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfa) return;
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const result = await apiFetch<{ redirectTo: string }>('/api/auth/verify-otp', {
        method: 'POST',
        json: { mfaToken: mfa.mfaToken, code: form.get('code') },
      });

      router.push(result.redirectTo);
      router.refresh();
    } catch (caught) {
      setPending(false);
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not verify that code. Please try again.');
      }
    }
  }

  async function onResend() {
    if (!mfa) return;
    setResent(false);
    setError(null);
    try {
      await apiFetch('/api/auth/resend-otp', { method: 'POST', json: { mfaToken: mfa.mfaToken } });
      setResent(true);
    } catch {
      setError('Could not resend the code. Please try signing in again.');
    }
  }

  if (mfa) {
    return (
      <form onSubmit={onVerifyOtp} className="space-y-4" noValidate>
        <FormMessage tone="success">
          We sent a 6-digit code to {mfa.maskedEmail}. Enter it below to finish signing in.
        </FormMessage>
        {resent ? <FormMessage tone="success">A new code has been sent.</FormMessage> : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <TextField
          name="code"
          type="text"
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          error={firstError(fieldErrors, 'code')}
        />

        <SubmitButton pending={pending} pendingLabel="Verifying…" className="w-full">
          Verify code
        </SubmitButton>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setMfa(null);
              setError(null);
            }}
            className="font-medium text-steel-500 hover:underline"
          >
            Back to sign in
          </button>
          <button type="button" onClick={onResend} className="font-medium text-brand-600 hover:underline">
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {notice === 'registered' ? (
        <FormMessage tone="success">Your account is ready — sign in to continue.</FormMessage>
      ) : null}
      {notice === 'session-expired' ? (
        <FormMessage tone="error">Your session expired. Please sign in again.</FormMessage>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <TextField
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        autoFocus
        error={firstError(fieldErrors, 'email')}
      />

      <div>
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          error={firstError(fieldErrors, 'password')}
        />
        <div className="mt-1.5 text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
            Forgotten your password?
          </Link>
        </div>
      </div>

      <SubmitButton pending={pending} pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
