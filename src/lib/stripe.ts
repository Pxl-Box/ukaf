import Stripe from 'stripe';
import { env } from './env';

/**
 * Stripe client.
 *
 * Returns null when unconfigured so the rest of the app can degrade to
 * "enquire about this vehicle" rather than crashing at import time.
 */

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.stripe.secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
      appInfo: { name: 'UKAF Commercials', version: '1.0.0' },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return stripeClient;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY to enable online payment.');
  }
  return stripe;
}

export const isStripeEnabled = (): boolean => Boolean(env.stripe.secretKey);

/**
 * Stripe rejects amounts below roughly £0.30 and above its per-currency
 * ceiling; charging a card for a £250k truck is also generally undesirable, so
 * full-purchase checkout is capped and falls back to a bank transfer flow.
 */
export const STRIPE_MIN_AMOUNT_MINOR = 100;
export const STRIPE_MAX_CARD_AMOUNT_MINOR = 100_000_00; // £100,000

/** Currencies Stripe treats as zero-decimal (amount is already in major units). */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

export function isZeroDecimalCurrency(code: string): boolean {
  return ZERO_DECIMAL.has(code.toUpperCase());
}

/**
 * Converts our minor-unit integer into the integer Stripe expects for a given
 * currency. Our `Currency.decimals` column already matches Stripe's convention,
 * so this is mostly a guard against a mis-configured currency row.
 */
export function toStripeAmount(amountMinor: number, currencyCode: string, decimals: number): number {
  if (isZeroDecimalCurrency(currencyCode) && decimals !== 0) {
    return Math.round(amountMinor / 10 ** decimals);
  }
  return Math.round(amountMinor);
}

export function stripeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'type' in error) {
    const stripeError = error as Stripe.errors.StripeError;
    switch (stripeError.type) {
      case 'StripeCardError':
        return stripeError.message ?? 'Your card was declined.';
      case 'StripeInvalidRequestError':
        return 'We could not start the payment. Please contact us so we can complete your order.';
      case 'StripeRateLimitError':
        return 'Too many payment attempts. Please wait a moment and try again.';
      default:
        return 'Payment could not be processed. Please try again or contact us.';
    }
  }
  return 'Payment could not be processed. Please try again or contact us.';
}
