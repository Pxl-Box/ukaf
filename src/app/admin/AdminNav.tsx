'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  BriefcaseIcon,
  ChartIcon,
  CurrencyIcon,
  DashboardIcon,
  DocumentIcon,
  MailIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from '@/components/ui/Icons';

type BadgeKey = 'leads' | 'orders' | 'stock' | 'tasks';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: BadgeKey;
  /** Minimum role required to see the link. */
  minRole?: Role;
};

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  SALES: 10,
  MANAGER: 20,
  ADMIN: 30,
  SUPERADMIN: 40,
};

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: <DashboardIcon />, exact: true }],
  },
  {
    title: 'Sales',
    items: [
      { href: '/admin/leads', label: 'Enquiries', icon: <MailIcon />, badge: 'leads' },
      { href: '/admin/pipeline', label: 'Pipeline', icon: <ChartIcon /> },
      { href: '/admin/orders', label: 'Orders', icon: <ReceiptIcon />, badge: 'orders' },
      { href: '/admin/finance', label: 'Finance enquiries', icon: <BriefcaseIcon /> },
      { href: '/admin/customers', label: 'Customers', icon: <UsersIcon /> },
    ],
  },
  {
    title: 'Stock',
    items: [
      { href: '/admin/trucks', label: 'Vehicles', icon: <TruckIcon />, badge: 'stock' },
      { href: '/admin/catalogue', label: 'Makes & categories', icon: <TagIcon />, minRole: 'MANAGER' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/admin/currencies', label: 'Currencies', icon: <CurrencyIcon />, minRole: 'MANAGER' },
      { href: '/admin/discounts', label: 'Discounts', icon: <TagIcon />, minRole: 'MANAGER' },
      { href: '/admin/pages', label: 'Legal pages', icon: <DocumentIcon />, minRole: 'ADMIN' },
      { href: '/admin/users', label: 'Users & roles', icon: <ShieldIcon />, minRole: 'ADMIN' },
      { href: '/admin/settings', label: 'Settings', icon: <SettingsIcon />, minRole: 'ADMIN' },
      { href: '/admin/audit', label: 'Audit log', icon: <DocumentIcon />, minRole: 'ADMIN' },
    ],
  },
];

export function AdminNav({
  role,
  badges,
  variant = 'vertical',
}: {
  role: Role;
  badges: Record<BadgeKey, number>;
  variant?: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();

  const visible = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole]),
  })).filter((section) => section.items.length > 0);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  if (variant === 'horizontal') {
    return (
      <nav aria-label="Admin" className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1.5">
          {visible.flatMap((section) => section.items).map((item) => {
            const count = item.badge ? badges[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium',
                    isActive(item)
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-steel-200 bg-white text-steel-700',
                  )}
                >
                  {item.icon}
                  {item.label}
                  {count > 0 ? (
                    <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{count}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Admin">
      {visible.map((section) => (
        <div key={section.title} className="mb-3 last:mb-0">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-steel-400">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item);
              const count = item.badge ? badges[item.badge] : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-brand-50 font-semibold text-brand-700'
                        : 'text-steel-700 hover:bg-steel-50 hover:text-steel-950',
                    )}
                  >
                    <span className={cn('text-base', active ? 'text-brand-600' : 'text-steel-400')}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                        {count > 99 ? '99+' : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
