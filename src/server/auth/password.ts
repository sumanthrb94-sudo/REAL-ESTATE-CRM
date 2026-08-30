// EstateCRM — password hashing.
//
// Uses Node's built-in scrypt (RFC 7914) so there is no native dependency to
// compile and nothing to keep patched. Stored format is:
//
//   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
//
// The parameters travel with the hash, so raising the cost later does not
// invalidate existing passwords — `needsRehash()` tells you which ones to
// upgrade on next successful sign-in.

import { randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Current cost parameters. N=2^15 lands around 100ms on a typical serverless CPU. */
const N = 32_768;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
// scrypt's default maxmem (32MB) is too low for N=32768,r=8: it needs ~128*N*r bytes.
const MAX_MEM = 128 * N * R * 2;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

/**
 * Synchronous variant, for the one place that needs it: hashing the bootstrap
 * admin password while the in-memory store is being constructed at boot.
 * Prefer `hashPassword()` everywhere else — this blocks the event loop for
 * roughly 100ms.
 */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

/**
 * Constant-time password check. Returns false rather than throwing on a
 * malformed or missing hash, so a user row with no password simply cannot
 * sign in.
 */
export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: Math.max(MAX_MEM, 128 * n * r * 2),
    });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a stored hash was made with weaker parameters than we now use. */
export function needsRehash(stored?: string): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R;
}
