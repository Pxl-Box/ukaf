import type { LeadSource, Prisma } from '@prisma/client';
import { prisma } from './db';
import { generateReference } from './tokens';

/**
 * CRM helpers: lead creation, scoring, pipeline shaping.
 */

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'QUOTED',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

/** The stages rendered as pipeline columns — closed states sit outside it. */
export const PIPELINE_STAGES: LeadStatusValue[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'QUOTED',
  'NEGOTIATION',
];

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  QUOTED: 'Quoted',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE_ENQUIRY: 'Website enquiry',
  VEHICLE_ENQUIRY: 'Vehicle enquiry',
  WHATSAPP: 'WhatsApp enquiry',
  PHONE: 'Phone',
  EMAIL: 'Email',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  MARKETPLACE: 'Marketplace',
  PART_EXCHANGE: 'Part exchange',
  FINANCE_APPLICATION: 'Finance application',
  NEWSLETTER: 'Newsletter',
  IMPORT: 'Import',
};

/**
 * Simple, explainable lead score (0-100). Deliberately transparent rather than
 * clever so the sales team can trust and tune it.
 */
export function scoreLead(input: {
  email?: string | null;
  company?: string | null;
  truckId?: string | null;
  message?: string | null;
  estimatedValue?: number | null;
  source: LeadSource;
  isRegistered?: boolean;
}): number {
  let score = 10;

  // Phone/WhatsApp is mandatory on every lead now, so it's no longer a
  // useful signal — an email address is the differentiator instead.
  if (input.email) score += 15;
  if (input.company) score += 15;
  if (input.truckId) score += 20;
  if (input.isRegistered) score += 10;
  if (input.message && input.message.length > 120) score += 10;
  if (input.estimatedValue && input.estimatedValue > 50_000_00) score += 10;

  if (input.source === 'FINANCE_APPLICATION' || input.source === 'PART_EXCHANGE') score += 15;
  if (input.source === 'REFERRAL') score += 10;

  return Math.min(100, score);
}

export type CreateLeadInput = {
  firstName: string;
  lastName: string;
  /** Mandatory — every lead has a working contact route (WhatsApp/phone). */
  phone: string;
  email?: string | null;
  company?: string | null;
  country?: string | null;
  subject?: string | null;
  message?: string | null;
  truckId?: string | null;
  userId?: string | null;
  source: LeadSource;
  estimatedValue?: number | null;
  currencyCode?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  ipAddress?: string | null;
};

export async function createLead(input: CreateLeadInput) {
  const score = scoreLead({
    email: input.email,
    company: input.company,
    truckId: input.truckId,
    message: input.message,
    estimatedValue: input.estimatedValue,
    source: input.source,
    isRegistered: Boolean(input.userId),
  });

  // Round-robin the new lead onto the sales rep with the fewest open leads.
  const assignedToId = await pickAssignee();

  const lead = await prisma.lead.create({
    data: {
      ref: generateReference('ENQ', 6),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email || null,
      company: input.company || null,
      country: input.country || null,
      subject: input.subject || null,
      message: input.message || null,
      truckId: input.truckId || null,
      userId: input.userId || null,
      assignedToId,
      source: input.source,
      estimatedValue: input.estimatedValue ?? null,
      currencyCode: input.currencyCode ?? 'GBP',
      score,
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      ipAddress: input.ipAddress || null,
      nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    include: { truck: { select: { title: true, slug: true, stockNumber: true } } },
  });

  await prisma.activity
    .create({
      data: {
        leadId: lead.id,
        type: 'SYSTEM',
        subject: 'Enquiry received',
        body: `Lead created from ${LEAD_SOURCE_LABELS[input.source]}. Score ${score}/100.`,
      },
    })
    .catch(() => undefined);

  return lead;
}

/** Least-loaded active sales user, or null when no staff exist yet. */
async function pickAssignee(): Promise<string | null> {
  try {
    const staff = await prisma.user.findMany({
      where: { status: 'ACTIVE', role: { in: ['SALES', 'MANAGER'] } },
      select: {
        id: true,
        _count: { select: { assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } } } },
      },
    });
    if (staff.length === 0) return null;
    return staff.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads)[0].id;
  } catch {
    return null;
  }
}

export const LEAD_LIST_SELECT = {
  id: true,
  ref: true,
  status: true,
  source: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  company: true,
  subject: true,
  message: true,
  score: true,
  estimatedValue: true,
  currencyCode: true,
  nextActionAt: true,
  createdAt: true,
  updatedAt: true,
  truck: { select: { id: true, slug: true, title: true, stockNumber: true, priceNet: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { activities: true } },
} satisfies Prisma.LeadSelect;

export type LeadListItem = Prisma.LeadGetPayload<{ select: typeof LEAD_LIST_SELECT }>;

/** Pipeline data for the CRM board. */
export async function getPipeline() {
  const leads = await prisma.lead.findMany({
    where: { status: { in: PIPELINE_STAGES } },
    select: LEAD_LIST_SELECT,
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  });

  const columns = PIPELINE_STAGES.map((stage) => {
    const items = leads.filter((lead) => lead.status === stage);
    return {
      stage,
      label: LEAD_STATUS_LABELS[stage],
      items,
      count: items.length,
      value: items.reduce((sum, lead) => sum + (lead.estimatedValue ?? lead.truck?.priceNet ?? 0), 0),
    };
  });

  return columns;
}

export async function getCrmSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [total, open, won, lost, overdue, byStatus] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { status: { notIn: ['WON', 'LOST'] } } }),
    prisma.lead.count({ where: { status: 'WON', closedAt: { gte: since } } }),
    prisma.lead.count({ where: { status: 'LOST', closedAt: { gte: since } } }),
    prisma.lead.count({
      where: { status: { notIn: ['WON', 'LOST'] }, nextActionAt: { lt: new Date() } },
    }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const closed = won + lost;
  return {
    total,
    open,
    won,
    lost,
    overdue,
    conversionRate: closed === 0 ? 0 : Math.round((won / closed) * 100),
    byStatus: Object.fromEntries(byStatus.map((entry) => [entry.status, entry._count._all])),
  };
}
