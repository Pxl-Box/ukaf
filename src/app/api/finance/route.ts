import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok, parseJson } from '@/lib/api';
import { financeApplicationSchema } from '@/lib/validation';
import { generateReference } from '@/lib/tokens';
import { monthlyPayment } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { createLead, LEAD_SOURCE_LABELS } from '@/lib/leads';
import { sendEnquiryAcknowledgement, sendInternalLeadNotification } from '@/lib/email';
import { recordAudit } from '@/lib/audit';

/**
 * Finance enquiry. This is a broker enquiry, not a credit application: no
 * credit search is performed here and no decision is given. It creates a CRM
 * lead alongside the application record so sales can follow it up.
 */
export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  const blocked = await guard(request, { limit: 'enquiry', identifier: ip });
  if (blocked) return blocked;

  const input = await parseJson(request, financeApplicationSchema);

  if (input.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  if (input.depositNet >= input.vehiclePriceNet) {
    return fail('Your deposit cannot be more than the vehicle price.', 422, {
      fieldErrors: { depositNet: ['Deposit must be less than the vehicle price.'] },
    });
  }

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  let truck: { id: string; title: string } | null = null;
  if (input.truckId) {
    truck = await prisma.truck.findFirst({
      where: { id: input.truckId, publishedAt: { not: null } },
      select: { id: true, title: true },
    });
  }

  const financed = input.vehiclePriceNet - input.depositNet;
  const estimatedMonthly = monthlyPayment(
    financed,
    settings.financeApr,
    input.termMonths,
    input.balloonNet ?? 0,
  );

  const application = await prisma.financeApplication.create({
    data: {
      ref: generateReference('FIN', 6),
      userId: user?.id ?? null,
      truckId: truck?.id ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      yearsTrading: input.yearsTrading ?? null,
      vehiclePriceNet: input.vehiclePriceNet,
      depositNet: input.depositNet,
      termMonths: input.termMonths,
      balloonNet: input.balloonNet ?? null,
      estimatedMonthly,
      notes: input.notes || null,
    },
    select: { id: true, ref: true },
  });

  const lead = await createLead({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone || null,
    company: input.company || null,
    subject: `Finance enquiry ${application.ref}`,
    message:
      `Finance enquiry over ${input.termMonths} months.\n` +
      `Vehicle: ${truck?.title ?? 'Not specified'}\n` +
      `Price: ${(input.vehiclePriceNet / 100).toFixed(2)}\n` +
      `Deposit: ${(input.depositNet / 100).toFixed(2)}\n` +
      (input.notes ? `\nNotes: ${input.notes}` : ''),
    truckId: truck?.id ?? null,
    userId: user?.id ?? null,
    source: 'FINANCE_APPLICATION',
    estimatedValue: input.vehiclePriceNet,
    ipAddress: ip,
  });

  await Promise.allSettled([
    sendEnquiryAcknowledgement(input.email, input.firstName, application.ref, truck?.title),
    sendInternalLeadNotification({
      ref: application.ref,
      name: `${input.firstName} ${input.lastName}`,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      message: `Finance: ${input.termMonths} months, deposit ${(input.depositNet / 100).toFixed(2)}, est. ${(estimatedMonthly / 100).toFixed(2)}/month`,
      vehicleTitle: truck?.title ?? null,
      sourceLabel: LEAD_SOURCE_LABELS.FINANCE_APPLICATION,
    }),
  ]);

  await recordAudit({
    action: 'lead.created',
    actor: user ? { id: user.id, email: user.email } : null,
    entity: 'FinanceApplication',
    entityId: application.id,
    summary: `Finance enquiry ${application.ref}`,
    metadata: { leadId: lead.id, termMonths: input.termMonths },
  });

  return ok({
    submitted: true,
    reference: application.ref,
    estimatedMonthly,
    message: 'Thanks — a finance specialist will call you to talk through the options.',
  });
});
