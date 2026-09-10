import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '@/lib/leads';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { formatDateTime, formatMileage } from '@/lib/utils';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getActiveShippingZones } from '@/lib/shipping';
import { Badge, DataRow } from '@/components/ui/primitives';
import { AdminCard, AdminHeader } from '@/components/admin/shell';
import { LeadControls, LeadWorkspace } from './LeadWorkspace';
import { ShippingQuotePanel } from './ShippingQuotePanel';

export const metadata: Metadata = {
  title: 'Enquiry',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();

  const [lead, staff, base] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        truck: {
          select: {
            id: true,
            slug: true,
            title: true,
            stockNumber: true,
            priceNet: true,
            status: true,
            grossWeightKg: true,
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        partExchange: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ['SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    getBaseCurrency(),
  ]);

  if (!lead) notFound();

  const shippingZones = lead.truck ? await getActiveShippingZones() : [];

  // Other enquiries from the same person, so the rep sees the whole
  // relationship. Matched on WhatsApp number first (always present), and on
  // email too when one was given — either can identify a repeat enquirer.
  const relatedLeads = await prisma.lead.findMany({
    where: {
      id: { not: lead.id },
      OR: [{ phone: lead.phone }, ...(lead.email ? [{ email: lead.email }] : [])],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, ref: true, status: true, createdAt: true, truck: { select: { title: true } } },
  });

  return (
    <div>
      <AdminHeader
        title={`${lead.firstName} ${lead.lastName}`}
        description={`${lead.ref} · ${LEAD_SOURCE_LABELS[lead.source]} · received ${formatDateTime(lead.createdAt)}`}
        breadcrumb={{ label: 'Back to enquiries', href: '/admin/leads' }}
        action={
          <Badge
            tone={
              lead.status === 'NEW'
                ? 'info'
                : lead.status === 'WON'
                  ? 'success'
                  : lead.status === 'LOST'
                    ? 'danger'
                    : 'neutral'
            }
          >
            {LEAD_STATUS_LABELS[lead.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {lead.message ? (
            <AdminCard title="Their message">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-steel-700">{lead.message}</p>
            </AdminCard>
          ) : null}

          {lead.partExchange ? (
            <AdminCard title="Part exchange offered">
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <DataRow label="Make" value={lead.partExchange.make} className="border-b border-steel-100" />
                <DataRow label="Model" value={lead.partExchange.model} className="border-b border-steel-100" />
                <DataRow
                  label="Year"
                  value={lead.partExchange.year ?? '—'}
                  className="border-b border-steel-100"
                />
                <DataRow
                  label="Mileage"
                  value={formatMileage(lead.partExchange.mileageKm)}
                  className="border-b border-steel-100"
                />
                <DataRow
                  label="Registration"
                  value={lead.partExchange.registration ?? '—'}
                  className="border-b border-steel-100"
                />
                <DataRow
                  label="Condition"
                  value={lead.partExchange.condition ?? '—'}
                  className="border-b border-steel-100"
                />
                <DataRow
                  label="Our valuation"
                  value={
                    lead.partExchange.valuationNet
                      ? formatMoney(lead.partExchange.valuationNet, base)
                      : 'Not yet valued'
                  }
                />
              </dl>
            </AdminCard>
          ) : null}

          <LeadWorkspace
            leadId={lead.id}
            activities={lead.activities.map((activity) => ({
              id: activity.id,
              type: activity.type,
              subject: activity.subject,
              body: activity.body,
              dueAt: activity.dueAt?.toISOString() ?? null,
              completedAt: activity.completedAt?.toISOString() ?? null,
              createdAt: activity.createdAt.toISOString(),
              author: activity.createdBy
                ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}`
                : 'System',
            }))}
          />
        </div>

        <div className="space-y-4">
          <AdminCard title="Manage">
            <LeadControls
              leadId={lead.id}
              status={lead.status}
              assignedToId={lead.assignedToId ?? ''}
              estimatedValue={
                lead.estimatedValue !== null ? (lead.estimatedValue / 100).toFixed(2) : ''
              }
              nextActionAt={lead.nextActionAt ? lead.nextActionAt.toISOString().slice(0, 10) : ''}
              lostReason={lead.lostReason ?? ''}
              staff={staff.map((member) => ({
                value: member.id,
                label: `${member.firstName} ${member.lastName}`,
              }))}
              currencySymbol={base.symbol}
            />
          </AdminCard>

          <AdminCard title="Contact">
            <dl>
              <DataRow
                label="WhatsApp"
                value={
                  <span className="flex items-center gap-3">
                    <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="text-brand-600 hover:underline">
                      {lead.phone}
                    </a>
                    <a
                      href={buildWhatsAppLink(lead.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      Message →
                    </a>
                  </span>
                }
                className="border-b border-steel-100"
              />
              <DataRow
                label="Email"
                value={
                  lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-steel-400">Not provided</span>
                  )
                }
                className="border-b border-steel-100"
              />
              <DataRow label="Company" value={lead.company ?? '—'} className="border-b border-steel-100" />
              <DataRow
                label="Account"
                value={
                  lead.user ? (
                    <Link href={`/admin/customers/${lead.user.id}`} className="text-brand-600 hover:underline">
                      Registered customer
                    </Link>
                  ) : (
                    'Guest'
                  )
                }
                className="border-b border-steel-100"
              />
              <DataRow label="Score" value={`${lead.score}/100`} />
            </dl>

            {lead.utmSource || lead.utmCampaign ? (
              <p className="mt-3 border-t border-steel-100 pt-3 text-xs text-steel-500">
                Source: {lead.utmSource ?? '—'} / {lead.utmMedium ?? '—'} / {lead.utmCampaign ?? '—'}
              </p>
            ) : null}
          </AdminCard>

          {lead.truck ? (
            <AdminCard title="Vehicle of interest">
              <Link
                href={`/admin/trucks/${lead.truck.id}`}
                className="block text-sm font-medium text-brand-600 hover:underline"
              >
                {lead.truck.title}
              </Link>
              <p className="mt-1 text-xs text-steel-500">
                {lead.truck.stockNumber} · {formatMoney(lead.truck.priceNet, base)} ·{' '}
                {lead.truck.status.toLowerCase()}
              </p>
              <Link href={`/trucks/${lead.truck.slug}`} target="_blank" className="btn-secondary btn-sm mt-3 w-full">
                View listing
              </Link>
            </AdminCard>
          ) : null}

          {lead.truck ? (
            <ShippingQuotePanel
              vehiclePriceNet={lead.truck.priceNet}
              grossWeightKg={lead.truck.grossWeightKg}
              zones={shippingZones.map((zone) => ({
                id: zone.id,
                name: zone.name,
                rates: zone.rates.map((rate) => ({
                  minWeightKg: rate.minWeightKg,
                  maxWeightKg: rate.maxWeightKg,
                  priceNet: rate.priceNet,
                })),
              }))}
              currencySymbol={base.symbol}
            />
          ) : null}

          {relatedLeads.length > 0 ? (
            <AdminCard title="Other enquiries from this contact">
              <ul className="space-y-2 text-sm">
                {relatedLeads.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/leads/${entry.id}`} className="truncate text-brand-600 hover:underline">
                      {entry.ref} · {entry.truck?.title ?? 'General'}
                    </Link>
                    <span className="shrink-0 text-xs text-steel-400">
                      {LEAD_STATUS_LABELS[entry.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
