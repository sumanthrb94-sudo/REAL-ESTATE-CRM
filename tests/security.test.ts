import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ATTEMPT_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  clearFailures,
  lockState,
  registerFailure,
} from "@/server/auth/lockout";

describe("sign-in lockout", () => {
  it("locks the account after the configured run of failures", () => {
    const now = Date.now();
    let user: Record<string, unknown> = {};
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      user = { ...user, ...registerFailure(user, now + i * 1000) };
      expect(user.lockedUntil, `attempt ${i} must not lock`).toBeUndefined();
    }
    user = { ...user, ...registerFailure(user, now + MAX_FAILED_ATTEMPTS * 1000) };
    expect(user.lockedUntil).toBeTruthy();
    expect(lockState(user as never, now + MAX_FAILED_ATTEMPTS * 1000).locked).toBe(true);
  });

  it("does not lock an account for occasional typos spread over time", () => {
    let user: Record<string, unknown> = {};
    // Each failure lands after the window has expired, so the run restarts.
    for (let i = 0; i < MAX_FAILED_ATTEMPTS * 3; i++) {
      const at = Date.now() + i * (ATTEMPT_WINDOW_MS + 1000);
      user = { ...user, ...registerFailure(user, at) };
      expect(user.lockedUntil, "a slow drip must never lock").toBeUndefined();
      expect(user.failedLoginCount).toBe(1);
    }
  });

  it("expires the lock on its own", () => {
    const now = Date.now();
    const locked = { lockedUntil: new Date(now + LOCKOUT_MS).toISOString() };
    expect(lockState(locked, now).locked).toBe(true);
    expect(lockState(locked, now + LOCKOUT_MS + 1).locked).toBe(false);
  });

  it("clears the counters on a successful sign-in", () => {
    const cleared = clearFailures();
    expect(cleared.failedLoginCount).toBe(0);
    expect(cleared.lockedUntil).toBeNull();
    expect(lockState({ lockedUntil: undefined }).locked).toBe(false);
  });

  it("treats an unparseable lockedUntil as not locked, never as locked forever", () => {
    expect(lockState({ lockedUntil: "not-a-date" }).locked).toBe(false);
  });
});

// A server action is a public HTTP endpoint. One that forgets its permission
// check is an authorization hole reachable by anyone who can guess the action
// id, so the guard must be structural rather than a matter of review.
describe("server action authorization", () => {
  const GUARD =
    /assertPermission|requirePermission|requireAnyPermission|requireUser|getCurrentUser|getSessionUser|assert[A-Za-z]*\(|can\(/;
  // Sign-in and sign-out are the unauthenticated entry points by design.
  const EXEMPT = new Set(["signIn", "signOut"]);

  const actionFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...actionFiles(path));
      else if (entry.name.endsWith("actions.ts")) out.push(path);
    }
    return out;
  };

  it("every exported server action references a guard", () => {
    const files = actionFiles("src/server");
    expect(files.length).toBeGreaterThan(5);

    const unguarded: string[] = [];
    let checked = 0;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const chunk of source.split(/\nexport async function /).slice(1)) {
        const name = chunk.split("(")[0].trim();
        checked++;
        if (EXEMPT.has(name)) continue;
        // Guards may be called directly or via a file-local helper, so the
        // whole file's helpers count — but the action body must invoke one.
        if (!GUARD.test(chunk)) unguarded.push(`${file}::${name}`);
      }
    }
    expect(checked).toBeGreaterThan(30);
    expect(unguarded, `unguarded server actions:\n${unguarded.join("\n")}`).toEqual([]);
  });
});
