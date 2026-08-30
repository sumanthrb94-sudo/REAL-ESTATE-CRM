// EstateCRM — session resolution.
//
// The session cookie holds a signed token (see auth/token.ts), not a raw user
// id. There is no default user: an unsigned, expired or unknown session means
// nobody is signed in, and callers redirect to /login.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { verifySessionToken } from "./token";
import type { PublicUser, User } from "@/types/domain";

export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "estatecrm_session";

/** Strip secrets before a User crosses into a client component. */
export function publicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured to drop it
  const { passwordHash, ...rest } = user;
  return rest;
}

/**
 * Resolve the signed-in user, or null. Deactivated accounts resolve to null so
 * that suspending a user takes effect immediately rather than at token expiry.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await db.users.find(payload.sub);
  if (!user || !user.active) return null;
  return user;
}

/**
 * Resolve the signed-in user or redirect to /login. Use this in any page or
 * action that requires a session — it never returns null.
 */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** @deprecated Use requireUser(). Kept so existing call sites keep compiling. */
export async function getCurrentUser(): Promise<User> {
  return requireUser();
}

export async function listAssignableUsers(): Promise<User[]> {
  const users = await db.users.list();
  return users.filter(
    (u) => u.active && ["SALES_AGENT", "SALES_MANAGER", "SALES_HEAD"].includes(u.role),
  );
}
