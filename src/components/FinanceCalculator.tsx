'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { monthlyPayment, totalPayable } from '@/lib/money';

/**
 * Indicative finance illustration.
 *
 * Arithmetic runs client-side for instant feedback; the figures are clearly
 * labelled as an illustration, and any real quotation comes from the lender.
 */
export function FinanceCalculator({
  priceNet,
  apr,
  currencySymbol,
  currencyDecimals,
  rate,
  truckId,
}: {
  /** Vehicle price in base-currency minor units. */
  priceNet: number;
  apr: number;
  currencySymbol: string;
  currencyDecimals: number;
  /** Display-currency units per base unit. */
  rate: number;
  truckId?: string;
}) {
  const [depositPercent, setDepositPercent] = useState(10);
  const [termMonths, setTermMonths] = useState(48);
  const [includeBalloon, setIncludeBalloon] = useState(false);

  const figures = useMemo(() => {
    const deposit = Math.round((priceNet * depositPercent) / 100);
    const balloon = includeBalloon ? Math.round(priceNet * 0.2) : 0;
    const financed = priceNet - deposit;
    const monthly = monthlyPayment(financed, apr, termMonths, balloon);

    return {
      deposit,
      balloon,
      monthly,
      total: totalPayable(monthly, termMonths, deposit, balloon),
      interest: totalPayable(monthly, termMonths, deposit, balloon) - priceNet,
    };
  }, [priceNet, depositPercent, termMonths, includeBalloon, apr]);

  const display = (baseMinor: number) => {
    const value = (baseMinor / 100) * rate;
    return `${currencySymbol}${value.toLocaleString('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: currencyDecimals > 0 ? 0 : 0,
    })}`;
  };

  return (
    <div className="panel">
      <h2 className="text-base font-semibold">Finance illustration</h2>
      <p className="mt-1 text-xs text-steel-500">
        Business users only. Representative {apr}% APR on hire purchase.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="deposit" className="text-sm font-medium text-steel-800">
              Deposit
            </label>
            <span className="text-sm font-semibold tabular-nums text-steel-900">
              {display(figures.deposit)} ({depositPercent}%)
            </span>
          </div>
          <input
            id="deposit"
            type="range"
            min={5}
            max={50}
            step={5}
            value={depositPercent}
            onChange={(event) => setDepositPercent(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-steel-200 accent-brand-600"
          />
        </div>

        <div>
          <label htmlFor="term" className="mb-1.5 block text-sm font-medium text-steel-800">
            Term
          </label>
          <select
            id="term"
            value={termMonths}
            onChange={(event) => setTermMonths(Number(event.target.value))}
            className="select py-2 text-sm"
          >
            {[12, 24, 36, 48, 60].map((months) => (
              <option key={months} value={months}>
                {months} months ({months / 12} {months === 12 ? 'year' : 'years'})
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={includeBalloon}
            onChange={(event) => setIncludeBalloon(event.target.checked)}
            className="checkbox mt-0.5"
          />
          <span className="text-sm text-steel-700">
            Include a balloon payment
            <span className="block text-xs text-steel-500">
              Lowers the monthly figure, with 20% of the price due at the end of the term.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 rounded-lg bg-steel-950 p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-steel-400">Estimated monthly payment</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {display(figures.monthly)}
          <span className="text-base font-medium text-steel-400">/month</span>
        </p>

        <dl className="mt-4 space-y-1.5 text-xs">
          <Row label="Deposit" value={display(figures.deposit)} />
          {includeBalloon ? <Row label="Final payment" value={display(figures.balloon)} /> : null}
          <Row label={`${termMonths} monthly payments`} value={display(figures.monthly * termMonths)} />
          <Row label="Total payable" value={display(figures.total)} emphasis />
        </dl>
      </div>

      <Link
        href={truckId ? `/finance?truck=${truckId}` : '/finance'}
        className="btn-secondary mt-4 w-full"
      >
        Get a personalised quote
      </Link>

      <p className="mt-3 text-[11px] leading-relaxed text-steel-400">
        Illustration only and not an offer of finance. Excludes VAT, fees and any option-to-purchase charge. Subject to
        status, credit checks and lender approval. We are a credit broker, not a lender.
      </p>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={
        emphasis
          ? 'flex justify-between border-t border-white/15 pt-2 font-semibold'
          : 'flex justify-between text-steel-400'
      }
    >
      <dt>{label}</dt>
      <dd className={emphasis ? 'tabular-nums' : 'tabular-nums text-white'}>{value}</dd>
    </div>
  );
}
