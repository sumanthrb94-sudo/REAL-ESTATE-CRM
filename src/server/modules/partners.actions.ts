"use server";

// EstateCRM — channel partner server actions.
// Thin RBAC-gated wrappers over the partners service, invoked from client
// components. Every mutation revalidates the affected routes.

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import {
  createPartner,
  setPartnerStatus,
  updatePartner,
} from "@/server/modules/partners";
import type { PartnerStatus } from "@/types/domain";

export interface PartnerActionResult {
  ok: boolean;
  error?: string;
}

function str(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

function revalidatePartnerRoutes(id?: string): void {
  revalidatePath("/channel-partners");
  if (id) revalidatePath(`/channel-partners/${id}`);
}

export async function createPartnerAction(formData: FormData): Promise<PartnerActionResult> {
  const user = await getCurrentUser();
  if (!can(user.role, "partner.write")) {
    return { ok: false, error: "You do not have permission to onboard partners." };
  }
  try {
    await createPartner({
      name: str(formData.get("name")) ?? "",
      phone: str(formData.get("phone")) ?? "",
      company: str(formData.get("company")),
      email: str(formData.get("email")),
      reraId: str(formData.get("reraId")),
      city: str(formData.get("city")),
      commissionPct: str(formData.get("commissionPct")) ?? "0",
    });
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
  revalidatePartnerRoutes();
  return { ok: true };
}

export async function updatePartnerAction(
  id: string,
  formData: FormData,
): Promise<PartnerActionResult> {
  const user = await getCurrentUser();
  if (!can(user.role, "partner.write")) {
    return { ok: false, error: "You do not have permission to edit partners." };
  }
  try {
    await updatePartner(id, {
      name: str(formData.get("name")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      email: str(formData.get("email")),
      reraId: str(formData.get("reraId")),
      city: str(formData.get("city")),
      commissionPct: str(formData.get("commissionPct")),
    });
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
  revalidatePartnerRoutes(id);
  return { ok: true };
}

export async function setPartnerStatusAction(
  id: string,
  status: PartnerStatus,
): Promise<PartnerActionResult> {
  const user = await getCurrentUser();
  if (!can(user.role, "partner.write")) {
    return { ok: false, error: "You do not have permission to change partner status." };
  }
  try {
    await setPartnerStatus(id, status);
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
  revalidatePartnerRoutes(id);
  return { ok: true };
}
