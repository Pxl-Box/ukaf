'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { CheckCircleIcon } from '../ui/Icons';
import { Spinner } from '../ui/primitives';

export function NewsletterForm({ className, source = 'footer' }: { className?: string; source?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('pending');
    setMessage('');

    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/newsletter', {
        method: 'POST',
        json: { email, source, website: form.get('website') ?? '' },
      });
      setState('done');
      setMessage('Almost there — check your inbox and confirm your subscription.');
      setEmail('');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Could not subscribe. Please try again.');
    }
  }

  if (state === 'done') {
    return (
      <div className={cn('flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4', className)}>
        <CheckCircleIcon className="mt-0.5 shrink-0 text-lg text-emerald-400" />
        <p className="text-sm text-emerald-100">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.co.uk"
            aria-invalid={state === 'error' ? true : undefined}
            aria-describedby={message ? 'newsletter-message' : undefined}
            className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3.5 text-sm text-white placeholder:text-steel-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        <button type="submit" disabled={state === 'pending'} className="btn-accent h-11 shrink-0 px-5">
          {state === 'pending' ? (
            <>
              <Spinner /> Subscribing
            </>
          ) : (
            'Subscribe'
          )}
        </button>

        {/* Honeypot */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
      </div>

      {message ? (
        <p id="newsletter-message" role="alert" className="mt-2 text-xs text-red-300">
          {message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-steel-500">
          By subscribing you agree to our{' '}
          <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-steel-300">
            privacy policy
          </Link>
          . Unsubscribe at any time.
        </p>
      )}
    </form>
  );
}
