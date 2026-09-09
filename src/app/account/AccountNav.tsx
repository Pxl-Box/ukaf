'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import {
  DashboardIcon,
  HeartIcon,
  LogoutIcon,
  MailIcon,
  ReceiptIcon,
  ShieldIcon,
  UserIcon,
} from '@/components/ui/Icons';

const LINKS = [
  { href: '/account', label: 'Dashboard', icon: <DashboardIcon />, exact: true },
  { href: '/account/orders', label: 'Orders', icon: <ReceiptIcon />, count: 'orders' as const },
  { href: '/account/enquiries', label: 'Enquiries', icon: <MailIcon />, count: 'enquiries' as const },
  { href: '/account/saved', label: 'Saved vehicles', icon: <HeartIcon />, count: 'saved' as const },
  { href: '/account/profile', label: 'Profile & addresses', icon: <UserIcon /> },
  { href: '/account/security', label: 'Security', icon: <ShieldIcon /> },
];

export function AccountNav({
  counts,
}: {
  counts: { orders: number; saved: number; enquiries: number };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/');
    router.refresh();
  }

  return (
    <nav aria-label="Account">
      <ul className="space-y-0.5">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const count = link.count ? counts[link.count] : undefined;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-steel-700 hover:bg-steel-100 hover:text-steel-950',
                )}
              >
                <span className={cn('text-base', active ? 'text-brand-600' : 'text-steel-400')}>{link.icon}</span>
                <span className="flex-1">{link.label}</span>
                {count ? <span className="text-xs tabular-nums text-steel-400">{count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={signOut}
        className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-steel-600 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <LogoutIcon className="text-base text-steel-400" />
        Sign out
      </button>
    </nav>
  );
}
