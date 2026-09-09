import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { NewsletterForm } from '../forms/NewsletterForm';
import { CookiePreferencesLink } from '../CookieBanner';
import { MailIcon, MapPinIcon, PhoneIcon, ShieldIcon } from '../ui/Icons';

export async function Footer() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    prisma.category
      .findMany({
        where: { isActive: true },
        select: { name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
        take: 7,
      })
      .catch(() => []),
  ]);

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-steel-800 bg-steel-950 text-steel-300">
      {/* Newsletter */}
      <div className="border-b border-white/10">
        <div className="container-page flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <h2 className="text-xl font-bold text-white">New stock alerts</h2>
            <p className="mt-1.5 text-sm text-steel-400">
              Be first to see new arrivals. Occasional emails about stock that matches what you are looking for —
              unsubscribe in one click.
            </p>
          </div>
          <NewsletterForm className="w-full lg:max-w-md" />
        </div>
      </div>

      {/* Link columns */}
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-white">
            UKAF<span className="text-accent-500">.</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-steel-400">{settings.tagline}</p>

          <address className="mt-5 space-y-2.5 text-sm not-italic text-steel-400">
            {settings.address ? (
              <p className="flex gap-2.5">
                <MapPinIcon className="mt-0.5 shrink-0 text-steel-500" />
                <span>{settings.address}</span>
              </p>
            ) : null}
            {settings.contactPhone ? (
              <p className="flex gap-2.5">
                <PhoneIcon className="mt-0.5 shrink-0 text-steel-500" />
                <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="hover:text-white">
                  {settings.contactPhone}
                </a>
              </p>
            ) : null}
            {settings.contactEmail ? (
              <p className="flex gap-2.5">
                <MailIcon className="mt-0.5 shrink-0 text-steel-500" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-white">
                  {settings.contactEmail}
                </a>
              </p>
            ) : null}
          </address>

          <p className="mt-5 flex items-center gap-2 text-xs text-steel-500">
            <ShieldIcon className="text-base text-emerald-500" />
            Secure payments by Stripe · 3-D Secure enabled
          </p>
        </div>

        <FooterColumn
          title="Stock"
          links={[
            { label: 'All vehicles', href: '/trucks' },
            ...categories.map((category) => ({
              label: category.name,
              href: `/trucks?category=${category.slug}`,
            })),
          ]}
        />

        <FooterColumn
          title="Services"
          links={[
            { label: 'Finance & leasing', href: '/finance' },
            { label: 'Part exchange', href: '/part-exchange' },
            { label: 'Sell your truck', href: '/sell-your-truck' },
            { label: 'Delivery & export', href: '/delivery' },
            { label: 'Warranty', href: '/warranty' },
            { label: 'Compare vehicles', href: '/compare' },
          ]}
        />

        <FooterColumn
          title="Company"
          links={[
            { label: 'About us', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'My account', href: '/account' },
            { label: 'Terms & conditions', href: '/legal/terms' },
            { label: 'Privacy policy', href: '/legal/privacy' },
            { label: 'Cookie policy', href: '/legal/cookies' },
            { label: 'Returns & cancellation', href: '/legal/returns' },
          ]}
        />
      </div>

      {/* Legal strip */}
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-steel-500 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {env.company.name}. All rights reserved.
            {env.company.number ? <> Registered in England & Wales no. {env.company.number}.</> : null}
            {env.company.vat ? <> VAT {env.company.vat}.</> : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CookiePreferencesLink className="hover:text-white hover:underline" />
            <Link href="/legal/privacy" className="hover:text-white hover:underline">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-white hover:underline">
              Terms
            </Link>
            <Link href="/sitemap.xml" className="hover:text-white hover:underline">
              Sitemap
            </Link>
          </div>
        </div>

        <div className="container-page pb-8">
          <p className="text-[11px] leading-relaxed text-steel-600">
            Vehicle images are for illustration; specification should be confirmed before purchase. Prices exclude VAT
            unless stated. Finance is subject to status and available to business users only — written quotations on
            request. {env.company.name} is a credit broker, not a lender, and may receive a commission from lenders.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link href={link.href} className="text-steel-400 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
