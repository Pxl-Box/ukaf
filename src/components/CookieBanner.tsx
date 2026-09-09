'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, readCookie } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { CookieIcon } from './ui/Icons';

/**
 * Cookie consent banner and preference centre (UK PECR / UK GDPR).
 *
 * Non-essential cookies are only ever set after an affirmative choice, reject
 * is as easy as accept, and the recorded decision is also persisted server-side
 * so the business can evidence consent.
 */

const CONSENT_COOKIE = 'ukaf_consent';
const POLICY_VERSION = '1.0';
const OPEN_EVENT = 'ukaf:open-cookie-preferences';

type Categories = { analytics: boolean; marketing: boolean; preferences: boolean };

const CATEGORY_COPY: Array<{
  key: keyof Categories;
  title: string;
  description: string;
}> = [
  {
    key: 'preferences',
    title: 'Preferences',
    description:
      'Remembers choices such as your display currency and the vehicles in your comparison list, so the site behaves the way you left it.',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    description:
      'Anonymous statistics about which pages and vehicles are viewed, so we can improve the site. Never used to identify you.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    description:
      'Lets us measure our advertising and show you relevant stock on other websites. Switched off unless you turn it on.',
  },
];

function hasValidConsent(): boolean {
  const raw = readCookie(CONSENT_COOKIE);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version === POLICY_VERSION;
  } catch {
    return false;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<Categories>({
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    // Deferred so the banner never blocks first paint.
    const timer = setTimeout(() => {
      if (!hasValidConsent()) setVisible(true);
    }, 400);

    const openPreferences = () => {
      const raw = readCookie(CONSENT_COOKIE);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<Categories>;
          setCategories({
            analytics: parsed.analytics === true,
            marketing: parsed.marketing === true,
            preferences: parsed.preferences === true,
          });
        } catch {
          // Malformed cookie — fall back to all-off.
        }
      }
      setShowDetail(true);
      setVisible(true);
    };

    window.addEventListener(OPEN_EVENT, openPreferences);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, openPreferences);
    };
  }, []);

  const save = useCallback(async (choice: Categories) => {
    setSaving(true);
    try {
      await apiFetch('/api/consent', {
        method: 'POST',
        json: { ...choice, policyVersion: POLICY_VERSION },
      });
    } catch {
      // The server record is best-effort; the cookie below is what gates scripts.
      const value = JSON.stringify({
        necessary: true,
        ...choice,
        version: POLICY_VERSION,
        timestamp: new Date().toISOString(),
      });
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    } finally {
      setSaving(false);
      setVisible(false);
      setShowDetail(false);
    }
  }, []);

  /**
   * The banner is fixed to the bottom of the viewport, so without this it sits
   * on top of whatever is at the foot of the page — including submit buttons.
   * Padding the body keeps every control reachable while it is shown.
   */
  useEffect(() => {
    if (!visible) return;

    const banner = bannerRef.current;
    if (!banner) return;

    const applyPadding = () => {
      document.body.style.paddingBottom = `${banner.offsetHeight}px`;
    };

    applyPadding();
    const observer = new ResizeObserver(applyPadding);
    observer.observe(banner);

    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [visible, showDetail]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
      className="fixed inset-x-0 bottom-0 z-[70] animate-fade-in border-t border-steel-200 bg-white shadow-[0_-8px_32px_-12px_rgba(16,24,40,.25)]"
    >
      <div className="container-page py-5">
        {!showDetail ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3.5">
              <CookieIcon className="mt-0.5 shrink-0 text-2xl text-accent-500" />
              <div className="max-w-3xl">
                <h2 id="cookie-banner-title" className="text-sm font-semibold text-steel-950">
                  We use cookies
                </h2>
                <p id="cookie-banner-description" className="mt-1 text-sm leading-relaxed text-steel-600">
                  Some cookies are essential to keep you signed in, hold your basket and secure our forms. We would also
                  like to set optional cookies for preferences, analytics and marketing — but only if you agree. Read
                  our{' '}
                  <Link href="/legal/cookies" className="font-medium text-brand-600 underline underline-offset-2">
                    cookie policy
                  </Link>{' '}
                  or{' '}
                  <Link href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDetail(true)}
                className="btn-ghost btn-sm order-3 sm:order-1"
              >
                Manage preferences
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ analytics: false, marketing: false, preferences: false })}
                className="btn-secondary btn-sm order-2"
              >
                Reject optional
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ analytics: true, marketing: true, preferences: true })}
                className="btn-primary btn-sm order-1 sm:order-3"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-steel-950">Cookie preferences</h2>
                <p className="mt-1 text-sm text-steel-600">
                  Choose which optional cookies to allow. You can change this at any time from the link in our footer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="btn-ghost btn-sm shrink-0"
                aria-label="Back to summary"
              >
                Back
              </button>
            </div>

            <ul className="mb-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <li className="rounded-lg border border-steel-200 bg-steel-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-steel-900">Strictly necessary</span>
                  <span className="badge-success">Always on</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-steel-600">
                  Sign-in, basket, security and your cookie choice. The site cannot work without these.
                </p>
              </li>

              {CATEGORY_COPY.map((item) => (
                <li key={item.key} className="rounded-lg border border-steel-200 p-3.5">
                  <label className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-steel-900">{item.title}</span>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={categories[item.key]}
                      onChange={(event) =>
                        setCategories((current) => ({ ...current, [item.key]: event.target.checked }))
                      }
                    />
                  </label>
                  <p className="mt-1.5 text-xs leading-relaxed text-steel-600">{item.description}</p>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ analytics: false, marketing: false, preferences: false })}
                className="btn-secondary btn-sm"
              >
                Reject optional
              </button>
              <button type="button" disabled={saving} onClick={() => save(categories)} className="btn-primary btn-sm">
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Re-opens the preference centre — used in the footer and cookie policy page. */
export function CookiePreferencesLink({
  className,
  children = 'Cookie preferences',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      className={cn('text-left', className)}
    >
      {children}
    </button>
  );
}
