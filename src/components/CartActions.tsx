'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/client-api';
import { TrashIcon } from './ui/Icons';
import { Spinner } from './ui/primitives';

export function RemoveCartItemButton({ itemId, title }: { itemId: string; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await apiFetch('/api/cart', { method: 'DELETE', json: { itemId } });
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Remove ${title} from your basket`}
      className="shrink-0 rounded-lg p-1.5 text-steel-400 transition-colors hover:bg-red-50 hover:text-red-600"
    >
      {pending ? <Spinner /> : <TrashIcon />}
    </button>
  );
}
