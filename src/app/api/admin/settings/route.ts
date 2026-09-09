import { guard, handler, isResponse, ok, parseJson, requireApiRole } from '@/lib/api';
import { settingsSchema } from '@/lib/validation';
import { getSettings, updateSettings } from '@/lib/settings';
import { diffRecords, recordAudit } from '@/lib/audit';

export const PATCH = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  const input = await parseJson(request, settingsSchema);
  const before = await getSettings();

  const after = await updateSettings({
    ...(input.siteName ? { siteName: input.siteName } : {}),
    ...(input.tagline ? { tagline: input.tagline } : {}),
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(input.openingHours ? { openingHours: input.openingHours } : {}),
    ...(input.defaultReservationFee !== null && input.defaultReservationFee !== undefined
      ? { defaultReservationFee: input.defaultReservationFee }
      : {}),
    ...(input.defaultVatRate !== null && input.defaultVatRate !== undefined
      ? { defaultVatRate: input.defaultVatRate }
      : {}),
    ...(input.financeApr !== undefined ? { financeApr: input.financeApr } : {}),
    enableGuestCheckout: input.enableGuestCheckout,
    enableFullPurchase: input.enableFullPurchase,
    maintenanceMode: input.maintenanceMode,
  });

  await recordAudit({
    action: 'settings.updated',
    actor: user,
    entity: 'Setting',
    entityId: 'site',
    summary: 'Site settings updated',
    metadata: diffRecords(before, after),
  });

  return ok({ settings: after });
});
