'use client';

import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { FormMessage, Honeypot, SubmitButton, TextField, firstError } from '@/components/forms/fields';
import { MailIcon } from '@/components/ui/Icons';

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        json: { email: form.get('email'), website: form.get('website') ?? '' },
      });
      setSent(true);
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Could not send the reset email. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
        <MailIcon className="mx-auto text-3xl text-brand-600" />
        <h2 className="mt-3 text-base font-semibold text-brand-900">Check your inbox</h2>
        <p className="mt-1.5 text-sm text-brand-800">
          If that email address has an account with us, a reset link is on its way. It expires in 60 minutes.
        </p>
        <p className="mt-3 text-xs text-brand-700">
          Nothing arrived? Check your spam folder, or contact us if you are stuck.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      <Honeypot />

      <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
