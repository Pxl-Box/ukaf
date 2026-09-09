'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import {
  FormMessage,
  PasswordStrength,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { Alert } from '@/components/ui/primitives';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [password, setPassword] = useState('');

  if (!token) {
    return (
      <Alert tone="danger" title="This link is not valid">
        The reset link is missing or incomplete. Please{' '}
        <Link href="/forgot-password" className="font-medium underline">
          request a new one
        </Link>
        .
      </Alert>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      const result = await apiFetch<{ redirectTo: string }>('/api/auth/reset-password', {
        method: 'POST',
        json: {
          token,
          password: form.get('password'),
          confirmPassword: form.get('confirmPassword'),
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
        setError('Could not reset your password. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div>
        <TextField
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={firstError(fieldErrors, 'password')}
        />
        <PasswordStrength password={password} />
      </div>

      <TextField
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={firstError(fieldErrors, 'confirmPassword')}
      />

      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full">
        Set new password
      </SubmitButton>
    </form>
  );
}
