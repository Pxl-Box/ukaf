import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '@/lib/leads';
import { formatDate, relativeTime } from '@/lib/utils';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { MailIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'My enquiries',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountEnquiriesPage() {
  const user = await requireUser('/account/enquiries');

  const leads = await prisma.lead.findMany({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ref: true,
      subject: true,
      message: true,
      status: true,
      source: true,
      createdAt: true,
      truck: { select: { slug: true, title: true, stockNumber: true } },
      activities: {
        // Only staff-authored replies, never internal notes.
        where: { type: 'EMAIL' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">My enquiries</h1>
        <p className="mt-1 text-sm text-steel-500">
          Everything you have asked us about, and where each conversation has got to.
        </p>
      </header>

      {leads.length === 0 ? (
        <EmptyState
          icon={<MailIcon />}
          title="No enquiries yet"
          description="Ask a question about any vehicle and we will track it here with a reference number."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/trucks" className="btn-primary">
                Browse stock
              </Link>
              <Link href="/contact" className="btn-secondary">
                Contact us
              </Link>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const closed = lead.status === 'WON' || lead.status === 'LOST';

            return (
              <li key={lead.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-steel-900">
                      {lead.truck ? (
                        <Link href={`/trucks/${lead.truck.slug}`} className="hover:text-brand-700">
                          {lead.truck.title}
                        </Link>
                      ) : (
                        lead.subject ?? 'General enquiry'
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-steel-500">
                      {lead.ref} · {LEAD_SOURCE_LABELS[lead.source]} · {formatDate(lead.createdAt)}
                    </p>
                  </div>
                  <Badge tone={lead.status === 'WON' ? 'success' : closed ? 'neutral' : 'info'}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                </div>

                {lead.message ? (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-lg bg-steel-50 p-3 text-sm text-steel-600">
                    {lead.message}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-steel-400">
                  {lead.activities[0]
                    ? `We last replied ${relativeTime(lead.activities[0].createdAt)}.`
                    : closed
                      ? 'This enquiry is closed.'
                      : 'Awaiting a reply from our team — usually within one working day.'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
