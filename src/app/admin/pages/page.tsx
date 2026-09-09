import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { POLICY_VERSION } from '@/lib/settings';
import { formatDateTime } from '@/lib/utils';
import { AdminHeader } from '@/components/admin/shell';
import { Alert } from '@/components/ui/primitives';
import { PageEditor } from './PageEditor';

export const metadata: Metadata = {
  title: 'Legal pages',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Pages the storefront expects to exist, with sensible defaults if absent. */
const CORE_PAGES = [
  { slug: 'terms', title: 'Terms & conditions of sale', path: '/legal/terms' },
  { slug: 'privacy', title: 'Privacy policy', path: '/legal/privacy' },
  { slug: 'cookies', title: 'Cookie policy', path: '/legal/cookies' },
  { slug: 'returns', title: 'Cancellation & refunds', path: '/legal/returns' },
];

export default async function AdminPagesPage() {
  await requireRole('ADMIN', '/admin/pages');

  const pages = await prisma.page.findMany({ orderBy: { slug: 'asc' } });
  const bySlug = new Map(pages.map((page) => [page.slug, page]));

  return (
    <div>
      <AdminHeader
        title="Legal & information pages"
        description="Override the built-in policy text. Anything left empty falls back to the default wording shipped with the site."
      />

      <Alert tone="warning" title="Get these reviewed" className="mb-4">
        The default policies are a solid, honest starting point written for a UK commercial vehicle dealer, but they
        are not legal advice. Have a solicitor review them before you trade, and update them whenever your process
        changes. The current cookie/privacy policy version is <strong>{POLICY_VERSION}</strong> — bumping{' '}
        <code className="font-mono text-xs">POLICY_VERSION</code> re-prompts every visitor for cookie consent.
      </Alert>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CORE_PAGES.map((core) => {
          const record = bySlug.get(core.slug);
          return (
            <div key={core.slug} className="rounded-xl border border-steel-200 bg-white p-4">
              <p className="text-sm font-semibold text-steel-900">{core.title}</p>
              <p className="mt-1 text-xs text-steel-500">
                {record
                  ? `Custom · v${record.version} · updated ${formatDateTime(record.updatedAt)}`
                  : 'Using the built-in default'}
              </p>
              <Link href={core.path} target="_blank" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">
                View on site →
              </Link>
            </div>
          );
        })}
      </div>

      <PageEditor
        pages={pages.map((page) => ({
          slug: page.slug,
          title: page.title,
          excerpt: page.excerpt ?? '',
          body: page.body,
          version: page.version,
          isPublished: page.isPublished,
          metaTitle: page.metaTitle ?? '',
          metaDescription: page.metaDescription ?? '',
          updatedAt: page.updatedAt.toISOString(),
        }))}
        corePages={CORE_PAGES}
      />
    </div>
  );
}
