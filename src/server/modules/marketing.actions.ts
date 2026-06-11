"use server";

// EstateCRM — marketing server actions.
// Thin RBAC-gated wrappers over the marketing service, invoked from client
// widgets. Every mutation revalidates the affected marketing routes.

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import {
  createCampaign,
  createSegment,
  createTemplate,
  deleteSegment,
  deleteTemplate,
  evaluateSegment,
  setCampaignStatus,
  updateSegment,
  updateTemplate,
  segmentFilterSchema,
  type CampaignCreateInput,
  type SegmentCreateInput,
  type SegmentUpdateInput,
  type TemplateCreateInput,
  type TemplateUpdateInput,
} from "@/server/modules/marketing";
import type { CampaignStatus, SegmentFilter } from "@/types/domain";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(err: unknown): ActionResult {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    return { ok: false, error: first ? first.message : "Invalid input" };
  }
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
}

async function assertWrite(): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!can(user.role, "marketing.write")) {
    return { ok: false, error: "You do not have permission to modify marketing data." };
  }
  return null;
}

// ─── Campaigns ──────────────────────────────────────────────────────────────
export async function createCampaignAction(input: CampaignCreateInput): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    await createCampaign(input);
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setCampaignStatusAction(id: string, status: CampaignStatus): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    await setCampaignStatus(id, status);
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Templates ──────────────────────────────────────────────────────────────
export async function createTemplateAction(input: TemplateCreateInput): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    await createTemplate(input);
    revalidatePath("/marketing/templates");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateTemplateAction(id: string, input: TemplateUpdateInput): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    const updated = await updateTemplate(id, input);
    if (!updated) return { ok: false, error: "Template not found" };
    revalidatePath("/marketing/templates");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    const removed = await deleteTemplate(id);
    if (!removed) return { ok: false, error: "Template not found" };
    revalidatePath("/marketing/templates");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Segments ───────────────────────────────────────────────────────────────
export async function createSegmentAction(input: SegmentCreateInput): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    await createSegment(input);
    revalidatePath("/marketing/segments");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSegmentAction(id: string, input: SegmentUpdateInput): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    const updated = await updateSegment(id, input);
    if (!updated) return { ok: false, error: "Segment not found" };
    revalidatePath("/marketing/segments");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteSegmentAction(id: string): Promise<ActionResult> {
  const denied = await assertWrite();
  if (denied) return denied;
  try {
    const removed = await deleteSegment(id);
    if (!removed) return { ok: false, error: "Segment not found" };
    revalidatePath("/marketing/segments");
    revalidatePath("/marketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export interface SegmentPreviewResult {
  ok: boolean;
  error?: string;
  count?: number;
  sample?: { id: string; name: string; status: string; temperature: string }[];
}

/** Ad-hoc audience preview for the segment builder (read-gated). */
export async function previewSegmentAction(filters: SegmentFilter[]): Promise<SegmentPreviewResult> {
  const user = await getCurrentUser();
  if (!can(user.role, "marketing.read")) {
    return { ok: false, error: "You do not have permission to view marketing data." };
  }
  try {
    const parsed = filters.map((f) => segmentFilterSchema.parse(f)) as SegmentFilter[];
    if (parsed.length === 0) return { ok: false, error: "Add at least one filter to preview" };
    const { leads, count } = await evaluateSegment({ filters: parsed });
    return {
      ok: true,
      count,
      sample: leads.slice(0, 5).map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        temperature: l.temperature,
      })),
    };
  } catch (err) {
    return fail(err);
  }
}
