'use client';

import Image from 'next/image';
import { useRef, useState, type ChangeEvent } from 'react';
import { apiFetch, ApiClientError, readCookie } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { CheckIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/primitives';
import { FormMessage } from '@/components/forms/fields';

type ImageRecord = { id: string; url: string; alt: string | null; isPrimary: boolean };

/**
 * Image manager for a vehicle: upload, reorder, set the primary shot, delete.
 * Rendered inside the truck form but posts to its own endpoints so a photo
 * change never depends on the rest of the form being valid.
 */
export function TruckImageManager({
  truckId,
  initialImages,
}: {
  truckId: string;
  initialImages: ImageRecord[];
}) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function attach(url: string) {
    const image = await apiFetch<{ image: ImageRecord }>('/api/admin/trucks/images', {
      method: 'POST',
      json: { truckId, url },
    });
    setImages((current) => {
      const next = image.image.isPrimary
        ? current.map((entry) => ({ ...entry, isPrimary: false }))
        : [...current];
      return [...next, image.image];
    });
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);

        // FormData bodies bypass apiFetch's JSON path, so set CSRF manually.
        const token = readCookie('ukaf_csrf');
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
          headers: token ? { 'x-csrf-token': token } : undefined,
        });

        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? 'Upload failed.');
        }

        await attach(payload.data.url);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload that image.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function addByUrl() {
    const url = urlInput.trim();
    if (!url) return;

    setBusy(true);
    setError(null);
    try {
      await attach(url);
      setUrlInput('');
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not add that image URL.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(id: string) {
    setImages((current) => current.map((entry) => ({ ...entry, isPrimary: entry.id === id })));
    await apiFetch('/api/admin/trucks/images', {
      method: 'PATCH',
      json: { truckId, primaryId: id },
    }).catch(() => setError('Could not update the main photo.'));
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this photograph?')) return;

    const previous = images;
    setImages((current) => current.filter((entry) => entry.id !== id));

    try {
      await apiFetch('/api/admin/trucks/images', { method: 'DELETE', json: { id } });
    } catch {
      setImages(previous);
      setError('Could not remove that image.');
    }
  }

  async function move(id: string, direction: -1 | 1) {
    const index = images.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);

    await apiFetch('/api/admin/trucks/images', {
      method: 'PATCH',
      json: { truckId, order: next.map((entry) => entry.id) },
    }).catch(() => setError('Could not save the new order.'));
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-secondary btn-sm cursor-pointer">
          <PlusIcon />
          Upload images
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={onFiles}
            className="sr-only"
          />
        </label>

        <div className="flex min-w-64 flex-1 gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addByUrl();
              }
            }}
            placeholder="…or paste an image URL"
            aria-label="Image URL"
            className="input py-2 text-sm"
          />
          <button type="button" onClick={addByUrl} disabled={busy || !urlInput.trim()} className="btn-secondary btn-sm">
            Add
          </button>
        </div>

        {busy ? <Spinner className="text-steel-400" /> : null}
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-steel-300 p-8 text-center text-sm text-steel-400">
          No photographs yet. Vehicles with 8 or more photographs get noticeably more enquiries.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                'group relative overflow-hidden rounded-lg border-2 bg-steel-100',
                image.isPrimary ? 'border-brand-500' : 'border-transparent',
              )}
            >
              <span className="relative block aspect-[4/3]">
                <Image src={image.url} alt={image.alt ?? ''} fill sizes="200px" className="object-cover" />
              </span>

              {image.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  MAIN
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-steel-950/75 p-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(image.id, -1)}
                    disabled={index === 0}
                    aria-label="Move earlier"
                    className="grid h-6 w-6 place-items-center rounded text-white hover:bg-white/20 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(image.id, 1)}
                    disabled={index === images.length - 1}
                    aria-label="Move later"
                    className="grid h-6 w-6 place-items-center rounded text-white hover:bg-white/20 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                <div className="flex gap-0.5">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => makePrimary(image.id)}
                      aria-label="Set as main photo"
                      title="Set as main photo"
                      className="grid h-6 w-6 place-items-center rounded text-white hover:bg-white/20"
                    >
                      <CheckIcon />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    aria-label="Delete image"
                    title="Delete image"
                    className="grid h-6 w-6 place-items-center rounded text-white hover:bg-red-500"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
