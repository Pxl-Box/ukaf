# Splitting UKAF into two sites: storefront + admin

This documents how to take the current single Next.js app and split it into
**two independently deployed sites that share one PostgreSQL database**:

- **`ukaf-storefront`** — public site. Browsing, accounts, cart, checkout.
  What customers see. No admin code ships to this bundle at all.
- **`ukaf-admin`** — internal site, on its own subdomain (e.g. `admin.ukaf.co.uk`),
  behind its own login. Stock, pricing, orders, CRM, users, settings.

Both talk to the **same** Postgres database directly through Prisma. Neither
calls the other over HTTP. The database is the shared contract between them —
the moment sales edits a price in the admin, the storefront's next page render
sees it, because they're reading the same rows.

This is not a rewrite. It's a repo split: most files move as-is into one app
or the other, and a small shared package holds what both need.

---

## 1. Why split it at all

Right now `/admin/**` and the storefront live in one Next.js project (one
`package.json`, one build, one deploy). That's simpler to run and is exactly
what's been built and verified. Reasons you'd split it:

- **Blast radius.** A bug or a bad deploy in the admin app can't take the
  storefront down, and vice versa. Today they share one process — an admin
  page throwing at build time fails the whole site's build.
- **Independent scaling.** The storefront gets customer traffic and needs to
  scale/cache aggressively (ISR, CDN). The admin gets a handful of staff and
  doesn't need any of that — different infrastructure profile.
- **Independent access control at the network level.** Today, `/admin` is
  gated by `requireStaff()` in application code — correct, but the routes are
  still reachable on the public domain. Splitting lets you put the admin
  behind a separate hostname, IP allowlist, VPN, or SSO in front of the app
  entirely, so a Next.js auth bug isn't the *only* thing standing between the
  public internet and your CRM.
- **Separate release cadence.** Ship a storefront redesign without touching
  or re-testing the admin, and vice versa.
- **Smaller bundles.** The storefront never ships admin JS (form builders,
  the pipeline board, the image manager) — smaller client bundles, faster
  first load for customers.

The cost: two deployments to run, two sets of environment variables, and a
shared package to keep in sync. For a single small team this is a real cost.
If none of the reasons above are biting yet, the current single-app setup is
the right call and this doc is worth reading but not necessarily acting on. It
was written so the split is available the day it matters.

---

## 2. The core idea: one database, two Prisma clients, no API between them

```
┌─────────────────────┐        ┌─────────────────────┐
│   ukaf-storefront    │        │     ukaf-admin       │
│  storefront.vercel..  │        │  admin.ukaf.co.uk    │
│  or www.ukaf.co.uk   │        │                      │
│                      │        │                      │
│  Next.js app         │        │  Next.js app         │
│  Prisma Client ───┐  │        │  ┌─── Prisma Client  │
└────────────────────┼──┘        └──┼────────────────────┘
                     │              │
                     ▼              ▼
              ┌──────────────────────────┐
              │   PostgreSQL (one DB)     │
              │   Managed: Neon / RDS /   │
              │   Supabase / Railway      │
              └──────────────────────────┘
```

Both apps:

- have their own `prisma/schema.prisma` — **identical copies**, kept in sync
  via the shared package (see §4) — or, more simply, both point at the same
  `DATABASE_URL` and each runs `prisma generate` from the same schema file
  that lives in the shared package;
- connect straight to Postgres with their own connection pool;
- run migrations from **one place only** — see §6, this is the part that
  bites people if you don't nail it down.

Neither app calls the other's `/api/*` routes. There's no "admin talks to
storefront's API to update a price" — the admin writes directly to `Truck` via
Prisma, same as it does today. Nothing about the data-access code changes,
only where it's deployed.

### Sessions do not carry across

Today, one login system, one `Session` table, one cookie (`ukaf_session`)
scoped to one domain. Split into two domains and **you get two separate login
systems by default** — a customer signed in at `ukaf.co.uk` is not
automatically signed in at `admin.ukaf.co.uk`, and that's exactly what you
want. Staff get their own login page on the admin domain; customers never see
it. Concretely:

- `Session.userId` still points at the same `User` table either app can see.
- Each app sets its own cookie, scoped to its own domain — you cannot share a
  cookie across `ukaf.co.uk` and `admin.ukaf.co.uk` without them being
  subdomains of one registrable domain with a shared cookie domain
  (`.ukaf.co.uk`), and you don't want to anyway: keeping the cookies separate
  means a stolen storefront session cookie is useless against the admin.
- The admin app's login route only needs to accept `SALES` role and above —
  reject `CUSTOMER` at the login endpoint itself, not just at the page level,
  so a customer's credentials are correctly rejected before any session is
  minted for the admin domain. See §5.

---

## 3. What moves where

Using this repo's current layout as the map:

### → `ukaf-storefront`

```
src/app/
  layout.tsx, page.tsx, globals.css
  trucks/, compare/, cart/, checkout/, account/
  login/, register/, forgot-password/, reset-password/, verify-email/
  contact/, about/, delivery/, finance/, part-exchange/,
  sell-your-truck/, warranty/, newsletter/, legal/
  sitemap.ts, robots.ts, not-found.tsx, error.tsx
  api/
    auth/**            (customer-facing: register, login, logout,
                          forgot/reset password, verify-email, change-password)
    cart/, checkout/, saved/, currency/, consent/, enquiries/,
    finance/, newsletter/**, trucks/compare/, account/**
    stripe/webhook      ← storefront-side: it fulfils customer orders
src/components/         (everything except src/components/admin/)
src/lib/                 all of it — see §4, this becomes the shared package
src/content/legal.ts
public/
```

### → `ukaf-admin`

```
src/app/
  admin/**              (layout, dashboard, trucks, leads, pipeline,
                          orders, customers, currencies, catalogue,
                          discounts, pages, users, settings, audit, finance)
  login/                ← admin has its own, staff-only login page
  api/
    admin/**             every /api/admin/* route
    cron/housekeeping    ← admin owns scheduled maintenance
src/components/admin/
src/lib/                 same shared package as the storefront
```

### Split down the middle: `stripe/webhook`

The webhook fulfils *customer* orders (marks paid, updates stock, sends the
customer's confirmation email) — that's storefront territory, since it's
customer-order fulfilment logic, not a staff action. Refund *initiation*
(`POST /api/admin/orders` with `action: 'refund'`) is admin territory, since
only staff can trigger it. This is the one place where the two apps'
responsibilities are genuinely interleaved:

- **storefront** owns the Stripe **webhook endpoint** (`checkout.session.completed`,
  `charge.refunded`, etc.) — register this URL in the Stripe dashboard.
- **admin** owns the refund **request** — it calls the Stripe API to start a
  refund, then the storefront's webhook receives `charge.refunded` and
  reconciles the order, exactly as it does today. No change to that flow at
  all, it already goes through Stripe as the intermediary rather than
  app-to-app.

Both apps need a Stripe secret key capable of the actions they perform:
storefront needs `checkout.sessions.create` and webhook verification; admin
needs `refunds.create`. Same Stripe account, can be the same key or two
[restricted keys](https://stripe.com/docs/keys#limit-access) scoped
appropriately — restricted keys are the better call once this is split, since
now there's a real boundary to enforce it at.

---

## 4. The shared package: `@ukaf/core`

Everything in `src/lib/` today has no dependency on whether it's running in
an admin page or a storefront page — `auth.ts`, `db.ts`, `money.ts`,
`currency.ts`, `trucks.ts`, `cart.ts`, `orders.ts`, `leads.ts`, `email.ts`,
`stripe.ts`, `audit.ts`, `rate-limit.ts`, `csrf.ts`, `validation.ts`,
`settings.ts`, `consent.ts`, `tokens.ts`, `password.ts`, `env.ts`, `utils.ts`.
That whole directory becomes a shared internal package both apps depend on,
plus the Prisma schema itself.

```
packages/
  core/
    package.json           name: "@ukaf/core"
    prisma/
      schema.prisma         ← the ONE schema, single source of truth
      migrations/
    src/
      db.ts, auth.ts, money.ts, currency.ts, trucks.ts, cart.ts,
      orders.ts, leads.ts, email.ts, stripe.ts, audit.ts,
      rate-limit.ts, csrf.ts, validation.ts, settings.ts,
      consent.ts, tokens.ts, password.ts, env.ts, utils.ts
    index.ts                 re-exports the above

apps/
  storefront/                ← today's src/app minus admin/
    package.json             deps on "@ukaf/core": "workspace:*"
    src/app/, src/components/ (non-admin)

  admin/                     ← today's src/app/admin + src/app/api/admin
    package.json             deps on "@ukaf/core": "workspace:*"
    src/app/, src/components/admin/
```

Use npm/pnpm/yarn **workspaces** (a monorepo) rather than publishing
`@ukaf/core` to a registry — for two internal apps that deploy together,
publishing is pure overhead. `pnpm-workspace.yaml` or the `workspaces` field
in the root `package.json` is enough:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Each app's `next.config.mjs` needs `transpilePackages: ['@ukaf/core']` (or
equivalent) since the shared package ships TypeScript source, not a
pre-built bundle — simplest option for a monorepo, no separate build step
for the shared package.

### What doesn't move into the shared package

- `src/components/` (non-admin) → storefront only.
- `src/components/admin/` → admin only.
- `src/content/legal.ts` → storefront only (renders the legal pages) — unless
  the admin's page editor needs the defaults for a "reset to default" button,
  in which case it moves to `@ukaf/core` too.
- Anything reading `NEXT_PUBLIC_*` env vars for client components needs those
  vars set in **both** apps' environments (see §7) since each app has its own
  build-time env.

---

## 5. Auth: two logins, one `User` table

This is the part worth being deliberate about, because it's a security
boundary, not just a code-organisation choice.

**Storefront login** (`apps/storefront/src/app/api/auth/login/route.ts`):
accepts anyone in `User` regardless of role — customers, and staff who also
want a storefront account to browse and buy. No role check on this endpoint
today, and that's correct to keep: staff are customers too, some of the time.

**Admin login** (`apps/admin/src/app/api/auth/login/route.ts`): a **separate**
route, sharing the same password-verification logic from `@ukaf/core`, but
add one line the storefront's doesn't have:

```ts
// apps/admin — after password verification succeeds, before creating a session
if (!hasRole(user, 'SALES')) {
  return fail('This account does not have access to the admin.', 403, {
    code: 'NOT_STAFF',
  });
}
```

Reject at the API layer, not just by hiding the login link — the whole point
of the split is that the admin domain shouldn't mint a session for a
`CUSTOMER` account even if they somehow find the login page. `requireStaff()`
in `@ukaf/core` already does this check on every admin page render today; in
the split, do it here too, at the front door, so an unauthorised session is
never created in the first place rather than being created and then blocked
per-page.

**Session table.** One `Session` row format, one table, both apps read and
write it via the shared Prisma client. A session created by the admin login
and a session created by the storefront login are indistinguishable rows in
the database — what makes them different is only *which cookie, on which
domain, points at which row*. `getSession()` in `@ukaf/core` works unchanged
in both apps.

**Cookie name.** Keep them distinct so they're never confusable in a browser
dev tools panel or a log line: e.g. `ukaf_session` (storefront) and
`ukaf_admin_session` (admin). Each app's `auth.ts` import from `@ukaf/core`
can take the cookie name as a constant the app defines, or simplest: give
`@ukaf/core`'s auth module a `SESSION_COOKIE_NAME` that reads from an env var
set differently per app.

**Password reset / email verification tokens** are already
`VerificationToken` rows keyed by `userId` and type
(`EMAIL_VERIFICATION` | `PASSWORD_RESET` | `STAFF_INVITE`). No change needed —
a token minted by the admin's "invite staff" flow is redeemed at
`/reset-password` wherever that page lives. Decide where staff-invite links
point: since staff don't have storefront accounts by default and the invite
flow (`sendStaffInviteEmail`) is admin-only, point invite links at
`admin.ukaf.co.uk/reset-password`, i.e. the admin app needs its own copy of
that page too (it's small — `ResetPasswordForm.tsx` is ~100 lines, fine to
duplicate rather than share for one page).

---

## 6. Migrations: one source of truth, one direction

**Rule: migrations are authored and run from exactly one place.** Never run
`prisma migrate dev` from both apps against the same database — Prisma tracks
applied migrations in a `_prisma_migrations` table, and having two projects
independently generate migration files against the same schema history is
how you get drift and conflicts.

Two clean ways to do it:

**Option A — the shared package owns migrations (recommended).**
`packages/core/prisma/` is the only place `prisma migrate dev` and
`prisma migrate deploy` are ever run. Both apps' `schema.prisma` is a
*symlink or a build-time copy* of the one in `@ukaf/core`, so there's
genuinely one file. CI runs `prisma migrate deploy` against production as a
step in the release pipeline for *either* app — pick one app's pipeline to
own that step (say, admin's, since admin changes are more likely to need a
schema change), and the other app's pipeline just runs `prisma generate`
(regenerates the client from the current schema, applies no migrations).

**Option B — a third, tiny "migrator" job.** A minimal script/package whose
only job is `prisma migrate deploy`, run as its own CI job or a manual step
before deploying either app. Slightly more infrastructure, but makes "who
runs migrations" unambiguous — neither app's pipeline does it implicitly.

Either way, the deploy order that matters: **migrate the database before
deploying app code that depends on the new schema**, and prefer
backward-compatible migrations (add a nullable column, don't rename in place)
so the *old* version of the other app doesn't break for the few minutes
between "storefront redeployed with a new column" and "admin catches up."
This is standard practice for any two-service-one-database setup, not
specific to this split.

---

## 7. Environment variables per app

Neither app needs every variable the current monolith uses — split by who
actually touches that integration:

| Variable | Storefront | Admin |
|---|:-:|:-:|
| `DATABASE_URL` | ✅ | ✅ |
| `AUTH_SECRET` | ✅ | ✅ *(must be the same value in both — it's what makes a session-token HMAC computed by one app verifiable by the other, and what the CSRF cookie is signed with)* |
| `NEXT_PUBLIC_SITE_URL` | ✅ (its own URL) | ✅ (its own URL — used in admin's emails, e.g. staff invites) |
| `STRIPE_SECRET_KEY` | ✅ | ✅ *(scope as a restricted key — refunds only, see §3)* |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | — |
| `STRIPE_WEBHOOK_SECRET` | ✅ | — |
| `RESEND_API_KEY` | ✅ | ✅ |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | ✅ | ✅ |
| `SALES_NOTIFICATION_EMAILS` | ✅ *(new-enquiry emails fire from storefront actions)* | — |
| `FX_API_URL` / `FX_API_KEY` | — | ✅ *(rate refresh is an admin action)* |
| `CRON_SECRET` | — | ✅ *(admin owns `/api/cron/housekeeping`)* |
| `BASE_CURRENCY` / `NEXT_PUBLIC_BASE_CURRENCY` | ✅ | ✅ |
| `NEXT_PUBLIC_COMPANY_*` | ✅ | ✅ *(used in admin emails and the settings page)* |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | ✅ *(seeding is an admin/ops concern)* |

`AUTH_SECRET` being identical across both is the one hard requirement — get
it wrong and CSRF/session HMACs computed by one app won't verify against
values the other app might touch (in practice they mostly won't touch each
other's cookies, but keep it identical anyway; it costs nothing and removes
a whole class of "why did this only break in prod" bugs).

---

## 8. Deployment topology

A reasonable concrete setup:

```
ukaf.co.uk              → apps/storefront   (Vercel, or any Next.js host,
                                              public, ISR/CDN-cached pages)
admin.ukaf.co.uk        → apps/admin        (same host or a different one,
                                              e.g. locked to a VPN/IP allowlist
                                              at the platform level, or behind
                                              an identity-aware proxy)

Shared:
  PostgreSQL             → Neon / Supabase / RDS / Railway — one instance,
                            reachable from both deploy targets. Use a pooler
                            (PgBouncer, or the provider's built-in pooler) if
                            both apps run serverless — each serverless
                            invocation opens its own connection, and two
                            apps' worth of cold-start connection churn adds
                            up fast without pooling.
  Stripe                 → one account, two keys (or one key used two ways)
  Resend                 → one account
```

If you want the network-level isolation mentioned in §1 (admin not reachable
from the open internet at all), that's configured at the hosting platform —
e.g. Vercel's deployment protection / a WAF rule / putting the admin behind a
Cloudflare Access or Tailscale-fronted origin — not in the Next.js app
itself. The app-level `requireStaff()` check stays regardless, as
defence-in-depth; the network control is an *additional* layer, not a
replacement for it.

---

## 9. Migration path from today's single app

Doing this as a sequence of small, always-shippable steps rather than one big
bang:

1. **Extract `src/lib/` into `packages/core`** inside the *current* single
   app first, with the app importing from `@ukaf/core` instead of `@/lib`.
   Ship this. Nothing about behaviour changes; it's a pure refactor and
   proves the shared package boundary is clean before anything is split
   physically.
2. **Introduce the workspace structure** (`apps/`, `packages/`) with the
   *current* app moved into `apps/web` unchanged, still serving both
   storefront and admin routes from one deploy. Ship this. Confirms the
   monorepo tooling (workspaces, `transpilePackages`) works end-to-end.
3. **Create `apps/admin`** as a genuinely new Next.js app, copy
   `src/app/admin/**` and `src/app/api/admin/**` into it, add the admin-only
   login route from §5, wire up its own env vars. Deploy it to
   `admin.ukaf.co.uk` **alongside** the still-running monolith — both are
   live at once, pointing at the same database, admin routes reachable from
   two places temporarily.
4. **Cut over:** point staff at `admin.ukaf.co.uk`, then delete
   `src/app/admin/**` and `src/app/api/admin/**` from `apps/web`
   (which becomes `apps/storefront` at this point — rename it).
5. **Split migrations ownership** per §6 once both apps are stable in
   production for a release cycle or two.

At every step there's a working, deployed system — never a period where
"the split is half-done and nothing runs."

---

## 10. What stays exactly the same

Worth being explicit that this split touches **deployment topology and repo
layout only** — it does not change:

- The database schema (`prisma/schema.prisma` is untouched).
- Any business logic — pricing, VAT, currency conversion, lead scoring,
  the Stripe webhook's idempotency handling, audit logging.
- The security model — CSRF, rate limiting, RBAC, session hashing — all of
  `@ukaf/core`'s `auth.ts`/`csrf.ts`/`rate-limit.ts` work identically inside
  either app, because they never assumed a single deployment in the first
  place (they take a `Request`/cookie jar, not global state).
- The public API contracts customers interact with — checkout, enquiries,
  account management — none of these routes change shape, only which app
  process serves them.

If none of the reasons in §1 are pressing yet, staying on one app is a
perfectly good long-term choice too — this document exists so the split is a
known, de-risked path the day it's needed, not something to do speculatively
now.
