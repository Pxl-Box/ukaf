import { prisma } from './db';
import { getRequestContext, type SessionUser } from './auth';
import type { Prisma } from '@prisma/client';

/**
 * Append-only audit trail.
 *
 * Every privileged mutation (stock, pricing, users, orders, settings) writes a
 * row here. Logging must never break the operation it is describing, so all
 * failures are swallowed and reported to the server console only.
 */

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.mfa_challenge'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.password_changed'
  | 'auth.email_verified'
  | 'auth.sessions_revoked'
  | 'user.created'
  | 'user.updated'
  | 'user.role_changed'
  | 'user.suspended'
  | 'user.reinstated'
  | 'user.deleted'
  | 'truck.created'
  | 'truck.updated'
  | 'truck.deleted'
  | 'truck.status_changed'
  | 'truck.price_changed'
  | 'truck.image_added'
  | 'truck.image_deleted'
  | 'order.created'
  | 'order.updated'
  | 'order.status_changed'
  | 'order.refunded'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'lead.created'
  | 'lead.updated'
  | 'lead.assigned'
  | 'lead.status_changed'
  | 'lead.deleted'
  | 'currency.updated'
  | 'currency.rates_refreshed'
  | 'discount.created'
  | 'discount.updated'
  | 'settings.updated'
  | 'page.updated'
  | 'email.sent'
  | 'export.generated';

type AuditInput = {
  action: AuditAction;
  actor?: Pick<SessionUser, 'id' | 'email'> | null;
  entity?: string;
  entityId?: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  /** Provide when there is no request context (e.g. webhook, cron). */
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    let ipAddress = input.ipAddress ?? null;
    let userAgent = input.userAgent ?? null;

    if (ipAddress === null && userAgent === null) {
      try {
        const context = await getRequestContext();
        ipAddress = context.ipAddress;
        userAgent = context.userAgent;
      } catch {
        // Outside a request scope (cron/seed) — leave both null.
      }
    }

    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata,
        ipAddress,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error);
  }
}

/**
 * Produces a compact { field: [before, after] } diff for audit metadata,
 * ignoring unchanged values and never recording secrets.
 */
const REDACTED_FIELDS = new Set(['passwordHash', 'password', 'tokenHash', 'vin', 'registration']);

export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Prisma.InputJsonObject {
  const changes: Record<string, Array<Prisma.InputJsonValue | null>> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (REDACTED_FIELDS.has(key)) continue;

    const previous = normalise(before[key]);
    const next = normalise(after[key]);
    if (previous === next) continue;
    if (next === undefined) continue;

    changes[key] = [jsonSafe(before[key]), jsonSafe(after[key])];
  }

  return changes;
}

/** Coerces an arbitrary value into something Prisma will accept as JSON. */
function jsonSafe(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}
