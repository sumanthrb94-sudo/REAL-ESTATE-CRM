// EstateCRM — user administration.
//
// Creating and managing the accounts that can sign in. Everything here is
// gated on `user.manage` by the actions layer; this module enforces the
// invariants that must hold regardless of who is calling.

import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/server/auth/password";
import { ROLES, type PublicUser, type Role, type User } from "@/types/domain";

export const userInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(ROLES as [Role, ...Role[]]),
  teamId: z.string().trim().optional(),
});
export type UserInput = z.infer<typeof userInputSchema>;

export const newUserSchema = userInputSchema.extend({
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

export interface UserRow extends PublicUser {
  /** True when the account has no usable password and cannot sign in. */
  passwordSet: boolean;
}

export async function listUsers(): Promise<UserRow[]> {
  const users = await db.users.list({ orderBy: { field: "name", dir: "asc" } });
  return users.map(({ passwordHash, ...rest }) => ({
    ...rest,
    passwordSet: Boolean(passwordHash),
  }));
}

async function assertEmailFree(email: string, exceptId?: string): Promise<void> {
  const existing = await db.users.findOne({ email });
  if (existing && existing.id !== exceptId) {
    throw new Error(`An account already uses ${email}.`);
  }
}

export async function createUser(input: unknown): Promise<User> {
  const data = newUserSchema.parse(input);
  await assertEmailFree(data.email);

  const now = new Date().toISOString();
  return db.users.create({
    name: data.name,
    email: data.email,
    phone: data.phone || undefined,
    role: data.role,
    teamId: data.teamId || undefined,
    active: true,
    passwordHash: await hashPassword(data.password),
    // The admin chose this password, so the account owner must replace it.
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateUser(id: string, patch: unknown): Promise<User> {
  const data = userInputSchema.partial().parse(patch);
  const user = await db.users.find(id);
  if (!user) throw new Error("User not found");

  if (data.email && data.email !== user.email) await assertEmailFree(data.email, id);

  // Demoting the last active admin would lock everyone out of user management.
  if (data.role && data.role !== "ADMIN" && user.role === "ADMIN") {
    await assertNotLastAdmin(id, "change the role of");
  }

  const updated = await db.users.update(id, {
    ...data,
    teamId: data.teamId || undefined,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error("User not found");
  return updated;
}

async function assertNotLastAdmin(id: string, verb: string): Promise<void> {
  const users = await db.users.list();
  const otherAdmins = users.filter((u) => u.id !== id && u.role === "ADMIN" && u.active);
  if (otherAdmins.length === 0) {
    throw new Error(
      `You cannot ${verb} the only active administrator — promote another account to Admin first.`,
    );
  }
}

export async function setUserActive(id: string, active: boolean): Promise<User> {
  const user = await db.users.find(id);
  if (!user) throw new Error("User not found");

  if (!active && user.role === "ADMIN") await assertNotLastAdmin(id, "deactivate");

  const updated = await db.users.update(id, { active, updatedAt: new Date().toISOString() });
  if (!updated) throw new Error("User not found");
  return updated;
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const user = await db.users.find(id);
  if (!user) throw new Error("User not found");

  await db.users.update(id, {
    passwordHash: await hashPassword(newPassword),
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Deleting a user would orphan every lead, activity and booking they own, so
 * accounts are deactivated instead. Deactivation takes effect on the next
 * request because getSessionUser() rejects inactive accounts.
 */
export async function deleteUser(): Promise<never> {
  throw new Error("Accounts are deactivated rather than deleted, so their history stays intact.");
}
