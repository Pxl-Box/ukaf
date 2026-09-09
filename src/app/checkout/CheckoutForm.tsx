'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
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

const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'RO', label: 'Romania' },
  { value: 'NO', label: 'Norway' },
  { value: 'US', label: 'United States' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
];

type DefaultValues = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingPostcode: string;
  billingCountry: string;
};

export function CheckoutForm({
  defaultValues,
  isSignedIn,
  guestCheckoutEnabled,
  stripeEnabled,
}: {
  defaultValues: DefaultValues;
  isSignedIn: boolean;
  guestCheckoutEnabled: boolean;
  stripeEnabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [deliveryRequired, setDeliveryRequired] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const result = await apiFetch<{ checkoutUrl: string }>('/api/checkout', {
        method: 'POST',
        json: payload,
      });
      // Hand off to Stripe's hosted checkout.
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setPending(false);
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? {});
        if (caught.code === 'CART_CHANGED') {
          setError(`${caught.message} Refreshing your basket…`);
          setTimeout(() => window.location.assign('/cart'), 2500);
        }
      } else {
        setError('Something went wrong starting your payment. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {!isSignedIn && guestCheckoutEnabled ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          Checking out as a guest.{' '}
          <Link href="/login?next=/checkout" className="font-semibold underline underline-offset-2">
            Sign in
          </Link>{' '}
          to track your order and reservations in your account.
        </div>
      ) : null}

      <section className="panel">
        <h2 className="mb-4 text-base font-semibold">Your details</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="firstName"
              label="First name"
              autoComplete="given-name"
              required
              defaultValue={defaultValues.firstName}
              error={firstError(fieldErrors, 'firstName')}
            />
            <TextField
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              required
              defaultValue={defaultValues.lastName}
              error={firstError(fieldErrors, 'lastName')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              defaultValue={defaultValues.email}
              hint="Your receipt and reservation confirmation go here."
              error={firstError(fieldErrors, 'email')}
            />
            <TextField
              name="phone"
              type="tel"
              label="Phone"
              autoComplete="tel"
              required
              defaultValue={defaultValues.phone}
              hint="So we can arrange collection or delivery."
              error={firstError(fieldErrors, 'phone')}
            />
          </div>

          <TextField
            name="company"
            label="Company (optional)"
            autoComplete="organization"
            defaultValue={defaultValues.company}
            error={firstError(fieldErrors, 'company')}
          />
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-4 text-base font-semibold">Billing address</h2>
        <div className="space-y-4">
          <TextField
            name="billingLine1"
            label="Address line 1"
            autoComplete="address-line1"
            required
            defaultValue={defaultValues.billingLine1}
            error={firstError(fieldErrors, 'billingLine1')}
          />
          <TextField
            name="billingLine2"
            label="Address line 2 (optional)"
            autoComplete="address-line2"
            defaultValue={defaultValues.billingLine2}
            error={firstError(fieldErrors, 'billingLine2')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="billingCity"
              label="Town or city"
              autoComplete="address-level2"
              required
              defaultValue={defaultValues.billingCity}
              error={firstError(fieldErrors, 'billingCity')}
            />
            <TextField
              name="billingPostcode"
              label="Postcode"
              autoComplete="postal-code"
              required
              defaultValue={defaultValues.billingPostcode}
              error={firstError(fieldErrors, 'billingPostcode')}
            />
          </div>
          <SelectField
            name="billingCountry"
            label="Country"
            autoComplete="country"
            required
            defaultValue={defaultValues.billingCountry}
            options={COUNTRIES}
            error={firstError(fieldErrors, 'billingCountry')}
          />
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-4 text-base font-semibold">Collection or delivery</h2>

        <CheckboxField
          name="deliveryRequired"
          value="true"
          checked={deliveryRequired}
          onChange={(event) => setDeliveryRequired(event.target.checked)}
          label="I would like the vehicle delivered (we will quote separately)"
        />

        {deliveryRequired ? (
          <div className="mt-4 space-y-4 border-t border-steel-200 pt-4">
            <TextField
              name="deliveryLine1"
              label="Delivery address"
              error={firstError(fieldErrors, 'deliveryLine1')}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="deliveryCity" label="Town or city" error={firstError(fieldErrors, 'deliveryCity')} />
              <TextField name="deliveryPostcode" label="Postcode" error={firstError(fieldErrors, 'deliveryPostcode')} />
              <SelectField
                name="deliveryCountry"
                label="Country"
                defaultValue="GB"
                options={COUNTRIES}
                error={firstError(fieldErrors, 'deliveryCountry')}
              />
            </div>
            <TextAreaField
              name="deliveryNotes"
              label="Delivery notes (optional)"
              rows={3}
              placeholder="Access restrictions, preferred dates, site contact…"
              error={firstError(fieldErrors, 'deliveryNotes')}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-steel-500">
            Collection from our depot is free. Delivery is quoted separately once your order is confirmed.
          </p>
        )}

        <TextAreaField
          name="customerNotes"
          label="Anything else we should know? (optional)"
          rows={3}
          className="mt-4"
          error={firstError(fieldErrors, 'customerNotes')}
        />
      </section>

      <section className="panel">
        <input type="hidden" name="purchaseType" value="RESERVATION" />
        <Honeypot />

        <CheckboxField
          name="acceptTerms"
          value="true"
          required
          label={
            <>
              I have read and accept the{' '}
              <Link href="/legal/terms" target="_blank" className="font-medium text-brand-600 underline underline-offset-2">
                terms &amp; conditions of sale
              </Link>
              , the{' '}
              <Link href="/legal/returns" target="_blank" className="font-medium text-brand-600 underline underline-offset-2">
                cancellation policy
              </Link>{' '}
              and the{' '}
              <Link href="/legal/privacy" target="_blank" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
          error={firstError(fieldErrors, 'acceptTerms')}
        />

        <SubmitButton
          pending={pending}
          pendingLabel="Redirecting to secure payment…"
          disabled={!stripeEnabled}
          className="mt-5 w-full btn-lg"
        >
          Pay securely with Stripe
        </SubmitButton>

        <p className="mt-3 text-center text-xs text-steel-400">
          You will be taken to Stripe to complete payment. Nothing is charged until you confirm there.
        </p>
      </section>
    </form>
  );
}
