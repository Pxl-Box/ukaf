import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertIcon, CheckCircleIcon, ChevronRightIcon, InfoIcon } from './Icons';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'badge-neutral',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn(TONE_CLASS[tone], className)}>{children}</span>;
}

const ALERT_STYLES: Record<Tone, { wrapper: string; icon: ReactNode }> = {
  neutral: {
    wrapper: 'border-steel-200 bg-steel-50 text-steel-800 dark:border-steel-700 dark:bg-steel-900 dark:text-steel-200',
    icon: <InfoIcon className="text-steel-500" />,
  },
  info: {
    wrapper: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200',
    icon: <InfoIcon className="text-brand-600" />,
  },
  success: {
    wrapper:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    icon: <CheckCircleIcon className="text-emerald-600" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
    icon: <AlertIcon className="text-amber-600" />,
  },
  danger: {
    wrapper: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
    icon: <AlertIcon className="text-red-600" />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3.5 text-sm', style.wrapper, className)}
    >
      <span className="mt-0.5 shrink-0 text-base">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-1', 'leading-relaxed')}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-steel-300 bg-white px-6 py-14 text-center dark:border-steel-700 dark:bg-steel-900">
      {icon ? <div className="mb-4 text-3xl text-steel-400">{icon}</div> : null}
      <h3 className="text-base font-semibold text-steel-900 dark:text-steel-100">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-steel-500 dark:text-steel-400">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const accent: Record<Tone, string> = {
    neutral: 'text-steel-900 dark:text-steel-100',
    info: 'text-brand-700 dark:text-brand-400',
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400',
  };

  return (
    <div className="panel">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-steel-500 dark:text-steel-400">{label}</p>
        {icon ? <span className="text-lg text-steel-400">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', accent[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-steel-500 dark:text-steel-400">{hint}</p> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-[15px] leading-relaxed text-steel-600 dark:text-steel-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-steel-500 dark:text-steel-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-steel-700 dark:text-steel-200' : ''}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronRightIcon className="text-steel-300" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Definition-list row used across vehicle specs and order summaries. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <dt className="shrink-0 text-sm text-steel-500 dark:text-steel-400">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-steel-900 dark:text-steel-100">{value}</dd>
    </div>
  );
}
