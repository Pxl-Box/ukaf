'use client';

import { useEffect } from 'react';

/**
 * Root-layout error boundary. `error.tsx` only catches errors thrown while
 * rendering a route's own tree — a crash in the root layout itself (header,
 * footer, or anything shared) bypasses it entirely and falls back to Next's
 * unstyled default unless this file exists. It must render its own
 * <html>/<body> since the root layout that would normally provide them is
 * exactly what failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Unhandled root layout error:', error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8f9fb', color: '#1a2138' }}>
        <div style={{ maxWidth: 480, margin: '96px auto', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2451e0' }}>
            Error 500
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>Something went wrong</h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: '#5b6478' }}>
            We hit an unexpected problem loading the site. It has been logged and we will look into it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 28,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2451e0',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 32, fontSize: 12, color: '#9aa2b5' }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
