import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getCrmSummary, getPipeline } from '@/lib/leads';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { relativeTime } from '@/lib/utils';
import { Stat } from '@/components/ui/primitives';
import { AdminHeader } from '@/components/admin/shell';

export const metadata: Metadata = {
  title: 'Pipeline',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  await requireStaff();

  const [columns, summary, base] = await Promise.all([getPipeline(), getCrmSummary(30), getBaseCurrency()]);

  const totalValue = columns.reduce((sum, column) => sum + column.value, 0);

  return (
    <div>
      <AdminHeader
        title="Sales pipeline"
        description="Open enquiries by stage. Weighted by the value of the vehicle each buyer is looking at."
        action={
          <Link href="/admin/leads" className="btn-secondary btn-sm">
            List view
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Open pipeline" value={formatMoney(totalValue, base, { compact: true })} tone="info" />
        <Stat label="Open enquiries" value={summary.open} />
        <Stat
          label="Won (30 days)"
          value={summary.won}
          hint={`${summary.conversionRate}% conversion`}
          tone="success"
        />
        <Stat
          label="Needs follow-up"
          value={summary.overdue}
          tone={summary.overdue > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="overflow-x-auto pb-4 scrollbar-thin">
        <div className="grid min-w-[64rem] grid-cols-5 gap-3">
          {columns.map((column) => (
            <section
              key={column.stage}
              aria-label={column.label}
              className="flex flex-col rounded-xl border border-steel-200 bg-steel-50"
            >
              <header className="border-b border-steel-200 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-steel-900">{column.label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-steel-600">
                    {column.count}
                  </span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-steel-500">
                  {formatMoney(column.value, base, { compact: true })}
                </p>
              </header>

              <ol className="flex-1 space-y-2 p-2">
                {column.items.length === 0 ? (
                  <li className="py-8 text-center text-xs text-steel-400">Nothing here</li>
                ) : (
                  column.items.slice(0, 25).map((lead) => {
                    const overdue = lead.nextActionAt && lead.nextActionAt < new Date();

                    return (
                      <li key={lead.id}>
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="block rounded-lg border border-steel-200 bg-white p-3 transition-colors hover:border-brand-300 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-steel-900">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <span
                              className={
                                lead.score >= 70
                                  ? 'shrink-0 text-xs font-bold text-emerald-600'
                                  : lead.score >= 40
                                    ? 'shrink-0 text-xs font-medium text-amber-600'
                                    : 'shrink-0 text-xs text-steel-400'
                              }
                            >
                              {lead.score}
                            </span>
                          </div>

                          {lead.company ? (
                            <p className="mt-0.5 truncate text-xs text-steel-500">{lead.company}</p>
                          ) : null}

                          {lead.truck ? (
                            <p className="mt-1.5 truncate text-xs text-steel-600">{lead.truck.title}</p>
                          ) : (
                            <p className="mt-1.5 text-xs italic text-steel-400">General enquiry</p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-steel-100 pt-2">
                            <span className="text-xs font-semibold tabular-nums text-steel-700">
                              {lead.estimatedValue ?? lead.truck?.priceNet
                                ? formatMoney(lead.estimatedValue ?? lead.truck?.priceNet ?? 0, base, {
                                    compact: true,
                                  })
                                : '—'}
                            </span>
                            <span
                              className={
                                overdue ? 'text-xs font-medium text-red-600' : 'text-xs text-steel-400'
                              }
                            >
                              {lead.nextActionAt ? relativeTime(lead.nextActionAt) : ''}
                            </span>
                          </div>

                          <p className="mt-1.5 truncate text-[11px] text-steel-400">
                            {lead.assignedTo
                              ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName.charAt(0)}.`
                              : 'Unassigned'}
                          </p>
                        </Link>
                      </li>
                    );
                  })
                )}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-steel-400">
        Showing up to 25 enquiries per stage, highest score first. Won and lost enquiries are excluded — see the{' '}
        <Link href="/admin/leads" className="underline hover:text-brand-600">
          list view
        </Link>{' '}
        for everything.
      </p>
    </div>
  );
}
