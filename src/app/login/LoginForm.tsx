'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { safeRedirectPath } from '@/lib/utils';
import { FormMessage, SubmitButton, TextField, firstError } from '@/components/forms/fields';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const next = safeRedirectPath(searchParams.get('next'), '');
  const notice = searchParams.get('notice');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const result = await apiFetch<{ redirectTo: string }>('/api/auth/login', {
        method: 'POST',
        json: {
          email: form.get('email'),
          password: form.get('password'),
          next: next || undefined,
        },
      });

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
