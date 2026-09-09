'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertIcon } from '@/components/ui/Icons';

/**
 * Route-level error boundary. Never renders the raw error message — it can
 * contain internals — but does surface the digest so a support call can be
 * matched to a server log entry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Unhandled render error:', error);
  }, [error]);

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <AlertIcon className="mx-auto text-5xl text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">
          We hit an unexpected problem loading this page. It has been logged and we will look into it. Trying again
          often works.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Back to the homepage
          </Link>
          <Link href="/contact" className="btn-ghost">
            Contact us
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-8 text-xs text-steel-400">
            Reference: <code className="font-mono">{error.digest}</code>
            <span className="block mt-1">Quote this if you contact us about the problem.</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
