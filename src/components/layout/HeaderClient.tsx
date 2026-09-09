'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/client-api';
import { ChevronDownIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from '../ui/Icons';

export type NavItem = { label: string; href: string; description?: string };
export type NavGroup = { label: string; href: string; items?: NavItem[] };

/** Desktop navigation with hover/focus dropdowns for grouped links. */
export function DesktopNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(label: string) {
    if (timer.current) clearTimeout(timer.current);
    setOpen(label);
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(null), 120);
  }

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {groups.map((group) => {
        const isActive = pathname === group.href || pathname.startsWith(`${group.href}/`);
        const hasMenu = Boolean(group.items?.length);

        return (
          <div
            key={group.label}
            className="relative"
            onMouseEnter={() => hasMenu && show(group.label)}
            onMouseLeave={hide}
          >
            <Link
              href={group.href}
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={hasMenu ? open === group.label : undefined}
              onFocus={() => hasMenu && show(group.label)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-steel-100 text-brand-700' : 'text-steel-700 hover:bg-steel-100 hover:text-steel-950',
              )}
            >
              {group.label}
              {hasMenu ? <ChevronDownIcon className="text-xs text-steel-400" /> : null}
            </Link>

            {hasMenu && open === group.label ? (
              <div
                className="absolute left-0 top-full z-50 w-72 animate-fade-in pt-2"
                onMouseEnter={() => show(group.label)}
                onMouseLeave={hide}
              >
                <ul className="overflow-hidden rounded-xl border border-steel-200 bg-white p-1.5 shadow-lift">
                  {group.items!.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(null)}
                        className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-steel-50"
                      >
                        <span className="block text-sm font-medium text-steel-900">{item.label}</span>
                        {item.description ? (
                          <span className="mt-0.5 block text-xs text-steel-500">{item.description}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Slide-over navigation for small screens. */
export function MobileNav({
  groups,
  isSignedIn,
  isStaff,
}: {
  groups: NavGroup[];
  isSignedIn: boolean;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-lg text-steel-700 hover:bg-steel-100 lg:hidden"
      >
        <MenuIcon className="text-xl" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-steel-950/50 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-steel-200 px-4 py-3">
              <span className="text-sm font-semibold text-steel-900">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-steel-600 hover:bg-steel-100"
              >
                <CloseIcon className="text-lg" />
              </button>
            </div>

            <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                {groups.map((group) => (
                  <li key={group.label}>
                    <Link
                      href={group.href}
                      className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-steel-900 hover:bg-steel-50"
                    >
                      {group.label}
                    </Link>
                    {group.items?.length ? (
                      <ul className="mb-1 ml-3 border-l border-steel-200 pl-3">
                        {group.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className="block rounded-lg px-3 py-2 text-sm text-steel-600 hover:bg-steel-50 hover:text-steel-900"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-2 border-t border-steel-200 p-3">
              {isStaff ? (
                <Link href="/admin" className="btn-secondary w-full">
                  Admin dashboard
                </Link>
              ) : null}
              {isSignedIn ? (
                <Link href="/account" className="btn-primary w-full">
                  <UserIcon /> My account
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn-primary w-full">
                    Sign in
                  </Link>
                  <Link href="/register" className="btn-secondary w-full">
                    Create an account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Account dropdown with a sign-out action. */
export function AccountMenu({
  name,
  isStaff,
}: {
  name: string;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  const links = [
    { href: '/account', label: 'Dashboard' },
    { href: '/account/orders', label: 'Orders & reservations' },
    { href: '/account/enquiries', label: 'My enquiries' },
    { href: '/account/saved', label: 'Saved vehicles' },
    { href: '/account/profile', label: 'Profile & addresses' },
    { href: '/account/security', label: 'Security' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-steel-700 hover:bg-steel-100"
      >
        <UserIcon className="text-lg" />
        <span className="hidden max-w-[7rem] truncate xl:inline">{name}</span>
        <ChevronDownIcon className="text-xs text-steel-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-60 animate-fade-in overflow-hidden rounded-xl border border-steel-200 bg-white p-1.5 shadow-lift"
        >
          {isStaff ? (
            <>
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
              >
                Admin dashboard
              </Link>
              <div className="my-1.5 border-t border-steel-100" />
            </>
          ) : null}

          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-steel-700 hover:bg-steel-50 hover:text-steel-950"
            >
              {link.label}
            </Link>
          ))}

          <div className="my-1.5 border-t border-steel-100" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Header search box that submits to the stock listing. */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(query ? `/trucks?q=${encodeURIComponent(query)}` : '/trucks');
      }}
      className={cn('relative', className)}
    >
      <label htmlFor="header-search" className="sr-only">
        Search stock
      </label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-steel-400" />
      <input
        id="header-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search make, model or stock no."
        className="input h-10 py-0 pl-9 text-sm"
      />
    </form>
  );
}
