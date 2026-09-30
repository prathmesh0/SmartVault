import { createHash, randomBytes } from 'node:crypto';

/** Generates a high-entropy opaque token (used for refresh tokens). */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

/** SHA-256 hash — fast on purpose, since the input already has 384 bits of entropy. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
