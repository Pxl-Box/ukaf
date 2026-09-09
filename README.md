# UKAF — commercial vehicle sales platform

A production-shaped e-commerce and CRM platform for an HGV dealer: a multi-currency
storefront, Stripe checkout with reservation deposits, a full sales CRM, and an
admin backend for stock, pricing, users and site content.

Built with Next.js 15 (App Router), TypeScript, PostgreSQL via Prisma, Stripe and Resend.

---

## Quick start

```bash
npm install
cp .env.example .env          # then fill in the values below
docker compose up -d          # local PostgreSQL on port 5433
npm run db:migrate            # create the schema
npm run db:seed               # reference data + demo stock
npm run dev
```

Then open http://localhost:3000 and sign in at `/login`:

| Role  | Email                | Password        |
| ----- | -------------------- | --------------- |
| Owner | `admin@ukaf.co.uk`   | `ChangeMe!2024` |
| Sales | `sales@ukaf.co.uk`   | `ChangeMe!2024` |

**Change both passwords before this touches a real network.**

> Prisma's CLI reads `.env`, and Next.js reads `.env` too, so keep everything in
> one `.env` file locally rather than splitting across `.env.local`.

---

## Environment

Only two variables are genuinely required to boot: `DATABASE_URL` and `AUTH_SECRET`.
Everything else degrades gracefully — without Stripe the site offers "enquire"
instead of "reserve"; without Resend, emails are logged to the console.

Generate the auth secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Keys the HMAC for session tokens, CSRF and signed links |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | Absolute URLs in emails and Stripe redirects |
| `STRIPE_SECRET_KEY` | for payments | Server-side Stripe key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for payments | Client-side Stripe key |
| `STRIPE_WEBHOOK_SECRET` | for payments | **Without this, orders are never marked paid** |
| `RESEND_API_KEY` | for email | Transactional email |
| `EMAIL_FROM` | for email | Verified sender address |
| `SALES_NOTIFICATION_EMAILS` | recommended | Comma-separated internal inbox for new enquiries |
| `FX_API_URL` / `FX_API_KEY` | optional | Automatic exchange-rate refresh |
| `CRON_SECRET` | optional | Bearer token for `/api/cron/housekeeping` |
| `NEXT_PUBLIC_COMPANY_*` | recommended | Legal identity used in emails, footer and policies |

`/admin/settings` shows a live checklist of which integrations are configured.

### Stripe webhooks in development

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. Payment is only
reconciled by the webhook, never by the browser returning from Stripe — so a
customer closing the tab mid-payment still gets a correct order.

---

## What is in here

### Storefront
- Faceted stock search — make, body type, year, mileage, price, axle config,
  emissions, gearbox, fuel, depot. All state lives in the URL, so every filtered
  view is shareable and server-rendered.
- Vehicle pages with a gallery and lightbox, full specification, documents,
  finance illustration, enquiry form and structured data for rich results.
- Comparison tool (up to four vehicles, stored per-browser).
- Reservation deposits through Stripe Checkout, guest or signed-in.
- Saved vehicles, customer accounts, order history, address book.
- Finance enquiries, part-exchange valuations, "sell us your truck".

### Multi-currency
Catalogue prices are stored **once**, in the base currency, as integer minor
units. Everything else is derived:

- `Currency.rateToBase` is "units of this currency per 1 unit of base".
- Conversion and formatting happen **on the server**, so first paint is already
  correct — no flash of the wrong currency.
- `roundTo` rounds converted prices to a tidy figure (e.g. nearest €1) rather
  than showing €55,867.53.
- Orders record their presentment currency, the FX rate used at the moment of
  sale, and the base-currency equivalent for reporting. Rates can move
  afterwards without rewriting history.
- Staff manage rates at `/admin/currencies`, manually or from an FX provider.

### CRM
- Every enquiry becomes a lead, auto-assigned round-robin to the least-loaded
  sales rep and scored 0–100 on transparent, tunable rules.
- Kanban pipeline weighted by the value of the vehicle each buyer is looking at.
- Per-lead timeline: notes, calls, emails, meetings, viewings and tasks, with
  overdue follow-ups surfaced on the dashboard.
- Part-exchange records, finance enquiries, customer 360 view.

### Admin
Stock CRUD with image upload and reordering, price history, margin reporting,
orders with Stripe refunds, customers, staff accounts and roles, currencies,
discount codes, legal page CMS, site settings and an append-only audit log.

---

## Security

This is a site that takes card payments and holds customer data, so the security
posture is deliberate rather than incidental.

**Authentication**
- Passwords hashed with scrypt (N=2^16, ~64 MB per hash), parameters embedded in
  the hash so they can be raised later without invalidating existing accounts.
  Hashes are transparently upgraded on the next successful sign-in.
- Session tokens are 256-bit random values; the database stores only an HMAC of
  them, so a read-only database leak cannot be replayed as a valid session.
- Sliding expiry, idle timeout, and per-device session listing with
  "sign out everywhere".
- Progressive lockout after repeated failures, rate limited per IP **and** per
  account so a distributed attack on one account still trips the limit.
- Login, registration and password reset return identical responses whether or
  not the address exists, so accounts cannot be enumerated. Misses spend
  comparable CPU so response timing does not leak either.

**Request integrity**
- CSRF on every state-changing request: signed double-submit cookie plus a
  strict `Origin` check.
- Zod validation on every request body before it reaches the database.
- Prisma throughout, so all SQL is parameterised.
- Rate limiting with named buckets per endpoint class, enforced in-process and
  in the database so it holds across instances.
- Honeypot fields on every public form.

**Headers and transport**
- Content Security Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`,
  strict referrer policy and a locked-down `Permissions-Policy`, all set in
  middleware.
- Session cookies are `httpOnly`, `SameSite=Lax`, `Secure` in production, and use
  the `__Host-` prefix.

**Authorisation**
- Five roles (`CUSTOMER` → `SUPERADMIN`) with rank-based checks.
- Nobody can grant a role above their own, change their own role, or suspend
  their own account.
- Suspending a user revokes their sessions immediately.
- Middleware only does a cheap cookie-presence check; the real authorisation is
  re-checked server-side on every page and route handler.

**Payments**
- Amounts are always recomputed server-side from the database. Nothing about
  price comes from the client.
- Webhooks verify the Stripe signature against the raw body, are idempotent by
  event id, and store every event for replay.
- Card payments are capped; higher-value balances go via bank transfer.

**Data protection**
- Uploads are typed by sniffing magic bytes, never the client's filename.
- Registration numbers, VINs and cost prices are excluded from the public
  serialiser.
- Deleting a user anonymises them while preserving order history for tax law.
- Audit log records who did what, when, from where — append-only in the UI.
- Consent records store a hash of the IP, not the address itself.

---

## Compliance

- **Cookie banner** — nothing beyond strictly necessary is set before an
  affirmative choice; rejecting is exactly as easy as accepting. Consent is
  recorded server-side with the policy version, so it can be evidenced.
- **Cookie policy** — the table is generated from `COOKIE_REGISTRY`, the same
  registry the application uses, so the disclosure cannot drift from reality.
- **Policies** — terms of sale, privacy, cookies and cancellation/refunds ship as
  substantive default text written for a UK commercial vehicle dealer, and are
  overridable from `/admin/pages` with version tracking.

> The bundled policies are a careful starting point, **not legal advice**. Have a
> solicitor review them against how you actually trade before relying on them.

Bumping `POLICY_VERSION` in `src/lib/settings.ts` re-prompts every visitor for
cookie consent.

---

## Project layout

```
prisma/
  schema.prisma          Full SQL data model (30+ models)
  seed.ts                Reference data, demo stock, demo CRM pipeline
scripts/
  reset-demo-data.ts     Clears demo stock/leads (refuses if orders exist)
src/
  app/                   Routes: storefront, account, admin, API
  components/            UI, forms, layout, admin shell
  content/legal.ts       Default legal copy
  lib/                   auth, money, currency, trucks, cart, orders, leads,
                         email, stripe, audit, rate-limit, csrf, validation
  middleware.ts          Security headers, CSRF/anon cookies, route gating
```

### Money

Every amount is an **integer in minor units** (pence, cents). Floating point is
used only inside a conversion, never for storage, so rounding error cannot
accumulate. VAT rates are basis points — `2000` is 20%.

Four VAT treatments are modelled, because they behave differently at checkout
and on the invoice: plus VAT, VAT qualifying, margin scheme, and no VAT.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed reference data and demo content |
| `npm run db:studio` | Prisma Studio |
| `npm run stripe:listen` | Forward Stripe webhooks locally |

---

## Deployment

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` and the Stripe/Resend keys.
3. `npm run db:deploy` then `npm run build`.
4. Point a Stripe webhook endpoint at `https://your-domain/api/stripe/webhook`
   for `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed` and `charge.refunded`.
5. Schedule `POST /api/cron/housekeeping` hourly with
   `Authorization: Bearer $CRON_SECRET` — it expires sessions and tokens, cancels
   abandoned checkouts, prunes old webhook payloads, enforces the data retention
   periods in the privacy policy, and refreshes FX rates.
6. Sign in, change the seeded passwords, and review `/admin/settings`.

File uploads currently write to `public/uploads`, which does not survive on
ephemeral filesystems. For production, repoint `src/app/api/admin/upload/route.ts`
at S3/R2 — the response contract (a public URL) stays the same.

---

## Known gaps

Honest list of what is scaffolded rather than finished:

- **Discount codes** can be created and managed, but are not yet applied during
  checkout — the `Order.discount` column and validation exist, the redemption
  step does not.
- **Full-purchase checkout** is disabled by default (`enableFullPurchase`), since
  cards are a poor fit for £50k+ transactions. Reservation deposits are the
  primary flow.
- **Finance applications** are broker enquiries only. No credit search, no lender
  integration.
- **Search** uses `ILIKE` matching, which is fine to a few thousand vehicles.
  Beyond that, move to Postgres full-text search or a dedicated index.
- **Testimonials** are stored and manageable but not yet surfaced on the
  storefront.
- There are **no automated tests** yet. The critical paths to cover first are
  money conversion, VAT treatment, the Stripe webhook's idempotency, and the
  RBAC guards.
