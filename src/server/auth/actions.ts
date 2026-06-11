"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = process.env.SESSION_COOKIE ?? "estatecrm_session";

/** Demo session switch: persists the chosen user id in a cookie. */
export async function signInAs(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
  redirect("/login");
}
