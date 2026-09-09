import { cookies } from 'next/headers';
import { POLICY_VERSION } from './settings';

/**
 * Cookie consent (UK PECR / GDPR).
 *
 * Nothing beyond strictly necessary cookies is set until the visitor makes a
 * choice. The banner writes a preference cookie for the browser, and the
 * server also stores a durable consent record so the business can evidence
 * what was agreed and when.
 */

export const CONSENT_COOKIE = 'ukaf_consent';
export const CONSENT_ANON_COOKIE = 'ukaf_cid';
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 months, then re-ask

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

export type ConsentState = ConsentCategories & {
  version: string;
  timestamp: string;
};

export const DENY_ALL: ConsentCategories = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

export const ALLOW_ALL: ConsentCategories = {
  necessary: true,
  analytics: true,
  marketing: true,
  preferences: true,
};

export function serialiseConsent(categories: ConsentCategories): string {
  const state: ConsentState = {
    ...categories,
    necessary: true,
    version: POLICY_VERSION,
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(state);
}

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      preferences: parsed.preferences === true,
      version: typeof parsed.version === 'string' ? parsed.version : '0',
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Server-side read of the visitor's current consent. */
export async function getConsent(): Promise<ConsentState | null> {
  const cookieStore = await cookies();
  const state = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);
  if (!state) return null;
  // A newer policy invalidates an older agreement.
  if (state.version !== POLICY_VERSION) return null;
  return state;
}

export async function hasConsentedTo(category: keyof ConsentCategories): Promise<boolean> {
  if (category === 'necessary') return true;
  const state = await getConsent();
  return state?.[category] === true;
}

/**
 * The cookies this site may set, grouped by category. Rendered on the cookie
 * policy page and in the preference centre so the disclosure is always in step
 * with the code.
 */
export const COOKIE_REGISTRY = [
  {
    category: 'necessary' as const,
    title: 'Strictly necessary',
    description:
      'Required for the site to function: signing in, keeping your basket, protecting forms against cross-site request forgery, and remembering your cookie choices. These cannot be switched off.',
    cookies: [
      { name: 'ukaf_session', purpose: 'Keeps you signed in.', duration: '30 days', provider: 'UKAF' },
      { name: 'ukaf_csrf', purpose: 'Protects forms from cross-site request forgery.', duration: '8 hours', provider: 'UKAF' },
      { name: 'ukaf_cart', purpose: 'Remembers the vehicles in your basket before you sign in.', duration: '30 days', provider: 'UKAF' },
      { name: 'ukaf_consent', purpose: 'Stores your cookie preferences.', duration: '6 months', provider: 'UKAF' },
      { name: 'ukaf_cid', purpose: 'Anonymous identifier linking your consent record.', duration: '6 months', provider: 'UKAF' },
      { name: '__stripe_mid / __stripe_sid', purpose: 'Fraud prevention during payment.', duration: '1 year / 30 minutes', provider: 'Stripe' },
    ],
  },
  {
    category: 'preferences' as const,
    title: 'Preferences',
    description: 'Remembers choices you make, such as your display currency and saved search filters.',
    cookies: [
      { name: 'ukaf_currency', purpose: 'Remembers the currency you want prices shown in.', duration: '1 year', provider: 'UKAF' },
      { name: 'ukaf_compare', purpose: 'Remembers the vehicles you added to the comparison tool.', duration: '30 days', provider: 'UKAF' },
    ],
  },
  {
    category: 'analytics' as const,
    title: 'Analytics',
    description:
      'Helps us understand which vehicles and pages are popular so we can improve the site. Set only with your consent.',
    cookies: [
      { name: '_ga / _ga_*', purpose: 'Distinguishes visitors and measures site usage.', duration: '2 years', provider: 'Google Analytics' },
    ],
  },
  {
    category: 'marketing' as const,
    title: 'Marketing',
    description:
      'Used to measure advertising campaigns and show you relevant stock on other websites. Set only with your consent.',
    cookies: [
      { name: '_fbp', purpose: 'Measures advertising performance.', duration: '3 months', provider: 'Meta' },
      { name: '_gcl_au', purpose: 'Measures ad conversions.', duration: '3 months', provider: 'Google Ads' },
    ],
  },
];
