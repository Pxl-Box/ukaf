/** Small shared helpers used across server and client components. */

/** Conditional className joiner (a tiny `clsx`). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Unicode combining marks (U+0300-U+036F), stripped after NFKD normalisation. */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g');

/** URL-safe slug. Falls back to a random suffix when the input has no letters. */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `item-${Math.random().toString(36).slice(2, 8)}`;
}

/** Appends a numeric suffix until `exists` reports the slug as free. */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 200) return `${root}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return candidate;
}

export function formatNumber(value: number | null | undefined, locale = 'en-GB'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale).format(value);
}

export function formatMileage(km: number | null | undefined, unit: 'km' | 'mi' = 'km'): string {
  if (km === null || km === undefined) return '—';
  const value = unit === 'mi' ? Math.round(km * 0.621371) : km;
  return `${formatNumber(value)} ${unit}`;
}

export function formatWeight(kg: number | null | undefined): string {
  if (!kg) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1)} t`;
  return `${formatNumber(kg)} kg`;
}

export function formatDate(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-GB',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatDateTime(value: Date | string | null | undefined, locale = 'en-GB'): string {
  return formatDate(
    value,
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    locale,
  );
}

export function relativeTime(value: Date | string | null | undefined, locale = 'en-GB'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'just now';
}

export function truncate(value: string, length = 140): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

/** Turns SCREAMING_SNAKE_CASE enum values into readable labels. */
export function humanise(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Escapes user input before it is embedded in an HTML email body.
 * React escapes automatically; hand-built HTML strings do not.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Guards against open redirects: only same-site, non protocol-relative paths
 * are allowed as a `next=` destination.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

/** Builds a query string, dropping empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Deterministic placeholder image for stock without photographs. */
export const PLACEHOLDER_IMAGE = '/images/placeholder-truck.svg';

export function primaryImage(images: Array<{ url: string; isPrimary: boolean }> | undefined): string {
  if (!images || images.length === 0) return PLACEHOLDER_IMAGE;
  return (images.find((image) => image.isPrimary) ?? images[0]).url;
}
