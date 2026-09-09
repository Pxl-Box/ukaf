'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  vatNumber: string;
  marketingOptIn: boolean;
  preferredCurrency: string;
};

export function ProfileForm({
  profile,
  currencies,
}: {
  profile: Profile;
  currencies: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/account/profile', {
        method: 'PATCH',
        json: Object.fromEntries(form.entries()),
      });
      setMessage({ tone: 'success', text: 'Your details have been saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save your details. Please try again.' });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4" noValidate>
      <h2 className="text-base font-semibold">Your details</h2>

      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="First name"
          autoComplete="given-name"
          required
          defaultValue={profile.firstName}
          error={firstError(fieldErrors, 'firstName')}
        />
        <TextField
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          required
          defaultValue={profile.lastName}
          error={firstError(fieldErrors, 'lastName')}
        />
      </div>

      <TextField
        name="email"
        label="Email address"
        defaultValue={profile.email}
        disabled
        readOnly
        hint="Contact us if you need to change the email address on your account."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="phone"
          type="tel"
          label="Phone"
          autoComplete="tel"
          defaultValue={profile.phone}
          error={firstError(fieldErrors, 'phone')}
        />
        <SelectField
          name="preferredCurrency"
          label="Preferred currency"
          defaultValue={profile.preferredCurrency}
          options={currencies}
          hint="Prices across the site are shown in this currency."
          error={firstError(fieldErrors, 'preferredCurrency')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="companyName"
          label="Company"
          autoComplete="organization"
          defaultValue={profile.companyName}
          error={firstError(fieldErrors, 'companyName')}
        />
        <TextField
          name="vatNumber"
          label="VAT number"
          defaultValue={profile.vatNumber}
          hint="Needed for VAT-qualifying and export sales."
          error={firstError(fieldErrors, 'vatNumber')}
        />
      </div>

      <CheckboxField
        name="marketingOptIn"
        value="true"
        defaultChecked={profile.marketingOptIn}
        label="Email me when new stock arrives that matches what I am looking for."
      />

      <div className="flex justify-end pt-1">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}
