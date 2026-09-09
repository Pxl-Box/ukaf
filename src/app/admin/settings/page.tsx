import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getBaseCurrency } from '@/lib/currency';
import { getDemoDataStatus } from '@/lib/demo-data';
import { prisma } from '@/lib/db';
import { env, isProduction } from '@/lib/env';
import { isStripeEnabled } from '@/lib/stripe';
import { AdminCard, AdminHeader } from '@/components/admin/shell';
import { Badge, DataRow } from '@/components/ui/primitives';
import { SettingsForm } from './SettingsForm';
import { DemoDataToggle } from './DemoDataToggle';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireRole('ADMIN', '/admin/settings');

  const [settings, base, demoStatus] = await Promise.all([
    getSettings(),
    getBaseCurrency(),
    getDemoDataStatus(prisma),
  ]);

  const integrations = [
    {
      name: 'Stripe payments',
      ready: isStripeEnabled(),
      detail: isStripeEnabled()
        ? 'Checkout and refunds are live.'
        : 'Set STRIPE_SECRET_KEY to accept card payments.',
    },
    {
      name: 'Stripe webhook',
      ready: Boolean(env.stripe.webhookSecret),
      detail: env.stripe.webhookSecret
        ? 'Payment confirmations will be processed automatically.'
        : 'Set STRIPE_WEBHOOK_SECRET or orders will never be marked paid.',
    },
    {
      name: 'Resend email',
      ready: env.resend.enabled,
      detail: env.resend.enabled
        ? `Sending as ${env.resend.from}`
        : 'Set RESEND_API_KEY to send confirmations and password resets.',
    },
    {
      name: 'Sales notifications',
      ready: env.resend.salesInbox.length > 0,
      detail:
        env.resend.salesInbox.length > 0
          ? `New enquiries go to ${env.resend.salesInbox.join(', ')}`
          : 'Set SALES_NOTIFICATION_EMAILS so the team hears about new enquiries.',
    },
    {
      name: 'Exchange rate provider',
      ready: Boolean(env.fx.apiUrl),
      detail: env.fx.apiUrl ? 'Rates can be refreshed automatically.' : 'Rates are maintained manually.',
    },
    {
      name: 'Scheduled jobs',
      ready: Boolean(env.cronSecret),
      detail: env.cronSecret
        ? 'The /api/cron endpoints are protected.'
        : 'Set CRON_SECRET before scheduling housekeeping jobs.',
    },
  ];

  return (
    <div>
      <AdminHeader
        title="Settings"
        description="Company details, commerce defaults and integration status."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <AdminCard
            title="Example data"
            description="The 24 demo vehicles and sample enquiries created for trying the site out."
          >
            <DemoDataToggle
              initialStatus={{
                truckCount: demoStatus.truckCount,
                leadCount: demoStatus.leadCount,
                testimonialCount: demoStatus.testimonialCount,
              }}
            />
          </AdminCard>

          <SettingsForm settings={settings} currencySymbol={base.symbol} />
        </div>

        <div className="space-y-4">
          <AdminCard title="Integrations" description="Read from environment variables at boot.">
            <ul className="space-y-3">
              {integrations.map((integration) => (
                <li key={integration.name} className="border-b border-steel-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-steel-900">{integration.name}</span>
                    <Badge tone={integration.ready ? 'success' : 'warning'}>
                      {integration.ready ? 'Ready' : 'Not set'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-steel-500">{integration.detail}</p>
                </li>
              ))}
            </ul>
          </AdminCard>

          <AdminCard title="Environment">
            <dl>
              <DataRow
                label="Mode"
                value={
                  <Badge tone={isProduction ? 'success' : 'warning'}>
                    {isProduction ? 'Production' : 'Development'}
                  </Badge>
                }
                className="border-b border-steel-100"
              />
              <DataRow label="Site URL" value={<span className="text-xs">{env.siteUrl}</span>} className="border-b border-steel-100" />
              <DataRow label="Base currency" value={base.code} className="border-b border-steel-100" />
              <DataRow label="Company" value={<span className="text-xs">{env.company.name}</span>} className="border-b border-steel-100" />
              <DataRow
                label="Company no."
                value={<span className="text-xs">{env.company.number || '—'}</span>}
                className="border-b border-steel-100"
              />
              <DataRow label="VAT no." value={<span className="text-xs">{env.company.vat || '—'}</span>} />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-steel-400">
              Company identity comes from environment variables so it stays consistent across invoices, emails and
              legal pages. Change it in your hosting provider&rsquo;s configuration.
            </p>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
