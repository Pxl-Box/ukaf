import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

/**
 * Server-rendered pagination. Building hrefs from the existing query string
 * keeps every active filter when the visitor changes page, and keeps each page
 * crawlable and shareable.
 */
export function Pagination({
  page,
  pages,
  total,
  limit,
  searchParams,
  basePath,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  if (pages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      params.set(key, Array.isArray(value) ? value[0] ?? '' : value);
    }
    if (target > 1) params.set('page', String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-steel-200 pt-6 sm:flex-row"
    >
      <p className="text-sm text-steel-500">
        Showing <span className="font-medium text-steel-800">{from}</span>–
        <span className="font-medium text-steel-800">{to}</span> of{' '}
        <span className="font-medium text-steel-800">{total}</span> vehicles
      </p>

      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className="btn-secondary btn-sm" aria-label="Previous page">
              <ChevronLeftIcon />
              <span className="hidden sm:inline">Previous</span>
            </Link>
          ) : (
            <span className="btn-secondary btn-sm pointer-events-none opacity-45" aria-disabled="true">
              <ChevronLeftIcon />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}
        </li>

        {pageWindow(page, pages).map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} className="px-1.5 text-sm text-steel-400" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                  entry === page
                    ? 'bg-brand-600 text-white'
                    : 'border border-steel-300 bg-white text-steel-700 hover:bg-steel-50',
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} rel="next" className="btn-secondary btn-sm" aria-label="Next page">
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon />
            </Link>
          ) : (
            <span className="btn-secondary btn-sm pointer-events-none opacity-45" aria-disabled="true">
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

/** First, last, and a window around the current page, with gaps elided. */
function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current]);
  for (let offset = 1; offset <= 1; offset += 1) {
    if (current - offset > 1) pages.add(current - offset);
    if (current + offset < total) pages.add(current + offset);
  }
  if (current <= 3) [2, 3, 4].forEach((entry) => entry < total && pages.add(entry));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((entry) => entry > 1 && pages.add(entry));

  const sorted = [...pages].sort((a, b) => a - b);
  const output: Array<number | 'gap'> = [];

  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) output.push('gap');
    output.push(value);
  });

  return output;
}
