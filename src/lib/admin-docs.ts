/**
 * In-app admin documentation content.
 *
 * Plain structured data rather than MDX/markdown — no extra rendering
 * dependency, and it stays type-checked. Rendered by
 * `src/app/admin/docs/DocsBrowser.tsx`.
 *
 * This app is still under active development, so some of this will drift out
 * of date as features change. See `docs/admin-docs-changelog.md` for a
 * running log of admin-facing changes to reconcile against this file later.
 */

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'note'; tone: 'info' | 'warning' | 'danger'; text: string };

export type DocArticle = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  keywords: string[];
  blocks: DocBlock[];
};

const p = (text: string): DocBlock => ({ type: 'p', text });
const h3 = (text: string): DocBlock => ({ type: 'h3', text });
const ul = (...items: string[]): DocBlock => ({ type: 'ul', items });
const steps = (...items: string[]): DocBlock => ({ type: 'steps', items });
const note = (tone: 'info' | 'warning' | 'danger', text: string): DocBlock => ({ type: 'note', tone, text });

export const ADMIN_DOCS: DocArticle[] = [
  // ------------------------------------------------------------- Getting started
  {
    slug: 'roles-and-permissions',
    section: 'Getting started',
    title: 'Roles & permissions',
    summary: 'What each staff role can see and do, and how role checks work.',
    keywords: ['role', 'permission', 'sales', 'manager', 'admin', 'superadmin', 'owner', 'access'],
    blocks: [
      p('Every staff account has one role, and roles are ranked — a higher role automatically includes everything a lower one can do.'),
      ul(
        'Sales executive — manage enquiries and their own pipeline, add and edit stock, update orders.',
        'Sales manager — everything Sales can do, plus delete stock and enquiries, issue refunds, manage currencies and discounts.',
        'Administrator — everything above, plus staff accounts, legal pages, site settings and the audit log.',
        'Owner (superadmin) — full access, including permanently erasing customer data.',
      ),
      note('info', 'This same list is shown live on the Users & roles page, so that page is always the source of truth if this drifts.'),
      p('Nobody can grant a role above their own, or change their own role or suspend their own account — this prevents both accidental and deliberate lock-outs.'),
    ],
  },
  {
    slug: 'default-accounts',
    section: 'Getting started',
    title: 'Default accounts (development)',
    summary: 'The seeded admin and sales accounts, and how to convert others.',
    keywords: ['seed', 'default', 'password', 'sales account', 'admin account', 'dev'],
    blocks: [
      p('Running the database seed creates two accounts for local development and testing:'),
      ul(
        'Owner — admin@ukaf.co.uk',
        'Sales executive — sales@ukaf.co.uk',
      ),
      p('Both use the password set by SEED_ADMIN_PASSWORD in your environment (ChangeMe!2024 by default). Change both before this goes anywhere near a real network.'),
      note('warning', 'Change these credentials — and ideally delete or reassign the seeded accounts — before onboarding real staff or going live.'),
      p('The sales account is deliberately excluded from mandatory two-factor login (see "Two-factor login") so it stays quick to use for local testing. Use it to sign in and then create or promote real staff accounts from Users & roles.'),
    ],
  },

  // ------------------------------------------------------------- Stock & catalogue
  {
    slug: 'adding-a-vehicle',
    section: 'Stock & catalogue',
    title: 'Adding a new vehicle listing',
    summary: 'Create a stock listing, set its category, fields, images and status.',
    keywords: ['vehicle', 'truck', 'listing', 'stock', 'add', 'new', 'create', 'model', 'make'],
    blocks: [
      steps(
        'Go to Vehicles → Add vehicle.',
        'Choose a Make and enter the model, year, mileage and the usual specification fields.',
        'Choose a Category (body type) — this determines which custom fields appear further down the form (see "Categories & custom fields").',
        'Fill in the category-specific fields that appear once a category is chosen.',
        'Set the price and VAT treatment.',
        'Upload photos — the first image becomes the primary listing photo.',
        'Set the Status: Draft keeps it hidden from the public site; Published makes it live in search and listings.',
        'Save.',
      ),
      note('info', 'A listing only appears on the public storefront once its status is Published and it has at least one image.'),
      p('The stock number is generated automatically and is what customers and staff use to refer to a specific vehicle in enquiries and orders.'),
    ],
  },
  {
    slug: 'editing-removing-vehicle',
    section: 'Stock & catalogue',
    title: 'Editing, unpublishing or deleting a listing',
    summary: 'Update stock, take it off-sale, or remove it entirely.',
    keywords: ['edit', 'delete', 'unpublish', 'sold', 'archive', 'vehicle'],
    blocks: [
      p('Open the vehicle from the Vehicles list and edit any field the same way as when it was created.'),
      ul(
        'To take a live vehicle off-sale without deleting its history (enquiries, price history), change its Status rather than deleting it.',
        'Price changes are recorded in the vehicle\'s price history automatically — there is no separate step for this.',
        'Deleting a vehicle is permanent and requires the Sales manager role or above.',
      ),
    ],
  },
  {
    slug: 'categories-and-custom-fields',
    section: 'Stock & catalogue',
    title: 'Categories & custom fields',
    summary: 'Define body-type categories and the fields shown for each one.',
    keywords: ['category', 'categories', 'body type', 'custom field', 'field', 'schema', 'filter', 'tractor', 'tipper'],
    blocks: [
      p('Categories (e.g. Tractor Units, Tippers, Curtainsiders) are fully admin-editable — there is no fixed list baked into the code. Each category can define its own set of extra fields, so a tipper can ask for "tipping mechanism" while a tractor unit asks for "sleeper cab height", without one form trying to cover every vehicle type.'),
      steps(
        'Go to Makes & categories.',
        'Add a category, or open an existing one and choose Fields.',
        'Add a field: give it a label, pick a type (text, number, yes/no, single-select, multi-select), and decide whether it\'s required.',
        'Choose whether the field should show on the vehicle\'s public specification table, and whether it should appear as a filter on the storefront stock list.',
      ),
      note('info', 'Fields marked "show in filters" automatically appear as a filter group on the public /trucks page — this is exactly how the Body Type and Make sidebar filters are populated.'),
      note('warning', 'Renaming a field\'s key migrates the value already stored on every vehicle in that category to the new key automatically. Deleting a field removes its stored value from every vehicle in that category — this cannot be undone.'),
      p('Only Manager role and above can manage categories and fields; Sales executives can use the fields on the vehicle form but not redefine them.'),
    ],
  },
  {
    slug: 'makes',
    section: 'Stock & catalogue',
    title: 'Managing makes (manufacturers)',
    summary: 'Add or edit the list of manufacturers vehicles can be listed under.',
    keywords: ['make', 'manufacturer', 'daf', 'scania', 'volvo'],
    blocks: [
      p('Makes are managed from the same Makes & categories page as categories. Add a make once and it becomes selectable on every vehicle form afterwards, and appears as a filter on the storefront.'),
    ],
  },
  {
    slug: 'demo-data-toggle',
    section: 'Stock & catalogue',
    title: 'Example (demo) data toggle',
    summary: 'Show or remove the seeded example vehicles, enquiries and testimonials.',
    keywords: ['demo', 'example', 'sample', 'seed', 'test data', 'clean', 'toggle'],
    blocks: [
      p('Settings has a toggle for example data — a set of realistic sample vehicles, enquiries and testimonials generated so the storefront and CRM don\'t look empty while you\'re building the site out.'),
      steps(
        'Go to Settings.',
        'Find the example data toggle.',
        'Turn it off to remove every example vehicle, enquiry and testimonial in one action.',
      ),
      note('info', 'Turning it back on regenerates a fresh batch — it never touches anything created manually. This is the fastest way to get a clean, empty-looking site before it goes live: turn the toggle off and only your real listings remain.'),
    ],
  },
  {
    slug: 'bulk-import-export',
    section: 'Stock & catalogue',
    title: 'Bulk import & export',
    summary: 'Current status: not built yet — vehicles are added one at a time.',
    keywords: ['import', 'export', 'csv', 'bulk', 'spreadsheet'],
    blocks: [
      note('warning', 'There is no bulk CSV/spreadsheet import or export tool yet. Every vehicle is currently added individually through Add vehicle. This is a known gap, not a hidden feature — if you need this, it should be scoped and built as its own task.'),
    ],
  },

  // ------------------------------------------------------------- Pricing & currency
  {
    slug: 'currencies',
    section: 'Pricing & currency',
    title: 'Currencies & exchange rates',
    summary: 'Manage which currencies customers can browse in, and their rates.',
    keywords: ['currency', 'exchange rate', 'fx', 'gbp', 'eur', 'usd', 'convert'],
    blocks: [
      p('Every price is stored in the base currency (GBP by default). Currencies lets you add the currencies customers can switch the storefront to, each with a rate back to the base currency.'),
      steps(
        'Go to Currencies.',
        'Add a currency, or edit an existing one\'s rate, symbol or rounding.',
        'Mark a currency inactive to hide it from the storefront\'s currency switcher without losing its configured rate.',
      ),
      note('info', 'If FX_API_URL and FX_API_KEY are configured, rates can refresh automatically via the housekeeping job instead of needing manual updates. Without that, edit rates here whenever they need updating.'),
      p('Requires Manager role or above.'),
    ],
  },
  {
    slug: 'pricing-vat',
    section: 'Pricing & currency',
    title: 'Setting a vehicle\'s price & VAT treatment',
    summary: 'How price and VAT treatment fields work on a vehicle.',
    keywords: ['price', 'vat', 'margin scheme', 'qualifying'],
    blocks: [
      p('A vehicle\'s price is entered in the base currency and stored as an exact integer (pence), so there\'s never a rounding surprise. The storefront converts it to the customer\'s chosen display currency automatically using the current rate.'),
      p('VAT treatment on the vehicle form controls how VAT is shown and calculated at checkout for that specific vehicle — set it correctly for margin-scheme vs VAT-qualifying stock.'),
    ],
  },
  {
    slug: 'discounts',
    section: 'Pricing & currency',
    title: 'Discounts',
    summary: 'Create discount codes or automatic promotions.',
    keywords: ['discount', 'coupon', 'code', 'promotion', 'sale'],
    blocks: [
      p('Discounts lets Manager-and-above staff create and manage promotional pricing. Open the page for the current set of discount types and their rules.'),
    ],
  },

  // ------------------------------------------------------------- Sales & CRM
  {
    slug: 'enquiries',
    section: 'Sales & CRM',
    title: 'Enquiries (leads)',
    summary: 'Where every customer enquiry lands, how it\'s scored, and how it\'s assigned.',
    keywords: ['enquiry', 'lead', 'crm', 'contact', 'whatsapp', 'score', 'assign'],
    blocks: [
      p('Every enquiry — from a vehicle page, the contact form, part-exchange, a finance application, or a WhatsApp click — creates a lead here, tagged with its source.'),
      p('Contact details: a WhatsApp/phone number is mandatory on every lead so there is always a working way to reach the person; email is optional. This is a deliberate business decision, not a bug — someone can enquire with just a name and phone number.'),
      h3('Lead scoring'),
      p('Each lead gets an automatic 0–100 score based on transparent signals: whether an email was given, whether a company name was given, whether a specific vehicle is attached, message length, estimated value, and the enquiry source. It\'s meant to help you triage, not as a hard rule.'),
      h3('Assignment'),
      p('New leads are assigned round-robin to the active Sales/Manager staff member with the fewest open leads, so work stays roughly balanced without anyone having to manage a rota.'),
      p('Open a lead to see its full detail, message, related enquiries from the same contact, and to log activities/notes, change its status, or reassign it.'),
    ],
  },
  {
    slug: 'whatsapp-enquiries',
    section: 'Sales & CRM',
    title: 'WhatsApp enquiries',
    summary: 'How WhatsApp contact works today, and what isn\'t built yet.',
    keywords: ['whatsapp', 'message', 'contact', 'wa.me'],
    blocks: [
      p('Every lead\'s WhatsApp/phone number is shown on the enquiry detail page with a "Message →" link that opens a pre-filled WhatsApp chat directly to that customer\'s number — no need to save the number to your phone first. The same link is included in the email notification sent when a new enquiry comes in.'),
      note(
        'warning',
        'There is currently no direct "Message us on WhatsApp" button on the public-facing vehicle pages for customers to click — customers reach you via the enquiry form (which asks for a WhatsApp number), and staff then message them back via the link above. A dedicated outbound WhatsApp button on the storefront is a known gap, not yet built.',
      ),
    ],
  },
  {
    slug: 'pipeline',
    section: 'Sales & CRM',
    title: 'The sales pipeline board',
    summary: 'Kanban view of open enquiries by stage — drag to update.',
    keywords: ['pipeline', 'kanban', 'board', 'drag', 'stage', 'won', 'lost'],
    blocks: [
      p('Pipeline shows every open enquiry as a card in its stage column (New, Contacted, Qualified, Quoted, Negotiation), weighted by the value of the vehicle each buyer is interested in.'),
      note('info', 'On desktop, drag a card into a different column to change its stage — the change saves immediately. This doesn\'t work on touch devices (phones/tablets); use the enquiry\'s own page there instead to change its status.'),
      p('Won and lost enquiries aren\'t shown on the board — see the list view (Enquiries) for the complete history including those.'),
    ],
  },
  {
    slug: 'orders',
    section: 'Sales & CRM',
    title: 'Orders',
    summary: 'Reservation and purchase orders, and how payment is confirmed.',
    keywords: ['order', 'payment', 'stripe', 'reservation', 'deposit', 'refund'],
    blocks: [
      p('An order is created when a customer reserves or purchases a vehicle. Its status reflects where it is in that process.'),
      note(
        'warning',
        'Payment is only ever confirmed by Stripe\'s webhook, never by the customer\'s browser returning from checkout — so a customer closing the tab mid-payment still ends up with a correct order status once Stripe reports it. If STRIPE_WEBHOOK_SECRET isn\'t configured, webhooks are rejected and orders will never be marked paid, even if the payment succeeded in Stripe\'s dashboard.',
      ),
      p('Refunds require Manager role or above.'),
    ],
  },
  {
    slug: 'finance-enquiries',
    section: 'Sales & CRM',
    title: 'Finance enquiries',
    summary: 'Applications from the finance calculator on the storefront.',
    keywords: ['finance', 'apr', 'deposit', 'hire purchase', 'application'],
    blocks: [
      p('Customers can request finance on a vehicle using the storefront finance calculator; each request creates both a finance application record and a linked lead, so it shows up in both places.'),
      note('info', 'Unlike a general enquiry, a finance application requires both a phone number and an email address — the extra detail is needed to actually process a finance application.'),
    ],
  },
  {
    slug: 'customers',
    section: 'Sales & CRM',
    title: 'Customers',
    summary: 'Registered customer accounts and their order/enquiry history.',
    keywords: ['customer', 'account', 'buyer'],
    blocks: [
      p('The Customers list shows every registered customer account (not guest enquirers). Open one to see their orders, saved vehicles and enquiries in one place.'),
    ],
  },

  // ------------------------------------------------------------- Users & security
  {
    slug: 'staff-accounts',
    section: 'Users & security',
    title: 'Managing staff accounts & roles',
    summary: 'Create, invite, promote, suspend or remove staff.',
    keywords: ['staff', 'user', 'invite', 'promote', 'suspend', 'delete account'],
    blocks: [
      steps(
        'Go to Users & roles (Administrator role required).',
        'Add staff account — either set a password directly, or leave it blank to email the new person an invitation to set their own.',
        'Choose their role. You can only grant a role at or below your own.',
        'To change a role or suspend/reinstate someone later, use Manage on their row.',
      ),
      note('warning', 'You cannot change your own role or suspend your own account — this prevents accidental lock-outs. Ask another Administrator/Owner to do it instead.'),
      p('Deleting an account (Owner role only) anonymises their personal data but keeps order history intact for accounting purposes.'),
    ],
  },
  {
    slug: 'mfa',
    section: 'Users & security',
    title: 'Two-factor login (email MFA)',
    summary: 'Require a one-time email code as a second login factor, per account.',
    keywords: ['mfa', 'otp', '2fa', 'two-factor', 'security', 'code', 'login'],
    blocks: [
      p('Any staff account can be required to enter a 6-digit code sent to their email as a second factor, in addition to their password.'),
      steps(
        'Go to Users & roles.',
        'Open Manage on the account.',
        'Click "Require MFA" to turn it on, or "Turn off MFA" to turn it off.',
      ),
      p('Once enabled, that account is prompted for a 6-digit emailed code every time they sign in with the correct password. The code expires after 10 minutes and can be resent from the sign-in screen.'),
      note('info', 'MFA is off by default for every account, including the seeded sales@ukaf.co.uk account — it\'s left off there deliberately since that account exists purely for local development convenience.'),
      note('warning', 'MFA codes are delivered by email, so it depends on Resend being configured. If email isn\'t configured, the code is only visible in the server console — fine for local development, not for anyone actually relying on it.'),
    ],
  },
  {
    slug: 'audit-log',
    section: 'Users & security',
    title: 'Audit log',
    summary: 'The append-only record of privileged actions.',
    keywords: ['audit', 'log', 'history', 'who did what'],
    blocks: [
      p('Every privileged action — stock changes, pricing, user management, order status changes, settings — is written to the audit log with who did it and when. It\'s append-only; nothing here can be edited or deleted from the app.'),
    ],
  },

  // ------------------------------------------------------------- Site content & configuration
  {
    slug: 'legal-pages',
    section: 'Site content & configuration',
    title: 'Legal pages',
    summary: 'Edit the terms, privacy, cookies and returns pages.',
    keywords: ['legal', 'terms', 'privacy', 'cookies', 'policy'],
    blocks: [
      p('Legal pages lets Administrator-and-above staff edit the content shown at /legal/terms, /legal/privacy, /legal/cookies and /legal/returns without touching code.'),
    ],
  },
  {
    slug: 'site-settings',
    section: 'Site content & configuration',
    title: 'Site settings',
    summary: 'Company info, checkout behaviour, and the maintenance/demo-data toggles.',
    keywords: ['settings', 'site name', 'tagline', 'opening hours', 'checkout', 'guest checkout'],
    blocks: [
      p('Settings covers site identity (name, tagline, contact details, opening hours), the default reservation fee, default VAT rate, the finance calculator\'s representative APR, and whether guest checkout / full online purchase are enabled.'),
      p('It also shows a live checklist of which integrations (Stripe, Resend) are actually configured, so a missing API key is obvious rather than a silent failure.'),
    ],
  },
  {
    slug: 'maintenance-mode',
    section: 'Site content & configuration',
    title: 'Maintenance mode',
    summary: 'Take the public storefront offline temporarily without touching /admin.',
    keywords: ['maintenance', 'offline', '503', 'down for maintenance'],
    blocks: [
      p('Turning on Maintenance mode in Settings shows a "back shortly" page to every visitor on the storefront, account area and checkout, while /admin and /login keep working normally so staff can sign in and turn it back off.'),
      note('info', 'It can take up to about 10 seconds to take effect or clear after toggling, since the check is cached briefly rather than hitting the database on every single page request.'),
    ],
  },

  // ------------------------------------------------------------- Integrations
  {
    slug: 'stripe',
    section: 'Integrations',
    title: 'Stripe payments',
    summary: 'What\'s required for online payment to work.',
    keywords: ['stripe', 'payment', 'checkout', 'webhook secret'],
    blocks: [
      p('Set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_WEBHOOK_SECRET in the environment. Without the secret key, the site falls back to "enquire" instead of "reserve/buy" — it never breaks, it just degrades.'),
      note('danger', 'Without STRIPE_WEBHOOK_SECRET specifically, orders are never marked as paid, even if a customer\'s card was actually charged in Stripe — this is the one integration that fails silently in a way that matters. Check Settings\' integration checklist to confirm it\'s set.'),
    ],
  },
  {
    slug: 'resend-email',
    section: 'Integrations',
    title: 'Resend (transactional email)',
    summary: 'What\'s required for real emails to send.',
    keywords: ['resend', 'email', 'smtp', 'notification'],
    blocks: [
      p('Set RESEND_API_KEY and EMAIL_FROM in the environment. Without it, every email the app would have sent is logged to the server console instead of actually sending — useful for local development, not for anything real.'),
      p('SALES_NOTIFICATION_EMAILS controls where internal new-enquiry/new-order notifications go — it can be a comma-separated list.'),
    ],
  },
];

export function searchDocs(query: string): DocArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return ADMIN_DOCS;

  return ADMIN_DOCS.filter((article) => {
    const haystack = [
      article.title,
      article.summary,
      article.section,
      ...article.keywords,
      ...article.blocks.flatMap((block) => {
        if (block.type === 'ul' || block.type === 'steps') return block.items;
        return [block.text];
      }),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const DOC_SECTIONS = Array.from(new Set(ADMIN_DOCS.map((article) => article.section)));
