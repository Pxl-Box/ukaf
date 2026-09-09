import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { LEGAL_DOCUMENTS, type LegalDocument } from '@/content/legal';
import { COOKIE_REGISTRY } from '@/lib/consent';
import { formatDate, truncate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/ui/primitives';
import { LegalContent } from '@/components/LegalContent';
import { CookiePreferencesLink } from '@/components/CookieBanner';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((slug) => ({ slug }));
}

/**
 * Resolves a legal page: a published override from the database if one exists,
 * otherwise the default shipped in src/content/legal.ts.
 */
async function resolveDocument(slug: string): Promise<(LegalDocument & { updatedAt?: Date }) | null> {
  const fallback = LEGAL_DOCUMENTS[slug];

  try {
    const override = await prisma.page.findFirst({
      where: { slug, isPublished: true },
    });

    if (override) {
      return {
        slug: override.slug,
        title: override.title,
        excerpt: override.excerpt ?? fallback?.excerpt ?? '',
        version: override.version,
        body: override.body,
        updatedAt: override.updatedAt,
      };
    }
  } catch {
    // Database unavailable — fall back to the bundled default.
  }

  return fallback ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const document = await resolveDocument(slug);

  if (!document) return { title: 'Not found' };

  return {
    title: document.title,
    description: truncate(document.excerpt, 160),
    alternates: { canonical: `/legal/${slug}` },
  };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const document = await resolveDocument(slug);

  if (!document) notFound();

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Legal' }, { label: document.title }]}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="min-w-0 max-w-3xl">
          <header className="mb-8 border-b border-steel-200 pb-6">
            <h1 className="text-2xl font-bold sm:text-3xl">{document.title}</h1>
            {document.excerpt ? (
              <p className="mt-2 text-[15px] leading-relaxed text-steel-600">{document.excerpt}</p>
            ) : null}
            <p className="mt-3 text-xs text-steel-400">
              Version {document.version}
              {document.updatedAt ? ` · Last updated ${formatDate(document.updatedAt)}` : ''}
            </p>
          </header>

          <LegalContent body={document.body} />

          {slug === 'cookies' ? <CookieTable /> : null}
        </article>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <nav aria-label="Legal documents" className="rounded-xl border border-steel-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-steel-500">
              Policies
            </h2>
            <ul className="space-y-1 text-sm">
              {Object.values(LEGAL_DOCUMENTS).map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/legal/${entry.slug}`}
                    aria-current={entry.slug === slug ? 'page' : undefined}
                    className={
                      entry.slug === slug
                        ? 'block rounded-lg bg-brand-50 px-3 py-2 font-semibold text-brand-700'
                        : 'block rounded-lg px-3 py-2 text-steel-600 hover:bg-steel-50 hover:text-steel-900'
                    }
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-steel-100 pt-4">
              <CookiePreferencesLink className="w-full rounded-lg px-3 py-2 text-left text-sm text-steel-600 hover:bg-steel-50 hover:text-steel-900" />
              <Link
                href="/contact"
                className="block rounded-lg px-3 py-2 text-sm text-steel-600 hover:bg-steel-50 hover:text-steel-900"
              >
                Ask us a question
              </Link>
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}

/**
 * The cookie table is generated from the same registry the application uses,
 * so the disclosure cannot drift away from what the code actually sets.
 */
function CookieTable() {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold text-steel-950">Cookies in detail</h2>

      {COOKIE_REGISTRY.map((group) => (
        <div key={group.category} className="mb-8">
          <h3 className="text-base font-semibold text-steel-900">{group.title}</h3>
          <p className="mb-3 mt-1 text-sm leading-relaxed text-steel-600">{group.description}</p>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">{group.title} cookies</caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-steel-200 bg-steel-50 px-3 py-2 text-left font-semibold">
                    Name
                  </th>
                  <th scope="col" className="border border-steel-200 bg-steel-50 px-3 py-2 text-left font-semibold">
                    Purpose
                  </th>
                  <th scope="col" className="border border-steel-200 bg-steel-50 px-3 py-2 text-left font-semibold">
                    Duration
                  </th>
                  <th scope="col" className="border border-steel-200 bg-steel-50 px-3 py-2 text-left font-semibold">
                    Set by
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.cookies.map((cookie) => (
                  <tr key={cookie.name}>
                    <td className="border border-steel-200 px-3 py-2 align-top font-mono text-xs">
                      {cookie.name}
                    </td>
                    <td className="border border-steel-200 px-3 py-2 align-top">{cookie.purpose}</td>
                    <td className="whitespace-nowrap border border-steel-200 px-3 py-2 align-top">
                      {cookie.duration}
                    </td>
                    <td className="whitespace-nowrap border border-steel-200 px-3 py-2 align-top">
                      {cookie.provider}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
        <h3 className="text-sm font-semibold text-brand-900">Change your mind at any time</h3>
        <p className="mt-1 text-sm text-brand-800">
          Your choices are stored for six months, after which we will ask again.
        </p>
        <CookiePreferencesLink className="btn-primary btn-sm mt-3">
          Open cookie preferences
        </CookiePreferencesLink>
      </div>
    </section>
  );
}
