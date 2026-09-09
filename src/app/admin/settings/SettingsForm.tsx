'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import type { SiteSettings } from '@/lib/settings';
import { AdminCard } from '@/components/admin/shell';
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';

export function SettingsForm({
  settings,
  currencySymbol,
}: {
  settings: SiteSettings;
  currencySymbol: string;
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

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/settings', { method: 'PATCH', json: data });
      setMessage({ tone: 'success', text: 'Settings saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save settings.' });
      }
    } finally {
      setPending(false);
    }
  }

  const err = (name: string) => firstError(fieldErrors, name);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <AdminCard title="Public details" description="Shown in the header, footer and transactional emails.">
        <div className="space-y-4">
          <TextField name="siteName" label="Site name" defaultValue={settings.siteName} error={err('siteName')} />
          <TextField
            name="tagline"
            label="Tagline"
            defaultValue={settings.tagline}
            hint="Appears in the top bar and the footer."
            error={err('tagline')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="contactEmail"
              type="email"
              label="Contact email"
              defaultValue={settings.contactEmail}
              error={err('contactEmail')}
            />
            <TextField
              name="contactPhone"
              type="tel"
              label="Contact phone"
              defaultValue={settings.contactPhone}
              error={err('contactPhone')}
            />
          </div>

          <TextAreaField
            name="address"
            label="Address"
            rows={2}
            defaultValue={settings.address}
            error={err('address')}
          />
          <TextField
            name="openingHours"
            label="Opening hours"
            defaultValue={settings.openingHours}
            error={err('openingHours')}
          />
        </div>
      </AdminCard>

      <AdminCard title="Commerce defaults" description="Applied to new stock and the finance calculator.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            name="defaultReservationFee"
            label={`Reservation deposit (${currencySymbol})`}
            inputMode="decimal"
            defaultValue={(settings.defaultReservationFee / 100).toFixed(2)}
            error={err('defaultReservationFee')}
          />
          <TextField
            name="defaultVatRate"
            label="VAT rate (basis points)"
            inputMode="numeric"
            defaultValue={String(settings.defaultVatRate)}
            hint="2000 = 20%."
            error={err('defaultVatRate')}
          />
          <TextField
            name="financeApr"
            label="Representative APR (%)"
            inputMode="decimal"
            defaultValue={String(settings.financeApr)}
            error={err('financeApr')}
          />
        </div>
      </AdminCard>

      <AdminCard title="Checkout behaviour">
        <div className="space-y-3">
          <CheckboxField
            name="enableGuestCheckout"
            value="true"
            defaultChecked={settings.enableGuestCheckout}
            label="Allow checkout without an account"
            hint="Turning this off requires buyers to register before paying a deposit."
          />
          <CheckboxField
            name="enableFullPurchase"
            value="true"
            defaultChecked={settings.enableFullPurchase}
            label="Allow paying for a vehicle in full online"
            hint="Off by default — most buyers pay a deposit online and the balance by transfer. Card payments are capped at £100,000 regardless."
          />
          <CheckboxField
            name="maintenanceMode"
            value="true"
            defaultChecked={settings.maintenanceMode}
            label="Maintenance mode"
            hint="Reserved for planned downtime. Staff keep access."
          />
        </div>
      </AdminCard>

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
