import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { CogIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Site under maintenance',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const settings = await getSettings();

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <CogIcon className="mx-auto text-5xl text-steel-300" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Error 503</p>
        <h1 className="mt-2 text-2xl font-bold">We will be back shortly</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
          {settings.siteName} is undergoing scheduled maintenance. Please check back in a few minutes — nothing has
          been lost, and your account and any saved vehicles will be exactly as you left them.
        </p>

        {settings.contactPhone || settings.contactEmail ? (
          <p className="mt-6 text-sm text-steel-500">
            Need something urgently?{' '}
            {settings.contactPhone ? (
              <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="font-medium text-brand-600 hover:underline">
                {settings.contactPhone}
              </a>
            ) : null}
            {settings.contactPhone && settings.contactEmail ? ' · ' : ''}
            {settings.contactEmail ? (
              <a href={`mailto:${settings.contactEmail}`} className="font-medium text-brand-600 hover:underline">
                {settings.contactEmail}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
