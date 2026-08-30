"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { assertPermission } from "@/server/auth/guard";
import { getSessionUser } from "@/server/auth/session";
import { createUser, resetPassword, setUserActive, updateUser } from "./users";

export interface ActionState {
  error?: string;
  success?: string;
}

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Invalid input";
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

const DENIED = "You do not have permission to manage users.";

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission("user.manage", DENIED);
    const user = await createUser({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      role: String(formData.get("role") ?? "SALES_AGENT"),
      teamId: String(formData.get("teamId") ?? "").trim() || undefined,
      password: String(formData.get("password") ?? ""),
    });
    revalidatePath("/settings/users");
    return {
      success: `${user.name} can now sign in with ${user.email}. They will be asked to set their own password.`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateUserAction(
  userId: string,
  patch: Record<string, unknown>,
): Promise<ActionState> {
  try {
    await assertPermission("user.manage", DENIED);
    await updateUser(userId, patch);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/settings/users");
  return {};
}

export async function setUserActiveAction(
  userId: string,
  active: boolean,
): Promise<ActionState> {
  try {
    await assertPermission("user.manage", DENIED);

    // Locking yourself out is always a mistake, never an intention.
    const me = await getSessionUser();
    if (!active && me?.id === userId) {
      return { error: "You cannot deactivate the account you are signed in with." };
    }

    await setUserActive(userId, active);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/settings/users");
  return { success: active ? "Account reactivated." : "Account deactivated." };
}

export async function resetPasswordAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPermission("user.manage", DENIED);
    await resetPassword(userId, String(formData.get("password") ?? ""));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/settings/users");
  return { success: "Password reset. They will be asked to change it when they next sign in." };
}
