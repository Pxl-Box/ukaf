import { cache } from 'react';
import { prisma } from './db';
import { env } from './env';

/**
 * Site settings live in the `settings` table so staff can change them without
 * a redeploy. Reads are cached per request and fall back to defaults when the
 * row is missing or the database is unavailable (e.g. during a static build).
 */

export type SiteSettings = {
  siteName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  openingHours: string;
  /** Default reservation deposit, in base-currency minor units. */
  defaultReservationFee: number;
  /** Default VAT rate in basis points. */
  defaultVatRate: number;
  /** Representative APR used by the finance calculator. */
  financeApr: number;
  enableGuestCheckout: boolean;
  enableFullPurchase: boolean;
  maintenanceMode: boolean;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: env.company.name,
  tagline: 'Quality used HGVs, trailers and commercial vehicles, ready to work.',
  contactEmail: env.company.email,
  contactPhone: env.company.phone,
  address: env.company.address,
  openingHours: 'Mon–Fri 8:00–17:30 · Sat 9:00–13:00 · Sun closed',
  defaultReservationFee: 50_000,
  defaultVatRate: 2000,
  financeApr: 8.9,
  enableGuestCheckout: true,
  enableFullPurchase: false,
  maintenanceMode: false,
};

const SETTINGS_KEY = 'site';

export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };

  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next, group: 'general' },
    update: { value: next },
  });

  return next;
}

/** Current cookie/privacy policy version — bumping it re-prompts every visitor. */
export const POLICY_VERSION = '1.0';
