'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import {
  FormMessage,
  PasswordStrength,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { LogoutIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [password, setPassword] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const result = await apiFetch<{ otherSessionsRevoked: number }>('/api/auth/change-password', {
        method: 'POST',
        json: {
          currentPassword: data.get('currentPassword'),
          password: data.get('password'),
          confirmPassword: data.get('confirmPassword'),
        },
      });

      form.reset();
      setPassword('');
      setMessage({
        tone: 'success',
        text:
          result.otherSessionsRevoked > 0
            ? `Password changed. You were signed out of ${result.otherSessionsRevoked} other ${
                result.otherSessionsRevoked === 1 ? 'device' : 'devices'
              }.`
            : 'Your password has been changed.',
      });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not change your password. Please try again.' });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4" noValidate>
      <div>
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="mt-0.5 text-sm text-steel-500">
          Changing your password signs you out of every other device.
        </p>
      </div>

      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <TextField
        name="currentPassword"
        type="password"
        label="Current password"
        autoComplete="current-password"
        required
        error={firstError(fieldErrors, 'currentPassword')}
      />

      <div>
        <TextField
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
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

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Updating…">
          Change password
        </SubmitButton>
      </div>
    </form>
  );
}

export function SignOutEverywhereButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function revoke() {
    if (!window.confirm('Sign out of all other devices? You will stay signed in here.')) return;

    setPending(true);
    try {
      await apiFetch('/api/account/sessions', { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={revoke} disabled={pending} className="btn-secondary btn-sm">
      {pending ? <Spinner /> : <LogoutIcon />}
      Sign out other devices
    </button>
  );
}
