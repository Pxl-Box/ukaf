import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware.
 *
 * Runs before every request to apply security headers, seed the CSRF and
 * anonymous-id cookies, and cheaply bounce unauthenticated visitors away from
 * protected areas. It deliberately does *not* validate the session against the
 * database — the Edge runtime has no Prisma access, and every protected page
 * and route handler re-checks properly on the server. This is a fast filter,
 * not the security boundary.
 */

const SESSION_COOKIES = ['__Host-ukaf_session', 'ukaf_session'];
const CSRF_COOKIE = 'ukaf_csrf';
const ANON_COOKIE = 'ukaf_cid';

const PROTECTED_PREFIXES = ['/account', '/admin', '/checkout'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  const hasSession = SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));

  // Bounce anonymous visitors away from protected areas before any rendering.
  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return applyHeaders(NextResponse.redirect(url), request, isProduction);
  }

  // Signed-in users have no business on the sign-in screens.
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/account';
    url.search = '';
    return applyHeaders(NextResponse.redirect(url), request, isProduction);
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
