import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Consistent page header for every admin screen. */
export function AdminHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: { label: string; href: string };
}) {
  return (
    <header className="mb-6">
      {breadcrumb ? (
        <Link
          href={breadcrumb.href}
          className="mb-1.5 inline-block text-xs font-medium text-steel-500 hover:text-brand-600 dark:text-steel-400 dark:hover:text-brand-400"
        >
          ← {breadcrumb.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-steel-500 dark:text-steel-400">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/** Card wrapper used for admin tables and forms. */
export function AdminCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-steel-200 bg-white shadow-card dark:border-steel-800 dark:bg-steel-900',
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-200 px-5 py-3.5 dark:border-steel-800">
          <div>
            <h2 className="text-sm font-semibold text-steel-900 dark:text-steel-100">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-steel-500 dark:text-steel-400">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

/** Horizontally scrollable table wrapper — admin tables are wide. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[48rem] text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-steel-200 bg-steel-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-steel-500 dark:border-steel-800 dark:bg-steel-900 dark:text-steel-400',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={cn(
        'border-b border-steel-100 px-4 py-3 align-middle text-steel-700 dark:border-steel-800 dark:text-steel-300',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Empty row shown inside an admin table when there is nothing to list. */
export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-steel-400 dark:text-steel-500">
        {message}
      </td>
    </tr>
  );
}
