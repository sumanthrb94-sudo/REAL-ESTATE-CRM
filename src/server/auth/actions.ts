"use server";

// EstateCRM — authentication actions: sign in, sign out, change password.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, needsRehash, verifyPassword, MIN_PASSWORD_LENGTH } from "./password";
import { getSessionUser, SESSION_COOKIE } from "./session";
import { createSessionToken, SESSION_TTL_MS } from "./token";

export interface AuthState {
  error?: string;
  notice?: string;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Deliberately vague for the caller: an attacker must not learn whether an
 * email exists from the sign-in form. Specific reasons stay server-side.
 */
const INVALID_CREDENTIALS = "That email and password combination is not recognised.";

async function startSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID_CREDENTIALS };
  }
  const { email, password } = parsed.data;

  const user = await db.users.findOne({ email });

  // Always run a verification, even with no matching user, so the response
  // time does not reveal whether the address exists.
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) return { error: INVALID_CREDENTIALS };

  if (!user.active) {
    return { error: "This account has been deactivated. Ask an administrator to restore it." };
  }

  const patch: Record<string, unknown> = { lastLoginAt: new Date().toISOString() };
  // Transparently upgrade hashes made with older cost parameters.
  if (needsRehash(user.passwordHash)) patch.passwordHash = await hashPassword(password);
  await db.users.update(user.id, patch);

  await startSession(user.id);
  redirect(user.mustChangePassword ? "/account/password" : "/dashboard");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two new passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Your current password is not correct." };
  }

  await db.users.update(user.id, {
    passwordHash: await hashPassword(parsed.data.newPassword),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  redirect("/dashboard");
}
