import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Audit log',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/** Groups actions so they can be filtered and colour-coded meaningfully. */
const ACTION_GROUPS: Record<string, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  auth: { label: 'Authentication', tone: 'neutral' },
  user: { label: 'Users', tone: 'warning' },
  truck: { label: 'Stock', tone: 'info' },
  order: { label: 'Orders', tone: 'success' },
  payment: { label: 'Payments', tone: 'success' },
  lead: { label: 'Enquiries', tone: 'info' },
  currency: { label: 'Currencies', tone: 'warning' },
  discount: { label: 'Discounts', tone: 'warning' },
  settings: { label: 'Settings', tone: 'danger' },
  page: { label: 'Content', tone: 'neutral' },
  email: { label: 'Email', tone: 'neutral' },
  export: { label: 'Exports', tone: 'danger' },
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole('ADMIN', '/admin/audit');
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const page = Math.max(1, Number(single('page') ?? '1') || 1);
  const group = single('group');
  const actorId = single('actor');

  const where: Prisma.AuditLogWhereInput = {
    ...(group ? { action: { startsWith: `${group}.` } } : {}),
    ...(actorId ? { actorId } : {}),
  };

  const [total, entries, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        entity: true,
        entityId: true,
        summary: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
      take: 50,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader
        title="Audit log"
        description="An append-only record of every privileged action. Entries cannot be edited or deleted from the interface."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            !group ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-steel-200 bg-white text-steel-600'
          }`}
        >
          All
        </Link>
        {Object.entries(ACTION_GROUPS).map(([key, entry]) => (
          <Link
            key={key}
            href={group === key ? '/admin/audit' : `/admin/audit?group=${key}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              group === key
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {actors.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-steel-500">Filter by user:</span>
          {actors.map((actor) => (
            <Link
              key={actor.id}
              href={actorId === actor.id ? '/admin/audit' : `/admin/audit?actor=${actor.id}`}
              className={`rounded px-2 py-1 ${
                actorId === actor.id ? 'bg-brand-600 text-white' : 'bg-white text-steel-600 hover:bg-steel-100'
              }`}
            >
              {actor.firstName} {actor.lastName}
            </Link>
          ))}
        </div>
      ) : null}

      <AdminCard padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>Detail</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <EmptyRow colSpan={5} message="No audit entries match those filters." />
            ) : (
              entries.map((entry) => {
                const prefix = entry.action.split('.')[0];
                const meta = ACTION_GROUPS[prefix];
                const changes =
                  entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
                    ? Object.keys(entry.metadata as Record<string, unknown>)
                    : [];

                return (
                  <tr key={entry.id} className="hover:bg-steel-50">
                    <Td className="whitespace-nowrap text-xs text-steel-500">
                      {formatDateTime(entry.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {entry.actor ? (
                        <>
                          <span className="font-medium text-steel-800">
                            {entry.actor.firstName} {entry.actor.lastName}
                          </span>
                          <span className="block text-steel-400">{entry.actorEmail}</span>
                        </>
                      ) : (
                        <span className="text-steel-400">{entry.actorEmail ?? 'System'}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={meta?.tone ?? 'neutral'}>{entry.action}</Badge>
                    </Td>
                    <Td className="max-w-96">
                      <span className="block truncate text-xs text-steel-700">{entry.summary ?? '—'}</span>
                      {changes.length > 0 ? (
                        <span className="block truncate text-[11px] text-steel-400">
                          Changed: {changes.slice(0, 6).join(', ')}
                          {changes.length > 6 ? ` +${changes.length - 6} more` : ''}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[11px] text-steel-400">
                      {entry.ipAddress ?? '—'}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </AdminCard>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        searchParams={params}
        basePath="/admin/audit"
      />
    </div>
  );
}
