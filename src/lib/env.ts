/**
 * Centralised, validated environment access.
 *
 * Anything security-critical is read through here so that a missing variable
 * fails loudly at boot in production rather than silently degrading (e.g. an
 * empty AUTH_SECRET would otherwise make every session token forgeable).
 */

type Nullable = string | undefined;

function read(key: string): Nullable {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function requireInProduction(key: string, fallback?: string): string {
  const value = read(key);
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[env] ${key} is required in production. Set it in your hosting provider's environment configuration.`,
    );
  }
  return fallback ?? '';
}

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Dev fallback secret. Deliberately obvious — production throws instead.
 */
const DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production-0000000000';

export const env = {
  databaseUrl: requireInProduction('DATABASE_URL'),

  siteUrl: (read('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3002').replace(/\/$/, ''),
  /**
   * Optional second trusted origin for a dedicated admin process (e.g. the
   * same app run again on another port/domain with ADMIN_ONLY=true). CSRF
   * accepts requests from either origin when this is set.
   */
  adminSiteUrl: read('ADMIN_SITE_URL')?.replace(/\/$/, ''),

  authSecret: requireInProduction('AUTH_SECRET', DEV_SECRET),

  stripe: {
    secretKey: read('STRIPE_SECRET_KEY'),
    publishableKey: read('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
    webhookSecret: read('STRIPE_WEBHOOK_SECRET'),
    get enabled() {
      return Boolean(read('STRIPE_SECRET_KEY'));
    },
  },

  resend: {
    apiKey: read('RESEND_API_KEY'),
    from: read('EMAIL_FROM') ?? 'UKAF Commercials <onboarding@resend.dev>',
    replyTo: read('EMAIL_REPLY_TO'),
    salesInbox: (read('SALES_NOTIFICATION_EMAILS') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    get enabled() {
      return Boolean(read('RESEND_API_KEY'));
    },
  },

  fx: {
    apiUrl: read('FX_API_URL'),
    apiKey: read('FX_API_KEY'),
  },

  cronSecret: read('CRON_SECRET'),

  baseCurrency: (read('BASE_CURRENCY') ?? 'GBP').toUpperCase(),

  seed: {
    adminEmail: read('SEED_ADMIN_EMAIL') ?? 'admin@ukaf.co.uk',
    adminPassword: read('SEED_ADMIN_PASSWORD') ?? 'ChangeMe!2024',
  },

  company: {
    name: read('NEXT_PUBLIC_COMPANY_NAME') ?? 'UKAF Commercials Ltd',
    number: read('NEXT_PUBLIC_COMPANY_NUMBER') ?? '',
    vat: read('NEXT_PUBLIC_VAT_NUMBER') ?? '',
    address: read('NEXT_PUBLIC_COMPANY_ADDRESS') ?? '',
    phone: read('NEXT_PUBLIC_COMPANY_PHONE') ?? '',
    email: read('NEXT_PUBLIC_COMPANY_EMAIL') ?? 'sales@ukaf.co.uk',
  },
} as const;

/**
 * Warn once at boot about optional integrations that are switched off, so a
 * misconfigured deployment is obvious in the logs.
 */
let integrationStatusReported = false;

export function reportIntegrationStatus(): void {
  // Next.js imports the root layout in several build workers; without this the
  // same warnings are printed a dozen times.
  if (integrationStatusReported) return;
  integrationStatusReported = true;

  // Nothing to warn about while building — only when actually serving traffic.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  if (isProduction) {
    if (!env.stripe.enabled) console.warn('[env] Stripe is not configured — checkout is disabled.');
    if (!env.stripe.webhookSecret) console.warn('[env] STRIPE_WEBHOOK_SECRET missing — webhooks will be rejected.');
    if (!env.resend.enabled) console.warn('[env] Resend is not configured — transactional email is disabled.');
  }
}
