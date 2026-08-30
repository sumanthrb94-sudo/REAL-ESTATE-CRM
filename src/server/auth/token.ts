// EstateCRM — session token signing.
//
// The session cookie is a compact signed token, not a raw user id:
//
//   <base64url(payload)>.<base64url(hmacSha256(payload))>
//
// The payload carries the user id, an issued-at and an expiry. Any edit to the
// payload invalidates the signature, so a cookie cannot be re-pointed at
// another user — which is exactly what the previous unsigned cookie allowed.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  /** User id. */
  sub: string;
  /** Issued at, epoch ms. */
  iat: number;
  /** Expires at, epoch ms. */
  exp: number;
}

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Development fallback so `npm run dev` works with no .env. In production an
 * explicit SESSION_SECRET is required — booting without one would silently
 * make every existing session forgeable by anyone who reads this file.
 */
const DEV_SECRET = "estatecrm-insecure-development-secret";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters in production. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  if (secret && secret.length < 32) {
    console.warn("[auth] SESSION_SECRET is shorter than 32 characters; using it anyway in development.");
    return secret;
  }
  return DEV_SECRET;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", getSessionSecret()).update(payloadB64).digest());
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload: SessionPayload = { sub: userId, iat: now, exp: now + SESSION_TTL_MS };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verify signature and expiry. Returns null for anything untrustworthy —
 * callers treat null as "not signed in" rather than distinguishing why.
 */
export function verifySessionToken(token?: string | null, now = Date.now()): SessionPayload | null {
  if (!token) return null;

  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) return null;

  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(payloadB64);

  // Compare as bytes, constant time. Length mismatch short-circuits — that
  // leaks only the length of a value the attacker already controls.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload?.sub !== "string" || !payload.sub) return null;
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;

  return payload;
}
