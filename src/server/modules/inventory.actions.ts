"use server";

// EstateCRM — inventory server actions.
// Thin, RBAC-gated wrappers around the inventory service for forms & widgets.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import {
  bulkCreateUnits,
  createProject,
  createTower,
  createUnit,
  deleteTower,
  deleteUnit,
  updateProject,
  updateTower,
  updateUnit,
  updateUnitStatus,
} from "./inventory";

export interface ActionState {
  error?: string;
  success?: string;
}

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Invalid input";
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

async function assertInventoryWrite(): Promise<void> {
  const user = await getCurrentUser();
  if (!can(user.role, "inventory.write")) {
    throw new Error("You do not have permission to modify inventory.");
  }
}

function optionalField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let projectId: string;
  try {
    await assertInventoryWrite();
    const amenitiesRaw = optionalField(formData, "amenities") ?? "";
    const project = await createProject({
      name: String(formData.get("name") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      status: String(formData.get("status") ?? "UPCOMING"),
      developer: optionalField(formData, "developer"),
      locality: optionalField(formData, "locality"),
      description: optionalField(formData, "description"),
      reraId: optionalField(formData, "reraId"),
      coverImage: optionalField(formData, "coverImage"),
      amenities: amenitiesRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
    projectId = project.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  redirect(`/inventory/${projectId}`);
}

/** Form-driven project edit, mirroring createProjectAction's field handling. */
export async function updateProjectFormAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    const amenitiesRaw = optionalField(formData, "amenities") ?? "";
    await updateProject(projectId, {
      name: String(formData.get("name") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      status: String(formData.get("status") ?? "UPCOMING"),
      developer: optionalField(formData, "developer"),
      locality: optionalField(formData, "locality"),
      description: optionalField(formData, "description"),
      reraId: optionalField(formData, "reraId"),
      coverImage: optionalField(formData, "coverImage"),
      amenities: amenitiesRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return { success: "Project details saved." };
}

export async function updateProjectAction(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    await updateProject(projectId, patch);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return {};
}

export async function updateUnitStatusAction(
  unitId: string,
  status: string,
): Promise<ActionState> {
  let projectId: string;
  try {
    await assertInventoryWrite();
    const unit = await updateUnitStatus(unitId, status);
    projectId = unit.projectId;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return {};
}

// ─── Towers ─────────────────────────────────────────────────────────────────
export async function createTowerAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    const tower = await createTower({
      projectId,
      name: String(formData.get("name") ?? "").trim(),
      floors: formData.get("floors"),
    });
    revalidatePath(`/inventory/${projectId}`);
    return { success: `${tower.name} added. Now add its units.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateTowerAction(
  towerId: string,
  projectId: string,
  patch: Record<string, unknown>,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    await updateTower(towerId, patch);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/inventory/${projectId}`);
  return {};
}

export async function deleteTowerAction(
  towerId: string,
  projectId: string,
): Promise<ActionState> {
  let deletedUnits: number;
  try {
    await assertInventoryWrite();
    ({ deletedUnits } = await deleteTower(towerId));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return { success: `Tower deleted along with ${deletedUnits} unit(s).` };
}

// ─── Units ──────────────────────────────────────────────────────────────────
export async function createUnitAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    const unit = await createUnit({
      projectId,
      towerId: String(formData.get("towerId") ?? ""),
      unitNumber: String(formData.get("unitNumber") ?? "").trim(),
      floor: formData.get("floor"),
      type: String(formData.get("type") ?? "").trim(),
      carpetArea: formData.get("carpetArea"),
      builtUpArea: optionalField(formData, "builtUpArea"),
      facing: optionalField(formData, "facing"),
      basePrice: formData.get("basePrice"),
      status: String(formData.get("status") ?? "AVAILABLE"),
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${projectId}`);
    return { success: `Unit ${unit.unitNumber} added.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function bulkCreateUnitsAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let created: number;
  try {
    await assertInventoryWrite();
    ({ created } = await bulkCreateUnits({
      towerId: String(formData.get("towerId") ?? ""),
      fromFloor: formData.get("fromFloor"),
      toFloor: formData.get("toFloor"),
      unitsPerFloor: formData.get("unitsPerFloor"),
      type: String(formData.get("type") ?? "").trim(),
      carpetArea: formData.get("carpetArea"),
      builtUpArea: optionalField(formData, "builtUpArea"),
      facing: optionalField(formData, "facing"),
      ratePerSqFt: formData.get("ratePerSqFt"),
    }));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return { success: `${created} unit(s) generated.` };
}

export async function updateUnitAction(
  unitId: string,
  projectId: string,
  patch: Record<string, unknown>,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    await updateUnit(unitId, patch);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return {};
}

export async function deleteUnitAction(
  unitId: string,
  projectId: string,
): Promise<ActionState> {
  try {
    await assertInventoryWrite();
    await deleteUnit(unitId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${projectId}`);
  return { success: "Unit deleted." };
}
