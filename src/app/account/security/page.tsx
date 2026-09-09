import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSession, requireUser } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { Badge, DataRow } from '@/components/ui/primitives';
import { ChangePasswordForm, SignOutEverywhereButton } from './SecurityForms';

export const metadata: Metadata = {
  title: 'Security',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Turns a raw user-agent into something a person can recognise. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser =
    /edg/i.test(userAgent) ? 'Edge'
    : /chrome|crios/i.test(userAgent) ? 'Chrome'
    : /firefox|fxios/i.test(userAgent) ? 'Firefox'
    : /safari/i.test(userAgent) ? 'Safari'
    : 'Browser';

  const platform =
    /windows/i.test(userAgent) ? 'Windows'
    : /android/i.test(userAgent) ? 'Android'
    : /iphone|ipad|ipod/i.test(userAgent) ? 'iOS'
    : /mac os/i.test(userAgent) ? 'macOS'
    : /linux/i.test(userAgent) ? 'Linux'
    : 'Unknown OS';

  return `${browser} on ${platform}`;
}

export default async function SecurityPage() {
  const user = await requireUser('/account/security');
  const session = await getSession();

  const [record, sessions, recentActivity] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordUpdatedAt: true, lastLoginAt: true, emailVerifiedAt: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true, createdAt: true },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: {
        actorId: user.id,
        action: { in: ['auth.login', 'auth.password_changed', 'auth.password_reset_completed', 'auth.sessions_revoked'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, summary: true, ipAddress: true, createdAt: true },
    }),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-steel-500">
          Manage your password and see where your account is signed in.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChangePasswordForm />

        <section className="panel">
          <h2 className="text-base font-semibold">Account status</h2>
          <dl className="mt-3">
            <DataRow
              label="Email verified"
              value={
                record.emailVerifiedAt ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Not verified</Badge>
                )
              }
              className="border-b border-steel-100"
            />
            <DataRow
              label="Password last changed"
              value={relativeTime(record.passwordUpdatedAt)}
              className="border-b border-steel-100"
            />
            <DataRow
              label="Last sign-in"
              value={record.lastLoginAt ? formatDateTime(record.lastLoginAt) : '—'}
              className="border-b border-steel-100"
            />
            <DataRow label="Member since" value={formatDateTime(record.createdAt)} />
          </dl>
        </section>
      </div>

      <section className="panel mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Where you are signed in</h2>
            <p className="mt-0.5 text-sm text-steel-500">
              {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}. Do not recognise one? Sign out
              of everything and change your password.
            </p>
          </div>
          {sessions.length > 1 ? <SignOutEverywhereButton /> : null}
        </div>

        <ul className="divide-y divide-steel-100">
          {sessions.map((entry) => {
            const isCurrent = entry.id === session?.sessionId;
            return (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-steel-900">
                    {describeDevice(entry.userAgent)}
                    {isCurrent ? (
                      <Badge tone="success" className="ml-2">
                        This device
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-steel-500">
                    {entry.ipAddress ?? 'Unknown IP'} · Last active {relativeTime(entry.lastSeenAt)}
                  </p>
                </div>
                <p className="text-xs text-steel-400">Started {formatDateTime(entry.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {recentActivity.length > 0 ? (
        <section className="panel mt-4">
          <h2 className="mb-3 text-base font-semibold">Recent security activity</h2>
          <ul className="divide-y divide-steel-100 text-sm">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-3 py-2.5">
                <span className="text-steel-700">{entry.summary ?? entry.action}</span>
                <span className="text-xs text-steel-400">
                  {formatDateTime(entry.createdAt)}
                  {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
