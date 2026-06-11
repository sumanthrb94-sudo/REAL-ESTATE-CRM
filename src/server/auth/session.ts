// EstateCRM — session resolution.
// Demo build: resolves the current user from a cookie, defaulting to the admin
// account so the app is fully explorable. Swap getCurrentUser() for a real auth
// provider (NextAuth, Clerk, custom JWT) without changing call sites.

import { cookies } from "next/headers";
import { db } from "@/server/db";
import type { User } from "@/types/domain";

const DEFAULT_USER_ID = "usr_admin";

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(process.env.SESSION_COOKIE ?? "estatecrm_session")?.value ?? DEFAULT_USER_ID;
  const user = (await db.users.find(userId)) ?? (await db.users.find(DEFAULT_USER_ID));
  if (!user) {
    throw new Error("No users seeded; cannot resolve session.");
  }
  return user;
}

export async function listAssignableUsers(): Promise<User[]> {
  const users = await db.users.list();
  return users.filter((u) => u.active && ["SALES_AGENT", "SALES_MANAGER", "SALES_HEAD"].includes(u.role));
}
