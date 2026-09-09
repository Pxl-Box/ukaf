import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireRole, ROLE_LABELS } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';
import { AdminCard, AdminHeader, EmptyRow, TableWrap, Td, Th } from '@/components/admin/shell';
import { UserManager } from './UserManager';

export const metadata: Metadata = {
  title: 'Users & roles',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ROLE_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  CUSTOMER: 'neutral',
  SALES: 'info',
  MANAGER: 'info',
  ADMIN: 'warning',
  SUPERADMIN: 'danger',
};

export default async function AdminUsersPage() {
  const actor = await requireRole('ADMIN', '/admin/users');

  const staff = await prisma.user.findMany({
    where: { role: { in: ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'] } },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      phone: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
      emailVerifiedAt: true,
      _count: { select: { assignedLeads: true } },
    },
  });

  return (
    <div>
      <AdminHeader
        title="Users & roles"
        description="Staff accounts and what each of them can do. Customers are managed separately."
      />

      <div className="mb-4 rounded-xl border border-steel-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-steel-900">What each role can do</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              role: 'Sales executive',
              body: 'Manage enquiries and their own pipeline, add and edit stock, update orders.',
            },
            {
              role: 'Sales manager',
              body: 'Everything sales can do, plus delete stock and enquiries, issue refunds, manage currencies and discounts.',
            },
            {
              role: 'Administrator',
              body: 'Everything above, plus staff accounts, legal pages, site settings and the audit log.',
            },
            {
              role: 'Owner',
              body: 'Full access, including permanently erasing customer data.',
            },
          ].map((entry) => (
            <div key={entry.role} className="rounded-lg bg-steel-50 p-3">
              <dt className="text-xs font-semibold text-steel-900">{entry.role}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-steel-600">{entry.body}</dd>
            </div>
          ))}
        </dl>
      </div>

      <UserManager currentRole={actor.role} />

      <AdminCard title="Staff accounts" className="mt-4" padded={false}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th align="center">Open leads</Th>
              <Th>Last sign-in</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <EmptyRow colSpan={7} message="No staff accounts yet." />
            ) : (
              staff.map((member) => {
                const locked = member.lockedUntil && member.lockedUntil > new Date();

                return (
                  <tr key={member.id} className="hover:bg-steel-50">
                    <Td>
                      <span className="font-medium text-steel-900">
                        {member.firstName} {member.lastName}
                      </span>
                      {member.id === actor.id ? (
                        <span className="ml-1.5 text-xs text-steel-400">(you)</span>
                      ) : null}
                      <span className="block text-xs text-steel-400">
                        Added {formatDateTime(member.createdAt)}
                      </span>
                    </Td>
                    <Td className="text-xs">
                      {member.email}
                      {!member.emailVerifiedAt ? (
                        <span className="block text-amber-600">Email not verified</span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONE[member.role] ?? 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
                    </Td>
                    <Td align="center" className="tabular-nums">
                      {member._count.assignedLeads}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-500">
                      {member.lastLoginAt ? relativeTime(member.lastLoginAt) : 'Never'}
                    </Td>
                    <Td>
                      {locked ? (
                        <Badge tone="danger">Locked</Badge>
                      ) : member.status === 'ACTIVE' ? (
                        <Badge tone="success">Active</Badge>
                      ) : member.status === 'PENDING' ? (
                        <Badge tone="warning">Invited</Badge>
                      ) : (
                        <Badge tone="neutral">{member.status.toLowerCase()}</Badge>
                      )}
                    </Td>
                    <Td align="right">
                      <UserManager.RowActions
                        user={{
                          id: member.id,
                          email: member.email,
                          firstName: member.firstName,
                          lastName: member.lastName,
                          role: member.role,
                          status: member.status,
                        }}
                        currentUserId={actor.id}
                        currentRole={actor.role}
                      />
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </AdminCard>
    </div>
  );
}
