import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getCrmSummary, getPipeline } from '@/lib/leads';
import { getBaseCurrency } from '@/lib/currency';
import { formatMoney } from '@/lib/money';
import { Stat } from '@/components/ui/primitives';
import { AdminHeader } from '@/components/admin/shell';
import { PipelineBoard, type PipelineColumn } from './PipelineBoard';

export const metadata: Metadata = {
  title: 'Pipeline',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  await requireStaff();

  const [columns, summary, base] = await Promise.all([getPipeline(), getCrmSummary(30), getBaseCurrency()]);

  const totalValue = columns.reduce((sum, column) => sum + column.value, 0);

  const boardColumns: PipelineColumn[] = columns.map((column) => ({
    stage: column.stage,
    label: column.label,
    items: column.items.map((lead) => ({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      score: lead.score,
      estimatedValue: lead.estimatedValue,
      truck: lead.truck ? { title: lead.truck.title, priceNet: lead.truck.priceNet } : null,
      assignedTo: lead.assignedTo,
      nextActionAtISO: lead.nextActionAt ? lead.nextActionAt.toISOString() : null,
    })),
  }));

  return (
    <div>
      <AdminHeader
        title="Sales pipeline"
        description="Open enquiries by stage. Weighted by the value of the vehicle each buyer is looking at. Drag a card to change its stage (desktop only)."
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

      <PipelineBoard columns={boardColumns} base={base} />

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
