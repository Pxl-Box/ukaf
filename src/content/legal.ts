import { env } from '@/lib/env';
import { POLICY_VERSION } from '@/lib/settings';

/**
 * Default legal copy.
 *
 * Written for a UK-based commercial vehicle dealer selling primarily to
 * businesses, with export sales. Staff can override any of it from
 * /admin/pages; these are the fallbacks.
 *
 * IMPORTANT: this is a carefully written starting point, not legal advice.
 * Have a solicitor review it against your actual trading practices before you
 * rely on it.
 */

const company = env.company.name;
const address = env.company.address || '[registered address]';
const companyNumber = env.company.number || '[company number]';
const vatNumber = env.company.vat || '[VAT number]';
const contactEmail = env.company.email;
const contactPhone = env.company.phone || '[telephone number]';

export type LegalDocument = {
  slug: string;
  title: string;
  excerpt: string;
  version: string;
  body: string;
};

/**
 * A deliberately small markup subset — `##` headings, `-` bullets, blank-line
 * paragraphs — rendered by `LegalContent`. Keeping it minimal means no HTML
 * from the database is ever injected into the page.
 */

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: 'Terms and conditions of sale',
  excerpt: 'The terms on which we sell vehicles, take reservation deposits and provide this website.',
  version: '1.0',
  body: `## 1. Who we are

This website is operated by ${company}, a company registered in England and Wales under company number ${companyNumber}, with its registered office at ${address}. Our VAT registration number is ${vatNumber}.

You can contact us by email at ${contactEmail} or by telephone on ${contactPhone}.

In these terms, "we", "us" and "our" mean ${company}; "you" and "your" mean the person or business buying from us.

## 2. These terms

These terms apply to every sale of a vehicle, part or service by us, and to your use of this website. By placing an order or paying a reservation deposit you agree to them.

Most of our customers are businesses. Where you are buying wholly or mainly for the purposes of your trade, business, craft or profession, you are a business customer and the consumer rights described in section 10 do not apply to you. If you are buying as a consumer, your statutory rights are unaffected by anything in these terms.

We may amend these terms from time to time. The version that applies to your purchase is the one published when you place your order; we record the version you accepted at checkout.

## 3. Vehicle descriptions

We describe our vehicles as accurately as we reasonably can. Photographs are of the actual vehicle unless clearly marked otherwise, but colours can appear differently on screen.

Specifications, mileages, weights, dimensions and emissions data are provided in good faith and are taken from the vehicle, its documentation or the manufacturer. Small discrepancies can occur. **We strongly recommend you inspect a vehicle, or arrange an independent inspection, before committing to buy.** If any particular feature or specification matters to your operation, ask us to confirm it in writing before you order.

Mileage is stated as displayed on the odometer and, where we say so, verified against service records and MOT history. We do not warrant mileage beyond that.

## 4. Prices and VAT

Unless stated otherwise, advertised prices exclude VAT. Every listing states its VAT treatment:

- **Plus VAT** — VAT is added at the prevailing rate.
- **VAT qualifying** — VAT is included in the advertised price and may be reclaimable by VAT-registered buyers, or removed for qualifying exports on production of satisfactory evidence.
- **Margin scheme** — sold under the VAT margin scheme for second-hand goods. No VAT invoice can be issued and no VAT is reclaimable.
- **No VAT** — no VAT is applicable.

Prices may be displayed in a currency other than pounds sterling for convenience. **Any converted figure is indicative only.** Unless we agree otherwise in writing, the contract price is the sterling price, and the amount taken at checkout is the amount shown in your chosen currency on the payment page. Your bank or card issuer may apply its own conversion or handling charges, which are outside our control.

We reserve the right to correct pricing errors. If a vehicle's price is obviously wrong and we have not yet accepted your order, we will contact you and give you the choice of paying the correct price or receiving a full refund.

## 5. Reservation deposits

Paying a reservation deposit online does not conclude a sale. It does the following:

- takes the vehicle off sale for **7 calendar days** from the date payment clears;
- is applied in full against the purchase price if you go on to buy;
- gives you the opportunity to inspect the vehicle and complete the paperwork.

A reservation deposit is refundable in the circumstances set out in our [cancellation and refunds policy](/legal/returns). If you have not completed the purchase or extended the reservation in writing before the 7-day period ends, the reservation lapses and the vehicle may be re-advertised.

## 6. Formation of the contract

Your order — whether a reservation or a purchase — is an offer to buy. A contract of sale only comes into existence when we confirm acceptance in writing (an order confirmation, an invoice, or a signed sales agreement). Automated payment receipts are not acceptance.

We may decline any order. Reasons include, but are not limited to: the vehicle having already been sold, a pricing or description error, our inability to verify your identity or payment, or export restrictions applying to your destination.

## 7. Payment

We accept card payments online through Stripe. We do not receive or store your full card details.

Card payments are subject to a maximum value; higher-value balances are settled by bank transfer to our published account details. **We will never notify you of a change to our bank details by email alone.** If you receive such a message, telephone us on ${contactPhone} using the number from this website before sending any funds.

Title in a vehicle does not pass to you until we have received cleared funds in full. Risk passes to you on collection or, where we deliver, on delivery.

## 8. Collection, delivery and export

Collection from our depot is free of charge and by appointment. Vehicles must be collected within 7 days of the balance clearing unless we agree storage in writing.

Delivery, where offered, is quoted separately and is an estimate of timing rather than a guaranteed date, unless we have expressly agreed a date in writing. We are not liable for losses caused by delivery delays outside our reasonable control.

For export sales, you are responsible for compliance with the requirements of the destination country, including registration, homologation and emissions rules. We will provide the documentation described in your order. Zero-rating of VAT on an export sale is conditional on us receiving satisfactory proof of export within the period required by HMRC; if we do not, you agree to pay the VAT that becomes due.

## 9. Warranty

Unless the listing says otherwise, used commercial vehicles are sold with any warranty stated on the listing or in your order confirmation. Where no warranty is stated, and you are a business customer, the vehicle is sold as seen and inspected.

Where a warranty is provided, its terms, duration and exclusions are set out in the warranty document supplied with the vehicle. Warranties do not cover wear and tear, consumables, damage from misuse, overloading, lack of maintenance, or modification.

Nothing in these terms excludes or limits our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be excluded.

## 10. Consumers

If you are buying as a consumer rather than for business purposes, you have statutory rights under the Consumer Rights Act 2015, including that goods must be of satisfactory quality, fit for purpose and as described.

Where you buy at a distance without visiting us, you may also have a 14-day right to cancel under the Consumer Contracts Regulations 2013. Our [cancellation and refunds policy](/legal/returns) explains how this works and its limits.

## 11. Business customers: limitation of liability

This section applies only where you are a business customer.

Subject to section 9, our total liability arising out of or in connection with a contract, whether in contract, tort (including negligence), breach of statutory duty or otherwise, is limited to the price paid for the vehicle.

We are not liable for loss of profit, loss of business, loss of contracts, loss of anticipated savings, loss of use, downtime, hire of replacement vehicles, or any indirect or consequential loss.

All warranties, conditions and other terms implied by statute or common law are, to the fullest extent permitted by law, excluded from the contract.

## 12. Your account

You are responsible for keeping your account credentials confidential and for all activity under your account. Tell us immediately if you believe your account has been accessed without your authority.

We may suspend or close an account that we reasonably believe has been used fraudulently, unlawfully, or in breach of these terms.

## 13. Use of this website

You may use this website for lawful purposes connected with buying, selling or enquiring about commercial vehicles. You must not:

- attempt to gain unauthorised access to any part of the site, its servers or databases;
- scrape, harvest or systematically extract listings or contact data;
- introduce malicious code, or attempt to disrupt or overload the service;
- use the site in a way that infringes anyone's rights or breaches any law.

All content on this site, including photographs, descriptions and branding, belongs to us or our licensors. You may not reproduce it commercially without our written permission.

## 14. Complaints

If something goes wrong, please contact us at ${contactEmail} or ${contactPhone} and we will try to resolve it promptly. Please quote your order or enquiry reference.

## 15. Governing law

These terms and any dispute arising from them are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.

_Version ${'1.0'} — last updated ${new Date().getFullYear()}._`,
};

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy policy',
  excerpt: 'What personal data we collect, why we collect it, and the rights you have over it.',
  version: POLICY_VERSION,
  body: `## Who is responsible for your data

${company} is the data controller for the personal data described in this policy. We are registered in England and Wales under company number ${companyNumber}, at ${address}.

For any privacy question, or to exercise the rights described below, email ${contactEmail} or write to us at the address above.

## What we collect and why

We only collect what we need. Here is everything, and the lawful basis we rely on under the UK GDPR:

**When you make an enquiry**
Name, email address, telephone number, company name, and the content of your message; the vehicle you enquired about; and marketing attribution parameters if you arrived from a campaign.
_Basis: legitimate interests — responding to a request you made of us._

**When you create an account**
Name, email address, password (stored only as a salted hash — we cannot read it), telephone number, company name and VAT number if you provide them, and your currency preference.
_Basis: performance of a contract, and legitimate interests in operating a secure service._

**When you reserve or buy a vehicle**
Billing name and address, delivery address if applicable, email address, telephone number, the vehicles ordered, amounts, currency and the exchange rate used, and the time you accepted our terms. Card details are handled entirely by Stripe — **we never see or store your card number.**
_Basis: performance of a contract, and legal obligation for tax and accounting records._

**When you apply for finance or a part-exchange valuation**
The details you submit about your business, the vehicle and the amounts involved.
_Basis: taking steps at your request prior to entering a contract._

**Security and fraud prevention**
IP address, browser user agent, sign-in times, and a record of failed sign-in attempts.
_Basis: legitimate interests — protecting accounts and preventing fraud._

**Cookie consent records**
Your choices, the policy version, your browser's user agent, and a one-way hash of your IP address. We store a hash rather than the address itself so we can evidence consent without holding an identifier we do not need.
_Basis: legal obligation under PECR to demonstrate consent._

**Marketing**
Your email address and subscription status, if you opt in.
_Basis: consent, which you may withdraw at any time._

## What we do not do

- We do not sell your personal data. Ever.
- We do not share your data with third parties for their own marketing.
- We do not use automated decision-making that produces legal effects for you.
- We do not collect special category data (health, biometrics, and so on).

## Who we share data with

We use a small number of carefully chosen processors, each bound by contract to act only on our instructions:

- **Stripe Payments Europe Ltd** — payment processing and fraud prevention. Stripe is a data controller in its own right for payment data; see Stripe's privacy policy.
- **Resend** — sending transactional email such as order confirmations and password resets.
- **Our hosting and database providers** — storing and serving the site.

We also disclose data where we are legally required to: to HMRC for tax records, to the DVLA where vehicle registration requires it, and to law enforcement on a valid request.

Where a provider processes data outside the UK, that transfer is covered by UK adequacy regulations or by International Data Transfer Agreements / Addenda to the EU Standard Contractual Clauses.

## How long we keep it

- **Enquiries that do not lead to a sale** — 24 months from the last contact, then deleted.
- **Customer and order records** — 7 years from the end of the relevant accounting period, because tax law requires it.
- **Account data** — while your account is open, and 12 months afterwards.
- **Sign-in and security logs** — 12 months.
- **Cookie consent records** — 24 months, so we can evidence consent.
- **Marketing subscriptions** — until you unsubscribe, plus a suppression record so we do not email you again by mistake.

## Your rights

Under the UK GDPR you have the right to:

- **be informed** — this policy;
- **access** a copy of the personal data we hold about you;
- **rectify** anything inaccurate;
- **erase** your data, where we have no overriding obligation to keep it (tax records, for example, we must keep);
- **restrict** or **object to** processing based on legitimate interests;
- **data portability** for data you gave us, in a machine-readable format;
- **withdraw consent** at any time, where consent is the basis — this does not affect processing before you withdrew it.

To exercise any of these, email ${contactEmail}. We will respond within one month. We will not charge you, and we will not ask you to justify the request.

You can also change most of your own data directly in your account, and update your cookie choices at any time from the link in our footer.

## Complaints

If you are unhappy with how we have handled your data, please tell us first — we would like the chance to put it right. You also have the right to complain to the Information Commissioner's Office:

- Website: ico.org.uk
- Helpline: 0303 123 1113

## Security

We take the protection of your data seriously. In practice that means: passwords stored using a memory-hard hashing function and never in readable form; session tokens stored only as keyed hashes, so a database leak cannot be replayed; HTTPS everywhere with HSTS; a strict content security policy; CSRF protection on every state-changing request; rate limiting and account lockout on repeated failed sign-ins; role-based access control for staff; and an append-only audit log of privileged actions.

No system is perfectly secure, but if a breach occurs that is likely to result in a risk to your rights and freedoms, we will notify the ICO within 72 hours and tell you without undue delay.

## Changes to this policy

We will update this page when our processing changes. The version is shown below. Where a change materially affects you, we will tell you directly.

_Version ${POLICY_VERSION} — last updated ${new Date().getFullYear()}._`,
};

export const COOKIES: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie policy',
  excerpt: 'Every cookie this site can set, what it does, and how to change your mind.',
  version: POLICY_VERSION,
  body: `## Our approach

We set only what is strictly necessary until you tell us otherwise. Nothing for analytics or marketing is set unless you have actively agreed to it, and declining is exactly as easy as accepting — there is no pre-ticked box and no dark pattern that hides the reject button.

You can change your choices at any time using the **Cookie preferences** link in the footer of every page.

## The legal bit

Strictly necessary cookies are exempt from the consent requirement under the Privacy and Electronic Communications Regulations (PECR), because the service you asked for cannot work without them. Everything else requires your consent, which we record along with the policy version so we can evidence what you agreed to.

## What each category does

**Strictly necessary** — always on. These keep you signed in, remember what is in your basket before you sign in, protect our forms against cross-site request forgery, and remember your cookie choices. Turning them off would break the site, so they cannot be disabled.

**Preferences** — remembers choices you make, such as the currency you want prices displayed in and the vehicles you added to the comparison tool. Declining simply means the site forgets these between visits.

**Analytics** — anonymous, aggregated statistics about which pages and vehicles people look at, so we can improve the site. Never used to identify you personally.

**Marketing** — lets us measure whether our advertising works and show relevant stock to people who have visited us before. Declining does not mean you will see no ads; it means they will be less relevant to you.

## Cookies we can set

The full, current list — including who sets each one and how long it lasts — is shown in the table on this page. It is generated from the same registry the site itself uses, so it cannot drift out of date.

## Third-party cookies

**Stripe** sets fraud-prevention cookies during payment. These are strictly necessary for taking a payment securely, and Stripe acts as a data controller for them. See stripe.com/privacy.

**Google Analytics** and advertising cookies are only ever set after you consent to the relevant category.

## Managing cookies in your browser

You can also block or delete cookies in your browser settings. Be aware that blocking strictly necessary cookies will stop you signing in or checking out. Instructions for each major browser are on the browser vendor's own help pages, and aboutcookies.org has a plain-English guide.

## Do Not Track and Global Privacy Control

We honour Global Privacy Control (GPC) signals where your browser sends them, treating them as an objection to non-essential cookies.

_Version ${POLICY_VERSION} — last updated ${new Date().getFullYear()}._`,
};

export const RETURNS: LegalDocument = {
  slug: 'returns',
  title: 'Cancellation and refunds',
  excerpt: 'When a reservation deposit is refundable, and what happens if you change your mind.',
  version: '1.0',
  body: `## Reservation deposits

A reservation deposit takes a vehicle off sale for 7 calendar days so you can inspect it and complete the paperwork without someone else buying it from under you.

**We refund your deposit in full if:**

- the vehicle turns out to be materially different from how we described it;
- we cannot make the vehicle available for inspection within the reservation period;
- we accept your order and then cannot complete the sale for any reason on our side;
- you cancel within 24 hours of paying the deposit and have not yet inspected the vehicle;
- you are a consumer exercising the 14-day right described below.

**We may retain the deposit if:**

- you decide not to proceed after inspecting the vehicle, more than 24 hours after paying;
- you do not complete the purchase within the reservation period and have not agreed an extension with us in writing.

Even then, we would rather have a conversation than keep your money on a technicality. If your circumstances have changed, call us — in practice we frequently transfer a deposit to another vehicle or refund it as a gesture of goodwill.

## Consumers: the 14-day right to cancel

If you are buying as a consumer (not for business purposes) and you bought at a distance without visiting our premises, the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 give you 14 days from the day you receive the vehicle to cancel, without giving a reason.

To cancel, tell us in writing at ${contactEmail} within that period. You do not need to use a special form, but you must make your decision clear.

You must then return the vehicle, or make it available for collection, within 14 days of telling us. **You bear the cost of return.** For a commercial vehicle this can be substantial, so please factor it in.

We will refund you within 14 days of getting the vehicle back, or of receiving proof you have sent it, whichever is sooner. We may reduce the refund to reflect any reduction in the vehicle's value caused by handling beyond what is necessary to establish its nature, characteristics and functioning — in practice, mileage covered and any new damage.

This right does not apply to goods made to your specification or clearly personalised.

## Business customers

If you are buying for business purposes, the 14-day right to cancel does not apply. Your rights are those set out in our [terms and conditions of sale](/legal/terms) and in any warranty supplied with the vehicle.

We would still rather resolve a problem than lose a customer, so please talk to us.

## If something is wrong with the vehicle

Contact us as soon as you notice. Tell us what the problem is, when you noticed it, and send photographs if that helps. Please do not authorise third-party repairs before speaking to us, as that can invalidate a warranty claim.

Where a warranty applies, we will handle the claim under that warranty. Where a vehicle is not as described, or is not of satisfactory quality and you are a consumer, we will repair, replace or refund in line with the Consumer Rights Act 2015.

## How refunds are made

Refunds go back to the original payment method, and cannot be sent anywhere else — that is a fraud-prevention rule, not an inconvenience we have invented. Card refunds usually appear within 5 to 10 working days depending on your bank; bank transfers are usually next working day.

Where you paid in a currency other than sterling, we refund the same amount in that currency. Because exchange rates move, the sterling value your bank credits may differ slightly from what you originally paid. That difference is outside our control and we cannot compensate for it.

## Contact us

Email ${contactEmail} or call ${contactPhone}. Please quote your order number.

_Version ${'1.0'} — last updated ${new Date().getFullYear()}._`,
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  cookies: COOKIES,
  returns: RETURNS,
};
