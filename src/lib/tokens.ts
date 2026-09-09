import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Opaque, high-entropy token generation and verification.
 *
 * Raw tokens are only ever handed to the client (cookie / email link); the
 * database stores an HMAC of the token keyed with AUTH_SECRET. A read-only
 * database leak therefore cannot be replayed as a valid session or reset link.
 */

/** 32 bytes = 256 bits of entropy, URL-safe. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** 6-digit numeric code for email OTP/MFA — rejection sampled to avoid modulo bias. */
export function generateOtpCode(): string {
  let value: number;
  do {
    value = randomBytes(4).readUInt32BE(0);
  } while (value >= 4_000_000_000);
  return String(value % 1_000_000).padStart(6, '0');
}

/** Keyed digest used for anything stored in the database. */
export function hashToken(token: string): string {
  return createHmac('sha256', env.authSecret).update(token).digest('hex');
}

/** Unkeyed digest, used where the value only needs pseudonymising (e.g. IPs). */
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Stateless signed values, used for links that must survive without a database
 * row — newsletter confirmation and one-click unsubscribe.
 *
 * Format: <base64url(payload)>.<base64url(hmac)>. The payload is not secret;
 * the signature is what proves we issued the link.
 */
export function signValue(payload: string, purpose: string): string {
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = createHmac('sha256', env.authSecret)
    .update(`${purpose}:${encoded}`)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

/** Returns the payload when the signature is valid, otherwise null. */
export function verifySignedValue(token: string, purpose: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expected = createHmac('sha256', env.authSecret)
    .update(`${purpose}:${encoded}`)
    .digest('base64url');

  if (!safeCompare(signature, expected)) return null;

  try {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Human-friendly reference generator, e.g. ORD-7F3K2Q9M.
 * Uses Crockford-style alphabet without look-alike characters.
 */
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateReference(prefix: string, length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }
  return `${prefix}-${out}`;
}
