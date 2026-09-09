import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Runs on the Node.js runtime (not Edge) so it can query Prisma directly for
// the maintenance-mode flag below. Everything else here stays a cheap,
// cookie-only check — the database read is short-TTL cached in module scope.
export const runtime = 'nodejs';

/**
 * Middleware.
 *
 * Runs before every request to apply security headers, seed the CSRF and
 * anonymous-id cookies, cheaply bounce unauthenticated visitors away from
 * protected areas, and gate the site behind /maintenance when the admin has
 * turned that on. It deliberately does *not* validate the session against the
 * database — every protected page and route handler re-checks properly on the
 * server. This is a fast filter, not the security boundary.
 */

const SESSION_COOKIES = ['__Host-ukaf_session', 'ukaf_session'];
const CSRF_COOKIE = 'ukaf_csrf';
const ANON_COOKIE = 'ukaf_cid';

const PROTECTED_PREFIXES = ['/account', '/admin', '/checkout'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

/** Paths that must keep working even while the site is in maintenance mode. */
const MAINTENANCE_EXEMPT_PREFIXES = ['/admin', '/api', '/login', '/maintenance'];

// Module-scope cache: middleware runs in a long-lived Node process for this
// self-hosted deployment, so a few seconds of staleness avoids a DB round
// trip on every single request while still reacting quickly to the toggle.
let maintenanceCache: { value: boolean; expiresAt: number } = { value: false, expiresAt: 0 };

async function isMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (now < maintenanceCache.expiresAt) return maintenanceCache.value;

  let value = false;
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'site' } });
    value = Boolean((row?.value as { maintenanceMode?: boolean } | null)?.maintenanceMode);
  } catch {
    // Database unreachable — fail open rather than locking the whole site out.
    value = false;
  }

  maintenanceCache = { value, expiresAt: now + 10_000 };
  return value;
}

/**
 * Dedicated admin hostname, derived from NEXT_PUBLIC_SITE_URL rather than a
 * separate env var — "ukaf.co.uk" gives "admin.ukaf.co.uk" automatically.
 * Null on localhost, where a subdomain isn't meaningful.
 */
const ADMIN_HOST = (() => {
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002').hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' ? null : `admin.${hostname}`;
  } catch {
    return null;
  }
})();

function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const search = url.search;
  const isProduction = process.env.NODE_ENV === 'production';

  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const isAdminHost = ADMIN_HOST !== null && host === ADMIN_HOST;

  // On the admin subdomain, "/" behaves like "/admin" for auth purposes —
  // signed-out visitors land on the login page, signed-in staff on the
  // dashboard, without needing a separate deployment or app.
  const pathname = isAdminHost && url.pathname === '/' ? '/admin' : url.pathname;

  if (
    pathname !== '/maintenance' &&
    !MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    (await isMaintenanceMode())
  ) {
    const rewritten = url.clone();
    rewritten.pathname = '/maintenance';
    return applyHeaders(NextResponse.rewrite(rewritten, { status: 503 }), request, isProduction);
  }

  const hasSession = SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));

  // Bounce anonymous visitors away from protected areas before any rendering.
  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const redirect = url.clone();
    redirect.pathname = '/login';
    redirect.search = `?next=${encodeURIComponent(pathname + search)}`;
    return applyHeaders(NextResponse.redirect(redirect), request, isProduction);
  }

  // Signed-in users have no business on the sign-in screens.
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const redirect = url.clone();
    redirect.pathname = isAdminHost ? '/admin' : '/account';
    redirect.search = '';
    return applyHeaders(NextResponse.redirect(redirect), request, isProduction);
  }

  // Signed-in staff hitting the admin subdomain's root: serve the dashboard
  // at that clean URL instead of the storefront homepage.
  if (isAdminHost && url.pathname === '/' && hasSession) {
    const rewritten = url.clone();
    rewritten.pathname = '/admin';
    return applyHeaders(NextResponse.rewrite(rewritten), request, isProduction);
  }

  return applyHeaders(NextResponse.next(), request, isProduction);
}

function applyHeaders(response: NextResponse, request: NextRequest, isProduction: boolean): NextResponse {
  // --- Cookies that must exist before a form is rendered ---------------------
  if (!request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, randomToken(24), {
      httpOnly: false, // read by the client to mirror into a header
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  if (!request.cookies.get(ANON_COOKIE)) {
    response.cookies.set(ANON_COOKIE, randomToken(16), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  // --- Security headers -----------------------------------------------------
  const headers = response.headers;

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-DNS-Prefetch-Control', 'off');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=(), payment=(self "https://checkout.stripe.com")',
  );
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (isProduction) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Content Security Policy. Next.js injects inline bootstrap scripts and
  // styles, so 'unsafe-inline' is required for those two directives; every
  // other source is locked to the origin plus the payment provider.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals, the Stripe webhook (which must not
     * have its body touched or be redirected), and static assets.
     */
    '/((?!_next/static|_next/image|api/stripe/webhook|favicon.ico|robots.txt|sitemap.xml|images/|uploads/).*)',
  ],
};
