'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { AdminCard } from '@/components/admin/shell';
import { TruckImageManager } from './TruckImageManager';
import { CategoryFieldsSection } from './CategoryFieldsSection';

export type TruckFormValues = {
  id?: string;
  title: string;
  stockNumber: string;
  slug: string;
  makeId: string;
  modelName: string;
  variant: string;
  categoryId: string;
  locationId: string;
  year: string;
  mileageKm: string;
  condition: string;
  fuelType: string;
  transmission: string;
  gears: string;
  emissions: string;
  axleConfig: string;
  cabType: string;
  bodyLengthMm: string;
  wheelbaseMm: string;
  grossWeightKg: string;
  payloadKg: string;
  engineCc: string;
  powerBhp: string;
  colour: string;
  previousOwners: string;
  motExpiry: string;
  serviceHistory: string;
  registration: string;
  vin: string;
  costPriceNet: string;
  priceNet: string;
  retailPriceNet: string;
  vatTreatment: string;
  vatRate: string;
  priceOnApplication: boolean;
  reservationFee: string;
  quantity: string;
  status: string;
  featured: boolean;
  shortDescription: string;
  description: string;
  features: string;
  metaTitle: string;
  metaDescription: string;
  /** Stored values for the category's admin-defined fields, keyed by field key. */
  customFields?: Record<string, unknown>;
};

type Option = { value: string; label: string };

export function TruckForm({
  initial,
  makes,
  categories,
  locations,
  currencySymbol,
  images,
  canDelete,
}: {
  initial: TruckFormValues;
  makes: Option[];
  categories: Option[];
  locations: Option[];
  currencySymbol: string;
  images?: Array<{ id: string; url: string; alt: string | null; isPrimary: boolean }>;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [poa, setPoa] = useState(initial.priceOnApplication);
  const [categoryId, setCategoryId] = useState(initial.categoryId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    const customFields: Record<string, unknown> = {};

    // Category fields are named `custom__<key>` (see CategoryFieldsSection) so
    // they can be collected here without colliding with the fixed vehicle
    // fields above. A key can appear more than once — a multi-select renders
    // as several checkboxes sharing one name — so every key is read with
    // getAll() and only turned into an array when there is more than one.
    for (const key of new Set(form.keys())) {
      const values = form.getAll(key).map(String);
      if (key.startsWith('custom__')) {
        const fieldKey = key.slice('custom__'.length);
        customFields[fieldKey] = values.length > 1 ? values : values[0];
      } else {
        payload[key] = values.length > 1 ? values : values[0];
      }
    }

    payload.customFields = customFields;
    if (initial.id) payload.id = initial.id;

    try {
      const result = await apiFetch<{ truck: { id: string } }>('/api/admin/trucks', {
        method: isEdit ? 'PATCH' : 'POST',
        json: payload,
      });

      if (!isEdit) {
        router.push(`/admin/trucks/${result.truck.id}`);
      } else {
        setMessage({ tone: 'success', text: 'Vehicle saved.' });
        router.refresh();
      }
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the vehicle. Please try again.' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        'Delete this vehicle? If it appears on any order it will be archived instead. This cannot be undone.',
      )
    ) {
      return;
    }

    try {
      const result = await apiFetch<{ archived: boolean; message?: string }>('/api/admin/trucks', {
        method: 'DELETE',
        json: { id: initial.id },
      });
      if (result.archived) window.alert(result.message ?? 'Vehicle archived.');
      router.push('/admin/trucks');
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Could not delete the vehicle.',
      });
    }
  }

  const err = (name: string) => firstError(fieldErrors, name);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <AdminCard title="Vehicle details">
            <div className="space-y-4">
              <TextField
                name="title"
                label="Listing title"
                required
                defaultValue={initial.title}
                hint="What buyers see, e.g. “2019 DAF XF 480 FTG 6x2 Tractor Unit”."
                error={err('title')}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="stockNumber"
                  label="Stock number"
                  required
                  defaultValue={initial.stockNumber}
                  error={err('stockNumber')}
                />
                <SelectField
                  name="makeId"
                  label="Make"
                  required
                  defaultValue={initial.makeId}
                  placeholder="Select a make"
                  options={makes}
                  error={err('makeId')}
                />
                <TextField
                  name="modelName"
                  label="Model"
                  required
                  defaultValue={initial.modelName}
                  error={err('modelName')}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField name="variant" label="Variant" defaultValue={initial.variant} error={err('variant')} />
                <SelectField
                  name="categoryId"
                  label="Body type"
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  placeholder="Select a body type"
                  options={categories}
                  error={err('categoryId')}
                />
                <SelectField
                  name="locationId"
                  label="Location"
                  defaultValue={initial.locationId}
                  placeholder="No specific depot"
                  options={locations}
                  error={err('locationId')}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <TextField
                  name="year"
                  label="Year"
                  required
                  inputMode="numeric"
                  defaultValue={initial.year}
                  error={err('year')}
                />
                <TextField
                  name="mileageKm"
                  label="Mileage (km)"
                  inputMode="numeric"
                  defaultValue={initial.mileageKm}
                  error={err('mileageKm')}
                />
                <SelectField
                  name="condition"
                  label="Condition"
                  defaultValue={initial.condition}
                  options={[
                    { value: 'USED', label: 'Used' },
                    { value: 'NEW', label: 'New' },
                    { value: 'EX_DEMO', label: 'Ex-demo' },
                  ]}
                />
                <TextField
                  name="colour"
                  label="Colour"
                  defaultValue={initial.colour}
                  error={err('colour')}
                />
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Technical specification">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                name="fuelType"
                label="Fuel"
                defaultValue={initial.fuelType}
                options={[
                  { value: 'DIESEL', label: 'Diesel' },
                  { value: 'ELECTRIC', label: 'Electric' },
                  { value: 'HYBRID', label: 'Hybrid' },
                  { value: 'CNG', label: 'CNG' },
                  { value: 'LNG', label: 'LNG' },
                  { value: 'HYDROGEN', label: 'Hydrogen' },
                  { value: 'PETROL', label: 'Petrol' },
                ]}
              />
              <SelectField
                name="transmission"
                label="Gearbox"
                defaultValue={initial.transmission}
                options={[
                  { value: 'AUTOMATIC', label: 'Automatic' },
                  { value: 'MANUAL', label: 'Manual' },
                  { value: 'SEMI_AUTOMATIC', label: 'Semi-automatic' },
                ]}
              />
              <TextField
                name="gears"
                label="Number of gears"
                inputMode="numeric"
                defaultValue={initial.gears}
                error={err('gears')}
              />

              <SelectField
                name="emissions"
                label="Emissions standard"
                defaultValue={initial.emissions}
                options={[
                  { value: 'EURO_6', label: 'Euro 6' },
                  { value: 'EURO_5', label: 'Euro 5' },
                  { value: 'EURO_4', label: 'Euro 4' },
                  { value: 'EURO_3', label: 'Euro 3' },
                  { value: 'ZERO_EMISSION', label: 'Zero emission' },
                ]}
              />
              <TextField
                name="axleConfig"
                label="Axle configuration"
                placeholder="6x2"
                defaultValue={initial.axleConfig}
                error={err('axleConfig')}
              />
              <TextField name="cabType" label="Cab type" defaultValue={initial.cabType} error={err('cabType')} />

              <TextField
                name="grossWeightKg"
                label="Gross weight (kg)"
                inputMode="numeric"
                defaultValue={initial.grossWeightKg}
                error={err('grossWeightKg')}
              />
              <TextField
                name="payloadKg"
                label="Payload (kg)"
                inputMode="numeric"
                defaultValue={initial.payloadKg}
                error={err('payloadKg')}
              />
              <TextField
                name="powerBhp"
                label="Power (bhp)"
                inputMode="numeric"
                defaultValue={initial.powerBhp}
                error={err('powerBhp')}
              />

              <TextField
                name="engineCc"
                label="Engine (cc)"
                inputMode="numeric"
                defaultValue={initial.engineCc}
                error={err('engineCc')}
              />
              <TextField
                name="wheelbaseMm"
                label="Wheelbase (mm)"
                inputMode="numeric"
                defaultValue={initial.wheelbaseMm}
                error={err('wheelbaseMm')}
              />
              <TextField
                name="bodyLengthMm"
                label="Body length (mm)"
                inputMode="numeric"
                defaultValue={initial.bodyLengthMm}
                error={err('bodyLengthMm')}
              />

              <TextField
                name="previousOwners"
                label="Previous owners"
                inputMode="numeric"
                defaultValue={initial.previousOwners}
                error={err('previousOwners')}
              />
              <TextField
                name="motExpiry"
                type="date"
                label="MOT expiry"
                defaultValue={initial.motExpiry}
                error={err('motExpiry')}
              />
              <TextField
                name="serviceHistory"
                label="Service history"
                placeholder="Full main dealer"
                defaultValue={initial.serviceHistory}
                error={err('serviceHistory')}
              />
            </div>
          </AdminCard>

          <AdminCard
            title="Description & features"
            description="Shown on the vehicle page. Features appear as a bulleted list."
          >
            <div className="space-y-4">
              <TextField
                name="shortDescription"
                label="Short description"
                defaultValue={initial.shortDescription}
                hint="One line used on cards and in search results."
                error={err('shortDescription')}
              />
              <TextAreaField
                name="description"
                label="Full description"
                rows={8}
                defaultValue={initial.description}
                error={err('description')}
              />
              <TextAreaField
                name="features"
                label="Features"
                rows={6}
                defaultValue={initial.features}
                hint="One per line, e.g. “Fridge · Night heater · Twin bunk”."
                error={err('features')}
              />
            </div>
          </AdminCard>

          <CategoryFieldsSection
            categoryId={categoryId}
            initialValues={initial.customFields ?? {}}
            fieldErrors={fieldErrors}
          />

          {isEdit && initial.id ? (
            <AdminCard title="Photographs" description="The first image is used as the main photo.">
              <TruckImageManager truckId={initial.id} initialImages={images ?? []} />
            </AdminCard>
          ) : (
            <AdminCard title="Photographs">
              <p className="text-sm text-steel-500">Save the vehicle first, then add photographs.</p>
            </AdminCard>
          )}

          <AdminCard title="Search engine listing" description="Leave blank to generate these automatically.">
            <div className="space-y-4">
              <TextField
                name="slug"
                label="URL slug"
                defaultValue={initial.slug}
                hint={isEdit ? 'Changing this breaks existing links and shared URLs.' : 'Generated from the title if left blank.'}
                error={err('slug')}
              />
              <TextField
                name="metaTitle"
                label="Meta title"
                defaultValue={initial.metaTitle}
                maxLength={70}
                error={err('metaTitle')}
              />
              <TextAreaField
                name="metaDescription"
                label="Meta description"
                rows={3}
                defaultValue={initial.metaDescription}
                maxLength={180}
                error={err('metaDescription')}
              />
            </div>
          </AdminCard>
        </div>

        {/* ------------------------------------------------------------ Sidebar */}
        <div className="space-y-4">
          <AdminCard title="Publishing">
            <div className="space-y-4">
              <SelectField
                name="status"
                label="Status"
                defaultValue={initial.status}
                options={[
                  { value: 'DRAFT', label: 'Draft — not visible' },
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'RESERVED', label: 'Reserved' },
                  { value: 'SOLD', label: 'Sold' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
              />
              <CheckboxField
                name="featured"
                value="true"
                defaultChecked={initial.featured}
                label="Feature on the homepage"
              />
              <TextField
                name="quantity"
                label="Quantity in stock"
                inputMode="numeric"
                defaultValue={initial.quantity}
                error={err('quantity')}
              />
            </div>
          </AdminCard>

          <AdminCard title="Pricing" description={`Amounts in ${currencySymbol} excluding VAT.`}>
            <div className="space-y-4">
              <CheckboxField
                name="priceOnApplication"
                value="true"
                checked={poa}
                onChange={(event) => setPoa(event.target.checked)}
                label="Price on application (hides the price)"
              />

              <TextField
                name="priceNet"
                label={`Sale price (${currencySymbol}, ex VAT)`}
                required
                inputMode="decimal"
                defaultValue={initial.priceNet}
                error={err('priceNet')}
              />
              <TextField
                name="retailPriceNet"
                label={`Was / RRP (${currencySymbol})`}
                inputMode="decimal"
                defaultValue={initial.retailPriceNet}
                hint="Optional. Shown struck through if higher than the sale price."
                error={err('retailPriceNet')}
              />
              <TextField
                name="costPriceNet"
                label={`Cost price (${currencySymbol})`}
                inputMode="decimal"
                defaultValue={initial.costPriceNet}
                hint="Internal only — never shown to customers. Used for margin reporting."
                error={err('costPriceNet')}
              />

              <SelectField
                name="vatTreatment"
                label="VAT treatment"
                defaultValue={initial.vatTreatment}
                options={[
                  { value: 'PLUS_VAT', label: 'Plus VAT' },
                  { value: 'VAT_QUALIFYING', label: 'VAT qualifying' },
                  { value: 'MARGIN_SCHEME', label: 'Margin scheme' },
                  { value: 'NO_VAT', label: 'No VAT' },
                ]}
              />
              <TextField
                name="vatRate"
                label="VAT rate (basis points)"
                inputMode="numeric"
                defaultValue={initial.vatRate}
                hint="2000 = 20%."
                error={err('vatRate')}
              />
              <TextField
                name="reservationFee"
                label={`Reservation deposit (${currencySymbol})`}
                inputMode="decimal"
                defaultValue={initial.reservationFee}
                error={err('reservationFee')}
              />
            </div>
          </AdminCard>

          <AdminCard title="Restricted details" description="Visible to staff only, never published.">
            <div className="space-y-4">
              <TextField
                name="registration"
                label="Registration"
                defaultValue={initial.registration}
                error={err('registration')}
              />
              <TextField name="vin" label="VIN" defaultValue={initial.vin} error={err('vin')} />
            </div>
          </AdminCard>

          <div className="sticky bottom-4 space-y-2 rounded-xl border border-steel-200 bg-white p-4 shadow-lift">
            <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full">
              {isEdit ? 'Save changes' : 'Create vehicle'}
            </SubmitButton>

            <Link href="/admin/trucks" className="btn-secondary w-full">
              Cancel
            </Link>

            {isEdit && canDelete ? (
              <button
                type="button"
                onClick={remove}
                className="btn-ghost w-full text-red-600 hover:bg-red-50"
              >
                Delete vehicle
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
