'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard } from '@/components/admin/shell';
import { formatDateTime } from '@/lib/utils';
import {
  CheckboxField,
  FormMessage,
  SubmitButton,
  TextAreaField,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { TrashIcon } from '@/components/ui/Icons';

type PageRecord = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  version: string;
  isPublished: boolean;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
};

export function PageEditor({
  pages,
  corePages,
}: {
  pages: PageRecord[];
  corePages: Array<{ slug: string; title: string; path: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PageRecord | { slug: string; title: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const existing = editing && 'body' in editing ? editing : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      await apiFetch('/api/admin/pages', { method: 'POST', json: data });
      setEditing(null);
      setMessage({ tone: 'success', text: 'Page saved and live.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not save the page.' });
      }
    } finally {
      setPending(false);
    }
  }

  async function revert(slug: string) {
    if (
      !window.confirm(
        `Delete the custom content for “${slug}”? The page will fall back to the built-in default wording.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch('/api/admin/pages', { method: 'DELETE', json: { slug } });
      setMessage({ tone: 'success', text: 'Reverted to the built-in default.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not revert the page.',
      });
    }
  }

  if (editing) {
    return (
      <AdminCard
        title={`Editing /${editing.slug}`}
        description="Plain text with blank lines between paragraphs. Headings start a line with ## and list items with -."
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="slug"
              label="Slug"
              required
              readOnly
              defaultValue={editing.slug}
              error={firstError(fieldErrors, 'slug')}
            />
            <TextField
              name="title"
              label="Title"
              required
              defaultValue={existing?.title ?? editing.title}
              className="sm:col-span-2"
              error={firstError(fieldErrors, 'title')}
            />
          </div>

          <TextField
            name="version"
            label="Version"
            defaultValue={existing?.version ?? '1.0'}
            hint="Bump this whenever the substance changes, so you can evidence which version a customer accepted."
            error={firstError(fieldErrors, 'version')}
          />

          <TextField
            name="excerpt"
            label="Summary"
            defaultValue={existing?.excerpt ?? ''}
            hint="One line shown under the page title."
            error={firstError(fieldErrors, 'excerpt')}
          />

          <TextAreaField
            name="body"
            label="Content"
            required
            rows={24}
            defaultValue={existing?.body ?? ''}
            className="font-mono"
            error={firstError(fieldErrors, 'body')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="metaTitle"
              label="Meta title"
              maxLength={70}
              defaultValue={existing?.metaTitle ?? ''}
              error={firstError(fieldErrors, 'metaTitle')}
            />
            <TextField
              name="metaDescription"
              label="Meta description"
              maxLength={180}
              defaultValue={existing?.metaDescription ?? ''}
              error={firstError(fieldErrors, 'metaDescription')}
            />
          </div>

          <CheckboxField
            name="isPublished"
            value="true"
            defaultChecked={existing?.isPublished ?? true}
            label="Published — visitors see this instead of the built-in default"
          />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
              Cancel
            </button>
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Save page
            </SubmitButton>
          </div>
        </form>
      </AdminCard>
    );
  }

  const customSlugs = new Set(pages.map((page) => page.slug));
  const availableCore = corePages.filter((core) => !customSlugs.has(core.slug));

  return (
    <div className="space-y-4">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      {availableCore.length > 0 ? (
        <AdminCard title="Override a built-in page">
          <div className="flex flex-wrap gap-2">
            {availableCore.map((core) => (
              <button
                key={core.slug}
                type="button"
                onClick={() => setEditing({ slug: core.slug, title: core.title })}
                className="btn-secondary btn-sm"
              >
                Customise {core.title}
              </button>
            ))}
          </div>
        </AdminCard>
      ) : null}

      {pages.length > 0 ? (
        <AdminCard title="Custom pages">
          <ul className="divide-y divide-steel-100">
            {pages.map((page) => (
              <li key={page.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-steel-900">{page.title}</p>
                  <p className="mt-0.5 text-xs text-steel-400">
                    /{page.slug} · v{page.version} · updated {formatDateTime(page.updatedAt)}
                    {!page.isPublished ? ' · draft' : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setEditing(page)} className="btn-ghost btn-sm">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => revert(page.slug)}
                    aria-label={`Revert ${page.title}`}
                    className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}
    </div>
  );
}
