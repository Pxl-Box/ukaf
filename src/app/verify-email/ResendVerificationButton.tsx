'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { CheckIcon, MailIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';

export function ResendVerificationButton() {
  const [state, setState] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle');

  async function resend() {
    setState('pending');
    try {
      await apiFetch('/api/auth/verify-email', { method: 'POST' });
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <span className="btn-secondary pointer-events-none text-emerald-700">
        <CheckIcon /> Sent — check your inbox
      </span>
    );
  }

  return (
    <button type="button" onClick={resend} disabled={state === 'pending'} className="btn-primary">
      {state === 'pending' ? (
        <>
          <Spinner /> Sending…
        </>
      ) : (
        <>
          <MailIcon /> {state === 'error' ? 'Try again' : 'Resend confirmation email'}
        </>
      )}
    </button>
  );
}
