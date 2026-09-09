'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { monthlyPayment } from '@/lib/money';
import {
  CheckboxField,
  FormMessage,
  Honeypot,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { CheckCircleIcon } from '@/components/ui/Icons';

export function FinanceEnquiryForm({
  truckId,
  defaultPrice,
  currencySymbol,
  apr,
  className,
}: {
  truckId?: string;
  defaultPrice: string;
  currencySymbol: string;
  apr: number;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);

  // Live estimate so the visitor sees the shape of the deal as they type.
  const [price, setPrice] = useState(defaultPrice);
  const [deposit, setDeposit] = useState('');
  const [term, setTerm] = useState('48');

  const estimate = useMemo(() => {
    const priceMinor = Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100);
    const depositMinor = Math.round(Number(deposit.replace(/[^0-9.]/g, '')) * 100);
    const months = Number(term);

    if (!Number.isFinite(priceMinor) || priceMinor <= 0 || !Number.isFinite(months) || months <= 0) {
      return null;
    }
    const financed = priceMinor - (Number.isFinite(depositMinor) ? depositMinor : 0);
    if (financed <= 0) return null;

    return monthlyPayment(financed, apr, months);
  }, [price, deposit, term, apr]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const result = await apiFetch<{ reference: string }>('/api/finance', {
        method: 'POST',
        json: { ...data, ...(truckId ? { truckId } : {}) },
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
            Your reference is <strong>{reference}</strong>. A finance specialist will be in touch within one working
            day. No credit search has been carried out.
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

        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          error={firstError(fieldErrors, 'email')}
        />
        <TextField
          name="phone"
          type="tel"
          label="Phone"
          autoComplete="tel"
          required
          error={firstError(fieldErrors, 'phone')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="company"
            label="Company"
            autoComplete="organization"
            error={firstError(fieldErrors, 'company')}
          />
          <TextField
            name="yearsTrading"
            label="Years trading"
            inputMode="numeric"
            placeholder="3"
            error={firstError(fieldErrors, 'yearsTrading')}
          />
        </div>

        <fieldset className="rounded-lg border border-steel-200 bg-steel-50 p-4">
          <legend className="px-1 text-sm font-semibold text-steel-800">The deal</legend>

          <div className="mt-2 space-y-4">
            <TextField
              name="vehiclePriceNet"
              label={`Vehicle price (${currencySymbol}, ex VAT)`}
              required
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              error={firstError(fieldErrors, 'vehiclePriceNet')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="depositNet"
                label={`Deposit (${currencySymbol})`}
                required
                inputMode="decimal"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                error={firstError(fieldErrors, 'depositNet')}
              />
              <SelectField
                name="termMonths"
                label="Term"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                options={[12, 24, 36, 48, 60].map((months) => ({
                  value: String(months),
                  label: `${months} months`,
                }))}
                error={firstError(fieldErrors, 'termMonths')}
              />
            </div>

            <TextField
              name="balloonNet"
              label={`Balloon payment (${currencySymbol}, optional)`}
              inputMode="decimal"
              hint="A larger final payment lowers the monthly figure."
              error={firstError(fieldErrors, 'balloonNet')}
            />

            {estimate !== null ? (
              <p className="rounded-lg bg-white p-3 text-sm text-steel-700">
                Roughly{' '}
                <strong className="text-base text-steel-950">
                  {currencySymbol}
                  {(estimate / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </strong>{' '}
                per month at {apr}% APR.{' '}
                <span className="text-xs text-steel-500">Illustration only, excludes VAT and fees.</span>
              </p>
            ) : null}
          </div>
        </fieldset>

        <TextAreaField
          name="notes"
          label="Anything else we should know?"
          rows={4}
          placeholder="The work the vehicle is for, contracts in place, any credit history we should be aware of…"
          error={firstError(fieldErrors, 'notes')}
        />

        <Honeypot />

        <CheckboxField
          name="acceptPrivacy"
          value="true"
          label={
            <>
              I agree that UKAF may use my details to respond to this enquiry and, with my agreement, pass them to
              lenders, as described in the{' '}
              <Link href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
          error={firstError(fieldErrors, 'acceptPrivacy')}
        />

        <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full">
          Request a finance quote
        </SubmitButton>

        <p className="text-center text-xs leading-relaxed text-steel-400">
          No credit search is carried out by submitting this form. Finance is subject to status and available to
          business users only.
        </p>
      </div>
    </form>
  );
}
