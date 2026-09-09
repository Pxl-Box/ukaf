import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { adminCreateUserSchema, adminUpdateUserSchema } from '@/lib/validation';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { generateToken, hashToken } from '@/lib/tokens';
import { revokeAllSessions, ROLE_LABELS, hasRole } from '@/lib/auth';
import { sendStaffInviteEmail } from '@/lib/email';
import { diffRecords, recordAudit } from '@/lib/audit';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * User administration.
 *
 * Two rules protect against privilege escalation and lock-out:
 *   - nobody may grant a role above their own;
 *   - nobody may change their own role or suspend their own account.
 */

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const actor = await requireApiRole('ADMIN');
  if (isResponse(actor)) return actor;

  const input = await parseJson(request, adminCreateUserSchema);

  if (!hasRole(actor, input.role) && input.role !== 'CUSTOMER') {
    return fail('You cannot create a user with a role above your own.', 403, {
      code: 'ROLE_ESCALATION',
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    return fail('An account with that email address already exists.', 409, {
      fieldErrors: { email: ['That email address is already registered.'] },
    });
  }

  // Either a password is supplied, or we invite them to set one.
  const useInvite = !input.password;

  if (input.password) {
    const strengthError = validatePasswordStrength(input.password, [
      input.email,
      input.firstName,
      input.lastName,
    ]);
    if (strengthError) {
      return fail(strengthError, 422, { fieldErrors: { password: [strengthError] } });
    }
  }

  const passwordHash = await hashPassword(input.password || generateToken(32));

  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      companyName: input.companyName || null,
      role: input.role,
      status: useInvite ? 'PENDING' : input.status,
      notes: input.notes || null,
      passwordHash,
    },
    select: { id: true, email: true, firstName: true, role: true },
  });

  if (useInvite) {
    const token = generateToken(32);
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'STAFF_INVITE',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    await sendStaffInviteEmail(user.email, user.firstName, token, ROLE_LABELS[user.role]);
  }

  await recordAudit({
    action: 'user.created',
    actor,
    entity: 'User',
    entityId: user.id,
    summary: `Created ${user.email} as ${ROLE_LABELS[user.role]}`,
    metadata: { invited: useInvite },
  });

  return ok({ user, invited: useInvite });
});

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const actor = await requireApiRole('ADMIN');
  if (isResponse(actor)) return actor;

  const input = await parseJson(request, adminUpdateUserSchema.extend({ id: z.string().min(1) }));

  const existing = await prisma.user.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      phone: true,
      companyName: true,
      vatNumber: true,
      notes: true,
    },
  });
  if (!existing) return notFound('User');

  const isSelf = existing.id === actor.id;

  if (isSelf && input.role && input.role !== existing.role) {
    return fail('You cannot change your own role.', 403, { code: 'SELF_ROLE_CHANGE' });
  }
  if (isSelf && input.status && input.status !== 'ACTIVE') {
    return fail('You cannot suspend or delete your own account.', 403, { code: 'SELF_LOCKOUT' });
  }
  if (input.role && !hasRole(actor, input.role)) {
    return fail('You cannot grant a role above your own.', 403, { code: 'ROLE_ESCALATION' });
  }
  if (!hasRole(actor, existing.role)) {
    return fail('You cannot modify a user with a higher role than your own.', 403, {
      code: 'INSUFFICIENT_ROLE',
    });
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName || null } : {}),
      ...(input.vatNumber !== undefined ? { vatNumber: input.vatNumber || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      // Unlock a user who had tripped the brute-force lockout.
      ...(input.status === 'ACTIVE' ? { failedLoginCount: 0, lockedUntil: null } : {}),
    },
    select: { id: true, email: true, role: true, status: true, firstName: true, lastName: true },
  });

  // Suspension must take effect immediately, not at session expiry.
  if (input.status && input.status !== 'ACTIVE' && input.status !== existing.status) {
    await revokeAllSessions(user.id);
  }

  if (input.role && input.role !== existing.role) {
    await recordAudit({
      action: 'user.role_changed',
      actor,
      entity: 'User',
      entityId: user.id,
      summary: `${user.email}: ${ROLE_LABELS[existing.role]} → ${ROLE_LABELS[user.role]}`,
    });
  }

  if (input.status && input.status !== existing.status) {
    await recordAudit({
      action: input.status === 'SUSPENDED' ? 'user.suspended' : 'user.reinstated',
      actor,
      entity: 'User',
      entityId: user.id,
      summary: `${user.email}: ${existing.status} → ${input.status}`,
    });
  }

  await recordAudit({
    action: 'user.updated',
    actor,
    entity: 'User',
    entityId: user.id,
    summary: `Updated ${user.email}`,
    metadata: diffRecords(existing, user),
  });

  return ok({ user });
});

/** Soft delete — anonymises the account but keeps order history intact. */
export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const actor = await requireApiRole('SUPERADMIN');
  if (isResponse(actor)) return actor;

  const { id } = await parseJson(request, z.object({ id: z.string().min(1) }));

  if (id === actor.id) {
    return fail('You cannot delete your own account.', 403, { code: 'SELF_LOCKOUT' });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!user) return notFound('User');

  await prisma.user.update({
    where: { id },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
      // Break the link to the person while keeping referential integrity.
      email: `deleted-${id}@removed.invalid`,
      firstName: 'Deleted',
      lastName: 'User',
      phone: null,
      companyName: null,
      vatNumber: null,
      notes: null,
      passwordHash: await hashPassword(generateToken(32)),
      marketingOptIn: false,
    },
  });

  await Promise.all([
    revokeAllSessions(id),
    prisma.address.deleteMany({ where: { userId: id } }),
    prisma.savedTruck.deleteMany({ where: { userId: id } }),
    prisma.newsletterSubscriber.deleteMany({ where: { email: user.email } }),
  ]);

  await recordAudit({
    action: 'user.deleted',
    actor,
    entity: 'User',
    entityId: id,
    summary: `Erased personal data for ${user.email} (order history retained)`,
  });

  return ok({ deleted: true });
});
