'use client';

import { useMemo, useState } from 'react';
import { ADMIN_DOCS, DOC_SECTIONS, searchDocs, type DocArticle, type DocBlock } from '@/lib/admin-docs';
import { Alert } from '@/components/ui/primitives';
import { SearchIcon } from '@/components/ui/Icons';

export function DocsBrowser() {
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState<string>(ADMIN_DOCS[0].slug);

  const results = useMemo(() => searchDocs(query), [query]);
  const active = ADMIN_DOCS.find((article) => article.slug === activeSlug) ?? ADMIN_DOCS[0];

  const sections = query.trim()
    ? [{ title: 'Search results', articles: results }]
    : DOC_SECTIONS.map((section) => ({
        title: section,
        articles: ADMIN_DOCS.filter((article) => article.section === section),
      }));

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides…"
            className="input pl-9"
          />
        </div>

        <nav className="max-h-[70vh] overflow-y-auto rounded-xl border border-steel-200 bg-white p-2 scrollbar-thin dark:border-steel-800 dark:bg-steel-900">
          {sections.length === 0 || sections.every((s) => s.articles.length === 0) ? (
            <p className="px-2 py-3 text-xs text-steel-400">No guides match &quot;{query}&quot;.</p>
          ) : (
            sections.map((section) =>
              section.articles.length === 0 ? null : (
                <div key={section.title} className="mb-2 last:mb-0">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-steel-400">
                    {section.title}
                  </p>
                  <ul className="space-y-0.5">
                    {section.articles.map((article) => (
                      <li key={article.slug}>
                        <button
                          type="button"
                          onClick={() => setActiveSlug(article.slug)}
                          className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                            active.slug === article.slug
                              ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                              : 'text-steel-700 hover:bg-steel-50 hover:text-steel-950 dark:text-steel-300 dark:hover:bg-steel-800 dark:hover:text-white'
                          }`}
                        >
                          {article.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}
        </nav>
      </div>

      <DocsArticle article={active} />
    </div>
  );
}

function DocsArticle({ article }: { article: DocArticle }) {
  return (
    <article className="rounded-xl border border-steel-200 bg-white p-5 shadow-card dark:border-steel-800 dark:bg-steel-900 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">{article.section}</p>
      <h2 className="mt-1 text-xl font-bold text-steel-950 dark:text-white">{article.title}</h2>
      <p className="mt-1.5 text-sm text-steel-500 dark:text-steel-400">{article.summary}</p>

      <div className="mt-5 space-y-4">
        {article.blocks.map((block, index) => (
          <DocsBlock key={index} block={block} />
        ))}
      </div>
    </article>
  );
}

function DocsBlock({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'h3':
      return <h3 className="pt-1 text-base font-semibold text-steel-900 dark:text-steel-100">{block.text}</h3>;
    case 'p':
      return <p className="text-[15px] leading-relaxed text-steel-700 dark:text-steel-300">{block.text}</p>;
    case 'ul':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-steel-700 dark:text-steel-300">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-steel-700 dark:text-steel-300">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    case 'note':
      return <Alert tone={block.tone === 'danger' ? 'danger' : block.tone === 'warning' ? 'warning' : 'info'}>{block.text}</Alert>;
    default:
      return null;
  }
}
