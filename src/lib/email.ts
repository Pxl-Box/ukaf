import { Resend } from 'resend';
import { prisma } from './db';
import { env, isProduction } from './env';
import { escapeHtml } from './utils';
import { sanitisePhoneForWhatsApp } from './whatsapp';

/**
 * Transactional email via Resend.
 *
 * Sending never throws into the caller: a failed welcome email must not roll
 * back a successful registration. Every attempt is written to `email_logs` so
 * failures are visible in the admin area.
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.resend.enabled) return null;
  if (!client) client = new Resend(env.resend.apiKey);
  return client;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  template: string;
  replyTo?: string;
};

export type SendEmailResult = { sent: boolean; id?: string; error?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const primary = recipients[0] ?? 'unknown';

  const resend = getClient();

  if (!resend) {
    // Development / unconfigured: log instead of dropping silently.
    if (!isProduction) {
      console.info(`\n[email:${input.template}] -> ${recipients.join(', ')}\n  ${input.subject}`);
      console.info(`  ${(input.text ?? stripTags(input.html)).slice(0, 500)}\n`);
    }
    await logEmail(primary, input.subject, input.template, 'FAILED', null, 'Resend not configured');
    return { sent: false, error: 'Email is not configured.' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.resend.from,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripTags(input.html),
      replyTo: input.replyTo ?? env.resend.replyTo,
    });

    if (error) {
      await logEmail(primary, input.subject, input.template, 'FAILED', null, error.message);
      console.error('[email] Resend rejected the message:', error);
      return { sent: false, error: error.message };
    }

    await logEmail(primary, input.subject, input.template, 'SENT', data?.id ?? null);
    return { sent: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    await logEmail(primary, input.subject, input.template, 'FAILED', null, message);
    console.error('[email] Failed to send:', error);
    return { sent: false, error: message };
  }
}

async function logEmail(
  to: string,
  subject: string,
  template: string,
  status: 'SENT' | 'FAILED' | 'QUEUED',
  providerId: string | null = null,
  error?: string,
): Promise<void> {
  await prisma.emailLog
    .create({ data: { to, subject, template, status, providerId, error } })
    .catch(() => undefined);
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Notifies the internal sales inbox, if one is configured. */
export async function notifySales(input: Omit<SendEmailInput, 'to'>): Promise<SendEmailResult> {
  if (env.resend.salesInbox.length === 0) {
    return { sent: false, error: 'No sales inbox configured.' };
  }
  return sendEmail({ ...input, to: env.resend.salesInbox });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type LayoutOptions = {
  heading: string;
  preheader?: string;
  body: string;
  cta?: { label: string; url: string };
  footerNote?: string;
};

/**
 * Table-based layout with inline styles — the only thing that renders reliably
 * across Outlook, Gmail and Apple Mail.
 */
export function emailLayout({ heading, preheader, body, cta, footerNote }: LayoutOptions): string {
  const site = env.siteUrl;
  const company = env.company;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#21262f;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.1);">
      <tr>
        <td style="background:#142257;padding:24px 32px;">
          <a href="${site}" style="color:#ffffff;text-decoration:none;font-size:22px;font-weight:700;letter-spacing:.02em;">UKAF<span style="color:#f5a30b;">.</span></a>
          <div style="color:#8ec3ff;font-size:12px;margin-top:4px;letter-spacing:.08em;text-transform:uppercase;">Commercial Vehicle Sales</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#142257;">${escapeHtml(heading)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#414d63;">${body}</div>
          ${
            cta
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                   <tr><td style="background:#1b5cf5;border-radius:8px;">
                     <a href="${cta.url}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(cta.label)}</a>
                   </td></tr>
                 </table>
                 <p style="font-size:12px;color:#647694;margin:12px 0 0;word-break:break-all;">If the button does not work, paste this link into your browser:<br>${cta.url}</p>`
              : ''
          }
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 28px;border-top:1px solid #eceef2;font-size:12px;color:#647694;line-height:1.6;">
          ${footerNote ? `<p style="margin:0 0 12px;">${footerNote}</p>` : ''}
          <p style="margin:0 0 8px;"><strong>${escapeHtml(company.name)}</strong>${company.address ? ` &middot; ${escapeHtml(company.address)}` : ''}</p>
          <p style="margin:0 0 8px;">
            ${company.number ? `Company no. ${escapeHtml(company.number)} &middot; ` : ''}
            ${company.vat ? `VAT no. ${escapeHtml(company.vat)}` : ''}
          </p>
          <p style="margin:0;">
            <a href="${site}/legal/privacy" style="color:#1b5cf5;text-decoration:none;">Privacy</a> &middot;
            <a href="${site}/legal/terms" style="color:#1b5cf5;text-decoration:none;">Terms</a> &middot;
            <a href="${site}/legal/cookies" style="color:#1b5cf5;text-decoration:none;">Cookies</a>
          </p>
        </td>
      </tr>
    </table>
    <p style="max-width:600px;margin:16px auto 0;font-size:11px;color:#8494ae;text-align:center;">
      You are receiving this email because you have an account or made an enquiry with ${escapeHtml(company.name)}.
    </p>
  </td></tr>
</table>
</body>
</html>`;
}

const p = (text: string) => `<p style="margin:0 0 14px;">${text}</p>`;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(to: string, firstName: string, token: string) {
  const url = `${env.siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    template: 'verify-email',
    subject: 'Confirm your UKAF account',
    html: emailLayout({
      heading: `Welcome, ${escapeHtml(firstName)}`,
      preheader: 'Confirm your email address to activate your UKAF account.',
      body:
        p('Thanks for creating an account with UKAF Commercials.') +
        p('Please confirm your email address to activate your account, save vehicles and track enquiries.'),
      cta: { label: 'Confirm email address', url },
      footerNote: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    }),
  });
}

export async function sendMfaOtpEmail(to: string, firstName: string, code: string) {
  return sendEmail({
    to,
    template: 'mfa-otp',
    subject: `${code} is your UKAF sign-in code`,
    html: emailLayout({
      heading: 'Your sign-in code',
      preheader: `Your one-time code is ${code}.`,
      body:
        p(`Hi ${escapeHtml(firstName)},`) +
        p('Enter this code to finish signing in to your UKAF admin account:') +
        `<p style="margin:0 0 14px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">${escapeHtml(code)}</p>` +
        p('This code expires in 10 minutes and can only be used once.'),
      footerNote: 'If you did not try to sign in, you can ignore this email — your account is still secure.',
    }),
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string) {
  const url = `${env.siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    template: 'password-reset',
    subject: 'Reset your UKAF password',
    html: emailLayout({
      heading: 'Reset your password',
      preheader: 'A password reset was requested for your UKAF account.',
      body:
        p(`Hi ${escapeHtml(firstName)},`) +
        p('We received a request to reset the password on your UKAF account. Choose a new password using the button below.'),
      cta: { label: 'Choose a new password', url },
      footerNote:
        'This link expires in 60 minutes and can only be used once. If you did not request a reset, no action is needed — your password has not changed.',
    }),
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string) {
  return sendEmail({
    to,
    template: 'password-changed',
    subject: 'Your UKAF password was changed',
    html: emailLayout({
      heading: 'Your password was changed',
      body:
        p(`Hi ${escapeHtml(firstName)},`) +
        p('The password on your UKAF account has just been changed and all other sessions have been signed out.') +
        p('If this was not you, reset your password immediately and contact us.'),
      cta: { label: 'Reset password', url: `${env.siteUrl}/forgot-password` },
    }),
  });
}

export async function sendStaffInviteEmail(to: string, firstName: string, token: string, roleLabel: string) {
  const url = `${env.siteUrl}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
  return sendEmail({
    to,
    template: 'staff-invite',
    subject: 'Your UKAF staff account',
    html: emailLayout({
      heading: 'You have been given access to UKAF',
      body:
        p(`Hi ${escapeHtml(firstName)},`) +
        p(`An administrator has created a <strong>${escapeHtml(roleLabel)}</strong> account for you on the UKAF platform.`) +
        p('Set a password to activate your account.'),
      cta: { label: 'Set your password', url },
      footerNote: 'This link expires in 7 days.',
    }),
  });
}

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  purchaseType: 'RESERVATION' | 'FULL_PURCHASE';
  totalFormatted: string;
  items: Array<{ name: string; priceFormatted: string; stockNumber?: string }>;
};

export async function sendOrderConfirmationEmail(to: string, order: OrderEmailData) {
  const isReservation = order.purchaseType === 'RESERVATION';
  const rows = order.items
    .map(
      (item) =>
        `<tr>
           <td style="padding:10px 0;border-bottom:1px solid #eceef2;">
             <strong style="color:#21262f;">${escapeHtml(item.name)}</strong>
             ${item.stockNumber ? `<br><span style="font-size:12px;color:#647694;">Stock no. ${escapeHtml(item.stockNumber)}</span>` : ''}
           </td>
           <td style="padding:10px 0;border-bottom:1px solid #eceef2;text-align:right;white-space:nowrap;">${escapeHtml(item.priceFormatted)}</td>
         </tr>`,
    )
    .join('');

  return sendEmail({
    to,
    template: 'order-confirmation',
    subject: `${isReservation ? 'Reservation' : 'Order'} confirmed — ${order.orderNumber}`,
    html: emailLayout({
      heading: isReservation ? 'Your vehicle is reserved' : 'Thank you for your order',
      preheader: `${order.orderNumber} confirmed.`,
      body:
        p(`Hi ${escapeHtml(order.customerName)},`) +
        p(
          isReservation
            ? 'We have received your reservation deposit and taken the vehicle off sale. A member of our sales team will be in touch within one working day to arrange inspection, payment of the balance and collection or delivery.'
            : 'We have received your payment in full. A member of our sales team will be in touch within one working day to arrange documentation and handover.',
        ) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;font-size:14px;">
           <tr><td colspan="2" style="padding-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#647694;">Order ${escapeHtml(order.orderNumber)}</td></tr>
           ${rows}
           <tr>
             <td style="padding:14px 0 0;font-weight:700;">Total paid</td>
             <td style="padding:14px 0 0;text-align:right;font-weight:700;">${escapeHtml(order.totalFormatted)}</td>
           </tr>
         </table>` +
        (isReservation
          ? p(
              '<strong>Please note:</strong> the reservation deposit secures the vehicle for 7 days and is deducted from the final balance. Refund terms are set out in our terms and conditions.',
            )
          : ''),
      cta: { label: 'View your order', url: `${env.siteUrl}/account/orders` },
    }),
  });
}

export async function sendEnquiryAcknowledgement(
  to: string,
  firstName: string,
  reference: string,
  vehicleTitle?: string,
) {
  return sendEmail({
    to,
    template: 'enquiry-ack',
    subject: `We have your enquiry (${reference})`,
    html: emailLayout({
      heading: 'Thanks for getting in touch',
      body:
        p(`Hi ${escapeHtml(firstName)},`) +
        p(
          vehicleTitle
            ? `We have received your enquiry about the <strong>${escapeHtml(vehicleTitle)}</strong> and a member of our sales team will respond within one working day.`
            : 'We have received your enquiry and a member of our team will respond within one working day.',
        ) +
        p(`Your reference is <strong>${escapeHtml(reference)}</strong> — please quote it if you need to contact us.`) +
        p('If your enquiry is urgent, call us on ' + escapeHtml(env.company.phone || 'our main line') + '.'),
      cta: { label: 'Browse our stock', url: `${env.siteUrl}/trucks` },
    }),
  });
}

export async function sendInternalLeadNotification(lead: {
  ref: string;
  name: string;
  /** Mandatory contact route — every lead has one, unlike email. */
  phone: string;
  email?: string | null;
  company?: string | null;
  message?: string | null;
  vehicleTitle?: string | null;
  sourceLabel: string;
}) {
  const whatsappLink = `https://wa.me/${sanitisePhoneForWhatsApp(lead.phone)}`;

  return notifySales({
    template: 'internal-lead',
    subject: `New ${lead.sourceLabel} — ${lead.name}${lead.vehicleTitle ? ` — ${lead.vehicleTitle}` : ''}`,
    replyTo: lead.email ?? undefined,
    html: emailLayout({
      heading: `New enquiry: ${escapeHtml(lead.ref)}`,
      body:
        `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;width:100%;">
           ${row('Name', lead.name)}
           ${row('WhatsApp', lead.phone)}
           ${lead.email ? row('Email', lead.email) : row('Email', 'Not provided')}
           ${lead.company ? row('Company', lead.company) : ''}
           ${lead.vehicleTitle ? row('Vehicle', lead.vehicleTitle) : ''}
           ${row('Source', lead.sourceLabel)}
         </table>
         <p style="margin:16px 0 0;">
           <a href="${whatsappLink}" style="color:#1b5cf5;font-weight:600;text-decoration:none;">Message them on WhatsApp →</a>
         </p>` +
        (lead.message
          ? `<div style="margin-top:18px;padding:14px 16px;background:#f6f7f9;border-radius:8px;border-left:3px solid #1b5cf5;white-space:pre-wrap;">${escapeHtml(lead.message)}</div>`
          : ''),
      cta: { label: 'Open in CRM', url: `${env.siteUrl}/admin/leads` },
    }),
  });
}

export async function sendInternalOrderNotification(order: {
  orderNumber: string;
  customerName: string;
  email: string;
  totalFormatted: string;
  purchaseType: string;
  items: string[];
}) {
  return notifySales({
    template: 'internal-order',
    subject: `New ${order.purchaseType === 'RESERVATION' ? 'reservation' : 'sale'} — ${order.totalFormatted} — ${order.orderNumber}`,
    replyTo: order.email,
    html: emailLayout({
      heading: `Payment received: ${escapeHtml(order.orderNumber)}`,
      body:
        `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;width:100%;">
           ${row('Customer', order.customerName)}
           ${row('Email', order.email)}
           ${row('Type', order.purchaseType === 'RESERVATION' ? 'Reservation deposit' : 'Full purchase')}
           ${row('Total', order.totalFormatted)}
           ${row('Vehicles', order.items.join(', '))}
         </table>`,
      cta: { label: 'Open order', url: `${env.siteUrl}/admin/orders` },
    }),
  });
}

export async function sendNewsletterConfirmation(to: string, token: string) {
  const url = `${env.siteUrl}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    template: 'newsletter-confirm',
    subject: 'Confirm your UKAF stock alerts',
    html: emailLayout({
      heading: 'One more step',
      body: p('Confirm your subscription to receive new stock alerts and offers from UKAF Commercials.'),
      cta: { label: 'Confirm subscription', url },
      footerNote: 'You can unsubscribe at any time using the link in any email we send.',
    }),
  });
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#647694;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#21262f;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}
