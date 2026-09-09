'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { cn, PLACEHOLDER_IMAGE } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './ui/Icons';

type GalleryImage = { id: string; url: string; alt: string | null };

/**
 * Vehicle image gallery with thumbnails and a keyboard-navigable lightbox.
 */
export function TruckGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const photos: GalleryImage[] =
    images.length > 0 ? images : [{ id: 'placeholder', url: PLACEHOLDER_IMAGE, alt: title }];

  const go = useCallback(
    (direction: 1 | -1) => {
      setIndex((current) => (current + direction + photos.length) % photos.length);
    },
    [photos.length],
  );

  useEffect(() => {
    if (!lightbox) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, go]);

  const current = photos[index];

  return (
    <>
      <div className="space-y-2.5">
        <div className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-steel-100">
          <Image
            src={current.url}
            alt={current.alt ?? `${title} — image ${index + 1} of ${photos.length}`}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            priority
            className="object-cover"
          />

          {photos.length > 1 ? (
            <>
              <GalleryArrow direction="prev" onClick={() => go(-1)} />
              <GalleryArrow direction="next" onClick={() => go(1)} />
              <p className="absolute bottom-3 right-3 rounded-full bg-steel-950/70 px-2.5 py-1 text-xs font-medium text-white">
                {index + 1} / {photos.length}
              </p>
            </>
          ) : null}

          {images.length > 0 ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="absolute inset-0 cursor-zoom-in"
              aria-label={`Enlarge image ${index + 1} of ${photos.length}`}
            />
          ) : null}
        </div>

        {photos.length > 1 ? (
          <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {photos.map((photo, position) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`Show image ${position + 1}`}
                  aria-current={position === index}
                  className={cn(
                    'relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 bg-steel-100 transition-colors',
                    position === index ? 'border-brand-500' : 'border-transparent hover:border-steel-300',
                  )}
                >
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} images`}
          className="fixed inset-0 z-[80] flex flex-col bg-steel-950/95 backdrop-blur"
        >
          <div className="flex items-center justify-between p-4 text-white">
            <p className="text-sm font-medium">
              {title} — {index + 1} of {photos.length}
            </p>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              autoFocus
              aria-label="Close image viewer"
              className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"
            >
              <CloseIcon className="text-xl" />
            </button>
          </div>

          <div className="relative flex-1">
            <Image
              src={current.url}
              alt={current.alt ?? title}
              fill
              sizes="100vw"
              className="object-contain p-4"
            />
            {photos.length > 1 ? (
              <>
                <GalleryArrow direction="prev" onClick={() => go(-1)} inverted />
                <GalleryArrow direction="next" onClick={() => go(1)} inverted />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function GalleryArrow({
  direction,
  onClick,
  inverted,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
  inverted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Previous image' : 'Next image'}
      className={cn(
        'absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full transition-opacity',
        direction === 'prev' ? 'left-3' : 'right-3',
        inverted
          ? 'bg-white/10 text-white hover:bg-white/20'
          : 'bg-white/90 text-steel-800 opacity-0 shadow-sm hover:bg-white focus-visible:opacity-100 group-hover:opacity-100',
      )}
    >
      {direction === 'prev' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}
