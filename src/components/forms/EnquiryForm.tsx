'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { CheckCircleIcon } from '../ui/Icons';
import {
  CheckboxField,
  FormMessage,
  Honeypot,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from './fields';

type Props = {
  truckId?: string;
  vehicleTitle?: string;
  defaultMessage?: string;
  /** Adds the part-exchange fields and posts as a part-exchange enquiry. */
  variant?: 'enquiry' | 'part-exchange';
  compact?: boolean;
  className?: string;
};

export function EnquiryForm({
  truckId,
  vehicleTitle,
  defaultMessage,
  variant = 'enquiry',
  compact = false,
  className,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, unknown>;

    // Read UTM parameters so marketing attribution reaches the CRM.
    const search = new URLSearchParams(window.location.search);
    payload.utmSource = search.get('utm_source') ?? '';
    payload.utmMedium = search.get('utm_medium') ?? '';
    payload.utmCampaign = search.get('utm_campaign') ?? '';
    if (truckId) payload.truckId = truckId;

    try {
      const result = await apiFetch<{ reference: string }>('/api/enquiries', {
        method: 'POST',
        json: payload,
      });
      setReference(result.reference);
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setError('Something went wrong. Please try again or call us.');
      }
    } finally {
      setPending(false);
    }
  }

  if (reference) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircleIcon className="mx-auto text-3xl text-emerald-600" />
          <h3 className="mt-3 text-base font-semibold text-emerald-900">Enquiry received</h3>
          <p className="mt-1.5 text-sm text-emerald-800">
            Your reference is <strong>{reference}</strong>. A member of our sales team will be in touch within one
            working day, and we have emailed you a copy.
          </p>
          <Link href="/trucks" className="btn-secondary mt-5">
            Keep browsing stock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <div className="space-y-4">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="phone"
            type="tel"
            label="WhatsApp / phone number"
            autoComplete="tel"
            required
            hint="How we'll reach you — including on WhatsApp."
            error={firstError(fieldErrors, 'phone')}
          />
          <TextField
            name="email"
            type="email"
            label="Email (optional)"
            autoComplete="email"
            error={firstError(fieldErrors, 'email')}
          />
        </div>

        {!compact ? (
          <TextField
            name="company"
            label="Company (optional)"
            autoComplete="organization"
            error={firstError(fieldErrors, 'company')}
          />
        ) : null}

        {variant === 'part-exchange' ? (
          <fieldset className="rounded-lg border border-steel-200 bg-steel-50 p-4">
            <legend className="px-1 text-sm font-semibold text-steel-800">Your current vehicle</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <TextField name="pxMake" label="Make" required error={firstError(fieldErrors, 'pxMake')} />
              <TextField name="pxModel" label="Model" required error={firstError(fieldErrors, 'pxModel')} />
              <TextField
                name="pxYear"
                label="Year"
                inputMode="numeric"
                placeholder="2019"
                error={firstError(fieldErrors, 'pxYear')}
              />
              <TextField
                name="pxMileageKm"
                label="Mileage (km)"
                inputMode="numeric"
                placeholder="450,000"
                error={firstError(fieldErrors, 'pxMileageKm')}
              />
              <TextField
                name="pxRegistration"
                label="Registration"
                placeholder="AB19 CDE"
                error={firstError(fieldErrors, 'pxRegistration')}
              />
              <TextField
                name="pxCondition"
                label="Condition"
                placeholder="Good, MOT until…"
                error={firstError(fieldErrors, 'pxCondition')}
              />
            </div>
          </fieldset>
        ) : null}

        <TextAreaField
          name="message"
          label={variant === 'part-exchange' ? 'Anything else we should know?' : 'Your message'}
          required
          rows={compact ? 4 : 5}
          defaultValue={
            defaultMessage ??
            (vehicleTitle ? `I would like more information about the ${vehicleTitle}.` : undefined)
          }
          placeholder="Tell us what you need, when you need it, and how you would like to pay."
          error={firstError(fieldErrors, 'message')}
        />

        <input type="hidden" name="source" value={variant === 'part-exchange' ? 'PART_EXCHANGE' : 'WEBSITE_ENQUIRY'} />
        {vehicleTitle ? <input type="hidden" name="subject" value={`Enquiry: ${vehicleTitle}`} /> : null}
        <Honeypot />

        <CheckboxField
          name="acceptPrivacy"
          value="true"
          label={
            <>
              I agree that UKAF may use my details to respond to this enquiry, as set out in the{' '}
              <Link href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
          error={firstError(fieldErrors, 'acceptPrivacy')}
        />

        <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full">
          {variant === 'part-exchange' ? 'Request a valuation' : 'Send enquiry'}
        </SubmitButton>

        <p className="text-center text-xs text-steel-400">
          We aim to reply within one working day. We never sell your data.
        </p>
      </div>
    </form>
  );
}
