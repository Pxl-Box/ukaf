/**
 * Money handling.
 *
 * Every amount in this application is an integer in the currency's *minor
 * units* (pence, cents, and so on). Floating point is only ever used inside a
 * conversion, never for storage, so rounding error cannot accumulate.
 */

export type CurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  /** Units of this currency per 1 unit of the base currency. */
  rateToBase: number;
  decimals: number;
  isBase: boolean;
  /** Round converted display prices to the nearest N minor units. */
  roundTo: number;
};

export const BASE_CURRENCY_CODE = process.env.NEXT_PUBLIC_BASE_CURRENCY?.toUpperCase() ?? 'GBP';

export const FALLBACK_CURRENCY: CurrencyInfo = {
  code: BASE_CURRENCY_CODE,
  name: 'British Pound',
  symbol: '£',
  rateToBase: 1,
  decimals: 2,
  isBase: true,
  roundTo: 1,
};

/** VAT rates are stored in basis points: 2000 = 20%. */
export const VAT_BASIS_POINTS = 10_000;

/**
 * Normalises a `Currency` row (whose `rateToBase` is a Prisma Decimal) into the
 * plain shape the formatting helpers expect.
 */
export function currencyFromRow(row: {
  code: string;
  name: string;
  symbol: string;
  rateToBase: unknown;
  decimals: number;
  isBase: boolean;
  roundTo: number;
}): CurrencyInfo {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    rateToBase: Number(row.rateToBase),
    decimals: row.decimals,
    isBase: row.isBase,
    roundTo: row.roundTo,
  };
}

function pow10(n: number): number {
  return 10 ** n;
}

/**
 * Converts an amount held in base-currency minor units into the target
 * currency's minor units.
 */
export function convertFromBase(
  amountBaseMinor: number,
  target: CurrencyInfo,
  baseDecimals = 2,
): number {
  if (!Number.isFinite(amountBaseMinor)) return 0;
  if (target.isBase && target.decimals === baseDecimals) return Math.round(amountBaseMinor);

  const major = amountBaseMinor / pow10(baseDecimals);
  const converted = major * target.rateToBase;
  const minor = Math.round(converted * pow10(target.decimals));

  return roundToNearest(minor, target.roundTo);
}

/** Converts an amount in `source` minor units back into base minor units. */
export function convertToBase(
  amountMinor: number,
  source: CurrencyInfo,
  baseDecimals = 2,
): number {
  if (!Number.isFinite(amountMinor)) return 0;
  if (source.isBase && source.decimals === baseDecimals) return Math.round(amountMinor);
  if (source.rateToBase === 0) return 0;

  const major = amountMinor / pow10(source.decimals);
  const baseMajor = major / source.rateToBase;
  return Math.round(baseMajor * pow10(baseDecimals));
}

export function roundToNearest(value: number, step: number): number {
  if (!step || step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Formats a minor-unit amount using the visitor's locale conventions.
 * `compact` renders large figures as e.g. £42.5k for dense listings.
 */
export function formatMoney(
  amountMinor: number,
  currency: CurrencyInfo,
  options: { locale?: string; compact?: boolean; showDecimals?: boolean } = {},
): string {
  const { locale = 'en-GB', compact = false, showDecimals } = options;
  const major = amountMinor / pow10(currency.decimals);

  const shouldShowDecimals =
    showDecimals ?? (currency.decimals > 0 && Math.abs(major % 1) > Number.EPSILON);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: shouldShowDecimals ? currency.decimals : 0,
      maximumFractionDigits: shouldShowDecimals ? currency.decimals : 0,
      notation: compact ? 'compact' : 'standard',
    }).format(major);
  } catch {
    // Unknown ISO code (custom currency row) — fall back to the stored symbol.
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: shouldShowDecimals ? currency.decimals : 0,
      maximumFractionDigits: shouldShowDecimals ? currency.decimals : 0,
      notation: compact ? 'compact' : 'standard',
    }).format(major);
    return `${currency.symbol}${formatted}`;
  }
}

/** Convenience: convert a base amount then format it. */
export function formatFromBase(
  amountBaseMinor: number,
  currency: CurrencyInfo,
  options?: { locale?: string; compact?: boolean; showDecimals?: boolean },
): string {
  return formatMoney(convertFromBase(amountBaseMinor, currency), currency, options);
}

/** Parses "42,500.50" or "£42,500.50" into minor units. Returns null if invalid. */
export function parseMoneyToMinor(input: string, decimals = 2): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * pow10(decimals));
}

// ---------------------------------------------------------------------------
// VAT
// ---------------------------------------------------------------------------

export type VatTreatmentValue = 'PLUS_VAT' | 'VAT_QUALIFYING' | 'MARGIN_SCHEME' | 'NO_VAT';

export const VAT_LABELS: Record<VatTreatmentValue, string> = {
  PLUS_VAT: 'Plus VAT',
  VAT_QUALIFYING: 'VAT qualifying',
  MARGIN_SCHEME: 'Margin scheme — no VAT',
  NO_VAT: 'No VAT',
};

export const VAT_EXPLAINERS: Record<VatTreatmentValue, string> = {
  PLUS_VAT: 'VAT is charged on top of the advertised price and shown separately at checkout.',
  VAT_QUALIFYING:
    'VAT is included in the advertised price and can be reclaimed by VAT-registered buyers, or removed for qualifying exports.',
  MARGIN_SCHEME:
    'Sold under the VAT margin scheme. No VAT is charged and no VAT invoice can be issued.',
  NO_VAT: 'No VAT is applicable to this sale.',
};

export function vatAmountFor(net: number, vatRateBasisPoints: number, treatment: VatTreatmentValue): number {
  if (treatment === 'MARGIN_SCHEME' || treatment === 'NO_VAT') return 0;
  return Math.round((net * vatRateBasisPoints) / VAT_BASIS_POINTS);
}

export function grossFor(net: number, vatRateBasisPoints: number, treatment: VatTreatmentValue): number {
  return net + vatAmountFor(net, vatRateBasisPoints, treatment);
}

export function formatVatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(basisPoints % 100 === 0 ? 0 : 2)}%`;
}

// ---------------------------------------------------------------------------
// Finance calculator
// ---------------------------------------------------------------------------

/**
 * Standard amortising monthly payment with an optional balloon (final) payment.
 * All amounts are minor units; `annualRatePercent` is e.g. 8.9.
 */
export function monthlyPayment(
  principalMinor: number,
  annualRatePercent: number,
  termMonths: number,
  balloonMinor = 0,
): number {
  if (termMonths <= 0) return 0;
  const financed = Math.max(0, principalMinor);
  const monthlyRate = annualRatePercent / 100 / 12;

  if (monthlyRate === 0) {
    return Math.round((financed - balloonMinor) / termMonths);
  }

  const growth = (1 + monthlyRate) ** termMonths;
  const payment = (financed * monthlyRate * growth - balloonMinor * monthlyRate) / (growth - 1);
  return Math.max(0, Math.round(payment));
}

export function totalPayable(
  monthlyMinor: number,
  termMonths: number,
  depositMinor: number,
  balloonMinor = 0,
): number {
  return monthlyMinor * termMonths + depositMinor + balloonMinor;
}
