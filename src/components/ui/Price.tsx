import { getBaseCurrency, getDisplayCurrency } from '@/lib/currency';
import { formatFromBase, formatMoney, VAT_LABELS, vatAmountFor, type VatTreatmentValue } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Price rendering.
 *
 * Catalogue prices are stored in the base currency; these components convert
 * on the server using the visitor's chosen display currency so the markup is
 * identical on first paint and there is no hydration flash.
 */

export async function Price({
  amountBase,
  className,
  compact,
}: {
  amountBase: number;
  className?: string;
  compact?: boolean;
}) {
  const currency = await getDisplayCurrency();
  return <span className={className}>{formatFromBase(amountBase, currency, { compact })}</span>;
}

/**
 * Full price block for cards and vehicle pages: converted price, VAT treatment,
 * and — when the visitor is not viewing base currency — the original price so
 * they can see exactly what will be invoiced.
 */
export async function PriceBlock({
  amountBase,
  vatTreatment,
  vatRate,
  priceOnApplication,
  size = 'md',
  showVatLine = true,
  className,
}: {
  amountBase: number;
  vatTreatment: VatTreatmentValue;
  vatRate: number;
  priceOnApplication?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showVatLine?: boolean;
  className?: string;
}) {
  const [currency, base] = await Promise.all([getDisplayCurrency(), getBaseCurrency()]);

  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl sm:text-4xl',
  } as const;

  if (priceOnApplication) {
    return (
      <div className={className}>
        <p className={cn('font-bold tracking-tight text-steel-900 dark:text-white', sizes[size])}>POA</p>
        {showVatLine ? <p className="mt-0.5 text-xs text-steel-500 dark:text-steel-400">Price on application</p> : null}
      </div>
    );
  }

  const isConverted = currency.code !== base.code;
  const vat = vatAmountFor(amountBase, vatRate, vatTreatment);

  return (
    <div className={className}>
      <p className={cn('font-bold tracking-tight text-steel-950 dark:text-white', sizes[size])}>
        {formatFromBase(amountBase, currency)}
      </p>

      {showVatLine ? (
        <p className="mt-0.5 text-xs text-steel-500 dark:text-steel-400">
          {VAT_LABELS[vatTreatment]}
          {vatTreatment === 'PLUS_VAT' && vat > 0 ? (
            <> · {formatFromBase(amountBase + vat, currency)} inc. VAT</>
          ) : null}
        </p>
      ) : null}

      {isConverted ? (
        <p className="mt-1 text-xs text-steel-400 dark:text-steel-500">
          Invoiced as {formatMoney(amountBase, base)} · indicative conversion
        </p>
      ) : null}
    </div>
  );
}

/** Compact inline price used in tables and lists. */
export async function InlinePrice({
  amountBase,
  priceOnApplication,
  className,
}: {
  amountBase: number;
  priceOnApplication?: boolean;
  className?: string;
}) {
  if (priceOnApplication) return <span className={cn('text-steel-500', className)}>POA</span>;
  const currency = await getDisplayCurrency();
  return (
    <span className={cn('tabular-nums', className)}>{formatFromBase(amountBase, currency)}</span>
  );
}

/** Renders an amount already denominated in a specific currency (e.g. an order). */
export function FixedPrice({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number;
  currency: { code: string; symbol: string; decimals: number; name?: string };
  className?: string;
}) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatMoney(amountMinor, {
        code: currency.code,
        name: currency.name ?? currency.code,
        symbol: currency.symbol,
        decimals: currency.decimals,
        rateToBase: 1,
        isBase: false,
        roundTo: 1,
      })}
    </span>
  );
}
