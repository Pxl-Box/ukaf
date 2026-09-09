import { prisma } from '@/lib/db';
import { clientIp, fail, guard, handler, ok } from '@/lib/api';
import { enquirySchema, partExchangeSchema } from '@/lib/validation';
import { createLead, LEAD_SOURCE_LABELS } from '@/lib/leads';
import { sendEnquiryAcknowledgement, sendInternalLeadNotification } from '@/lib/email';
import { getCurrentUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import type { LeadSource } from '@prisma/client';

/**
 * Public enquiry endpoint. Handles both plain enquiries and part-exchange
 * submissions — the latter carries extra `px*` fields and creates a linked
 * PartExchange record.
 */
export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  const blocked = await guard(request, { limit: 'enquiry', identifier: ip });
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Request body must be valid JSON.', 400, { code: 'INVALID_JSON' });
  }

  const isPartExchange =
    typeof body === 'object' && body !== null && 'pxMake' in (body as Record<string, unknown>);

  // Parsed in separate branches so each shape keeps its own precise type.
  const partExchange = isPartExchange ? partExchangeSchema.parse(body) : null;
  const enquiry = partExchange ?? enquirySchema.parse(body);

  if (enquiry.website) {
    return fail('Your submission could not be processed.', 400, { code: 'SPAM_REJECTED' });
  }

  const user = await getCurrentUser();

  // Only accept a truckId that actually refers to publicly visible stock.
  let truck: { id: string; title: string; priceNet: number } | null = null;
  if (enquiry.truckId) {
    truck = await prisma.truck.findFirst({
      where: { id: enquiry.truckId, publishedAt: { not: null } },
      select: { id: true, title: true, priceNet: true },
    });
  }

  const source: LeadSource = partExchange
    ? 'PART_EXCHANGE'
    : truck
      ? 'VEHICLE_ENQUIRY'
      : (enquiry.source as LeadSource);

  const lead = await createLead({
    firstName: enquiry.firstName,
    lastName: enquiry.lastName,
    phone: enquiry.phone,
    email: enquiry.email || null,
    company: enquiry.company || null,
    country: enquiry.country || null,
    subject: enquiry.subject || (truck ? `Enquiry: ${truck.title}` : 'Website enquiry'),
    message: enquiry.message,
    truckId: truck?.id ?? null,
    userId: user?.id ?? null,
    source,
    estimatedValue: truck?.priceNet ?? null,
    utmSource: enquiry.utmSource || null,
    utmMedium: enquiry.utmMedium || null,
    utmCampaign: enquiry.utmCampaign || null,
    ipAddress: ip,
  });

  if (partExchange) {
    await prisma.partExchange
      .create({
        data: {
          leadId: lead.id,
          make: partExchange.pxMake,
          model: partExchange.pxModel,
          year: partExchange.pxYear ?? null,
          mileageKm: partExchange.pxMileageKm ?? null,
          registration: partExchange.pxRegistration || null,
          condition: partExchange.pxCondition || null,
        },
      })
      .catch(() => undefined);
  }

  // Notifications are best-effort — a mail outage must not lose the enquiry.
  // The acknowledgement email only sends when one was actually given.
  await Promise.allSettled([
    enquiry.email
      ? sendEnquiryAcknowledgement(enquiry.email, enquiry.firstName, lead.ref, truck?.title)
      : Promise.resolve(),
    sendInternalLeadNotification({
      ref: lead.ref,
      name: `${enquiry.firstName} ${enquiry.lastName}`,
      phone: enquiry.phone,
      email: enquiry.email || null,
      company: enquiry.company || null,
      message: enquiry.message,
      vehicleTitle: truck?.title ?? null,
      sourceLabel: LEAD_SOURCE_LABELS[source],
    }),
  ]);

  await recordAudit({
    action: 'lead.created',
    actor: user ? { id: user.id, email: user.email } : null,
    entity: 'Lead',
    entityId: lead.id,
    summary: `Enquiry ${lead.ref} from ${enquiry.phone}${enquiry.email ? ` (${enquiry.email})` : ''}`,
    metadata: { source, truckId: truck?.id ?? null },
  });

  return ok({
    submitted: true,
    reference: lead.ref,
    message: 'Thanks — we have your enquiry and will be in touch within one working day.',
  });
});
