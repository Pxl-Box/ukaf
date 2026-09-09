import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckIcon, ShieldIcon } from '../ui/Icons';

/**
 * Two-column shell shared by every authentication screen: the form on the
 * left, reassurance and context on the right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  highlights,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  highlights?: string[];
}) {
  const points = highlights ?? [
    'Save vehicles and get alerts when the price changes',
    'Track reservations, orders and enquiries in one place',
    'Faster checkout with your details saved securely',
    'Request part-exchange valuations and finance quotes',
  ];

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-[15px] text-steel-600">{subtitle}</p> : null}

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 text-center text-sm text-steel-600">{footer}</div> : null}

          <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-steel-400">
            <ShieldIcon className="mt-0.5 shrink-0 text-emerald-600" />
            Your password is hashed and never stored in readable form. We use secure, http-only session cookies and
            never sell your data. See our{' '}
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-steel-600">
              privacy policy
            </Link>
            .
          </p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl bg-steel-950 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">UKAF account</p>
            <h2 className="mt-2 text-xl font-bold">Everything about your fleet purchase, in one place</h2>

            <ul className="mt-6 space-y-3.5">
              {points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-steel-300">
                  <CheckIcon className="mt-0.5 shrink-0 text-emerald-400" />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-sm italic leading-relaxed text-steel-300">
                “Straightforward buying process and the truck was exactly as described. Delivered to our yard in
                Aberdeen two days after we paid.”
              </p>
              <p className="mt-3 text-xs text-steel-500">Fleet manager, national haulier</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
