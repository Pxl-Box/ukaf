import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { getActiveCurrencies, getDisplayCurrency } from '@/lib/currency';
import { getCartCount } from '@/lib/cart';
import { getSettings } from '@/lib/settings';
import { ThemeToggle } from '../ThemeToggle';
import { CartIcon, HeartIcon, PhoneIcon } from '../ui/Icons';
import { CurrencySwitcher } from './CurrencySwitcher';
import { AccountMenu, DesktopNav, HeaderSearch, MobileNav, type NavGroup } from './HeaderClient';

/**
 * Site header. A server component so the cart badge, saved count and account
 * state are correct on first paint; only the interactive pieces ship JS.
 */
export async function Header() {
  const [user, currencies, currency, settings] = await Promise.all([
    getCurrentUser(),
    getActiveCurrencies(),
    getDisplayCurrency(),
    getSettings(),
  ]);

  const [categories, cartCount, savedCount] = await Promise.all([
    prisma.category
      .findMany({
        where: { isActive: true },
        select: { name: true, slug: true, description: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      })
      .catch(() => []),
    getCartCount().catch(() => 0),
    user
      ? prisma.savedTruck.count({ where: { userId: user.id } }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const groups: NavGroup[] = [
    {
      label: 'Stock',
      href: '/trucks',
      items: [
        { label: 'All vehicles', href: '/trucks', description: 'Browse everything currently available' },
        ...categories.map((category) => ({
          label: category.name,
          href: `/trucks?category=${category.slug}`,
          description: category.description ?? undefined,
        })),
      ],
    },
    {
      label: 'Services',
      href: '/finance',
      items: [
        { label: 'Finance & leasing', href: '/finance', description: 'Hire purchase and contract hire' },
        { label: 'Part exchange', href: '/part-exchange', description: 'Free valuation on your current vehicle' },
        { label: 'Sell your truck', href: '/sell-your-truck', description: 'We buy quality commercial stock' },
        { label: 'Delivery & export', href: '/delivery', description: 'UK delivery and worldwide export' },
        { label: 'Warranty', href: '/warranty', description: 'Cover options on every vehicle' },
      ],
    },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const staff = isStaff(user);

  return (
    <header className="sticky top-0 z-50 border-b border-steel-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {/* Utility bar */}
      <div className="bg-steel-950 text-white">
        <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
          <p className="hidden truncate text-white/70 sm:block">{settings.tagline}</p>

          <div className="flex items-center gap-4">
            {settings.contactPhone ? (
              <a
                href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1.5 font-medium text-white/90 hover:text-white"
              >
                <PhoneIcon /> {settings.contactPhone}
              </a>
            ) : null}
            <span className="hidden text-white/50 md:inline">{settings.openingHours}</span>
            <CurrencySwitcher
              currencies={currencies.map((entry) => ({
                code: entry.code,
                symbol: entry.symbol,
                name: entry.name,
              }))}
              current={currency.code}
            />
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${settings.siteName} home`}>
          <span className="text-2xl font-extrabold tracking-tight text-steel-950">
            UKAF<span className="text-accent-500">.</span>
          </span>
          <span className="hidden text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-steel-400 sm:block">
            Commercial
            <br />
            Vehicles
          </span>
        </Link>

        <DesktopNav groups={groups} />

        <HeaderSearch className="ml-auto hidden w-full max-w-xs md:block" />

        <div className="ml-auto flex items-center gap-0.5 md:ml-2">
          <ThemeToggle className="hidden h-10 w-10 place-items-center rounded-lg text-steel-500 hover:bg-steel-100 hover:text-steel-900 dark:text-steel-400 dark:hover:bg-steel-800 dark:hover:text-white sm:grid" />

          <Link
            href="/account/saved"
            className="relative hidden h-10 w-10 place-items-center rounded-lg text-steel-700 hover:bg-steel-100 sm:grid"
            aria-label={`Saved vehicles${savedCount ? ` (${savedCount})` : ''}`}
          >
            <HeartIcon className="text-lg" />
            {savedCount > 0 ? <CountBadge value={savedCount} /> : null}
          </Link>

          <Link
            href="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-lg text-steel-700 hover:bg-steel-100"
            aria-label={`Basket${cartCount ? ` (${cartCount} items)` : ' (empty)'}`}
          >
            <CartIcon className="text-lg" />
            {cartCount > 0 ? <CountBadge value={cartCount} /> : null}
          </Link>

          {user ? (
            <AccountMenu name={user.firstName} isStaff={staff} />
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Create account
              </Link>
            </div>
          )}

          <MobileNav groups={groups} isSignedIn={Boolean(user)} isStaff={staff} />
        </div>
      </div>
    </header>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white">
      {value > 9 ? '9+' : value}
    </span>
  );
}
