// Brute-force protection for sign-in.
//
// Sign-in accepted unlimited attempts. scrypt makes each guess expensive, but
// nothing stopped an attacker working through a password list against a known
// address — and the addresses here are staff emails, which are not secret.
//
// The counters live on the user document rather than in memory because the app
// runs serverless: each instance has its own memory, so an in-process counter
// would reset whenever a request landed somewhere new.
import type { User } from "@/types/domain";

/** Failures tolerated before the account is temporarily closed. */
export const MAX_FAILED_ATTEMPTS = 8;
/** Failures older than this no longer count towards the limit. */
export const ATTEMPT_WINDOW_MS = 15 * 60_000;
/** How long sign-in is refused once the limit is hit. */
export const LOCKOUT_MS = 15 * 60_000;

export interface LockState {
  locked: boolean;
  /** Whole minutes remaining, for the message shown to the user. */
  minutesRemaining: number;
}

export function lockState(user: Pick<User, "lockedUntil">, now = Date.now()): LockState {
  if (!user.lockedUntil) return { locked: false, minutesRemaining: 0 };
  const until = Date.parse(user.lockedUntil);
  if (!Number.isFinite(until) || until <= now) return { locked: false, minutesRemaining: 0 };
  return { locked: true, minutesRemaining: Math.max(1, Math.ceil((until - now) / 60_000)) };
}

/**
 * The patch to apply after a failed attempt.
 *
 * A run of failures older than the window starts over, so an account is not
 * locked by eight typos spread across a month.
 */
export function registerFailure(
  user: Pick<User, "failedLoginCount" | "firstFailedLoginAt">,
  now = Date.now(),
): Record<string, unknown> {
  const startedAt = user.firstFailedLoginAt ? Date.parse(user.firstFailedLoginAt) : NaN;
  const withinWindow = Number.isFinite(startedAt) && now - startedAt < ATTEMPT_WINDOW_MS;
  const count = withinWindow ? (user.failedLoginCount ?? 0) + 1 : 1;

  const patch: Record<string, unknown> = {
    failedLoginCount: count,
    firstFailedLoginAt: withinWindow ? user.firstFailedLoginAt : new Date(now).toISOString(),
  };
  if (count >= MAX_FAILED_ATTEMPTS) {
    patch.lockedUntil = new Date(now + LOCKOUT_MS).toISOString();
    // Start a fresh run so the next failure after the lockout does not
    // immediately re-lock the account.
    patch.failedLoginCount = 0;
    patch.firstFailedLoginAt = null;
  }
  return patch;
}

/** The patch that clears the counters after a successful sign-in. */
export function clearFailures(): Record<string, unknown> {
  return { failedLoginCount: 0, firstFailedLoginAt: null, lockedUntil: null };
}
