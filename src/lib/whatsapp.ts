/**
 * WhatsApp link building.
 *
 * `wa.me` links take digits only — no `+`, spaces or punctuation. UK numbers
 * are commonly entered in local format (`07700 900123`), which has no
 * country code, so a leading `0` is treated as a UK number and rewritten to
 * `44…` — reasonable for a UK-based dealer; a number already given in
 * international format (`+447700900123`) passes through untouched.
 */
export function sanitisePhoneForWhatsApp(phone: string, defaultCountryCode = '44'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

/** Builds a `wa.me` deep link, optionally with a pre-filled message. */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const number = sanitisePhoneForWhatsApp(phone);
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${query}`;
}

/** The message pre-filled when a visitor taps "Enquire on WhatsApp" for a vehicle. */
export function vehicleWhatsAppMessage(params: {
  title: string;
  stockNumber: string;
  buyerName?: string;
}): string {
  const intro = params.buyerName
    ? `Hi, I'm ${params.buyerName} and I'm`
    : "Hi, I'm";
  return `${intro} enquiring about ${params.title} (stock ${params.stockNumber}).`;
}
