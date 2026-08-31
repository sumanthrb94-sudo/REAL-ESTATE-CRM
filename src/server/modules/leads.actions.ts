"use server";

// EstateCRM — lead server actions.
// Thin RBAC-gated wrappers around the leads service, consumed by forms and
// client widgets. Every mutation revalidates the routes it can affect.

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { autoAssign } from "@/server/modules/distribution";
import { addActivity, changeStatus, createLead, getLead, updateLead } from "@/server/modules/leads";
import { db } from "@/server/db";
import type { ActivityType, LeadStatus } from "@/types/domain";

export interface ActionState {
  error?: string;
  success?: string;
}

function revalidateLeadViews(leadId?: string) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to create leads." };

  const ownerId = String(formData.get("ownerId") ?? "");
  const result = await createLead({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    source: formData.get("source"),
    temperature: formData.get("temperature"),
    budgetMin: formData.get("budgetMin"),
    budgetMax: formData.get("budgetMax"),
    requirement: formData.get("requirement"),
    projectId: formData.get("projectId"),
    // Manual owner pick requires the assign permission; otherwise auto-assign.
    ownerId: can(user.role, "lead.assign") ? ownerId : "",
  });
  if (!result.ok) return { error: result.error };

  let assignmentNote = "";
  if (!result.data.ownerId) {
    const outcome = await autoAssign(result.data);
    assignmentNote = outcome
      ? ` Auto-assigned to ${outcome.user.name} via "${outcome.rule.name}".`
      : " No distribution rule matched — assign an owner manually.";
  }

  revalidateLeadViews(result.data.id);
  return { success: `Lead "${result.data.name}" created.${assignmentNote}` };
}

export async function changeLeadStatusAction(
  leadId: string,
  status: LeadStatus,
  lostReason?: string,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to update leads." };

  const result = await changeStatus(leadId, status, lostReason, user.id);
  if (!result.ok) return { error: result.error };

  revalidateLeadViews(leadId);
  revalidatePath("/site-visits");
  return { success: `Moved to ${status.replace(/_/g, " ").toLowerCase()}.` };
}

export async function reassignLeadAction(leadId: string, ownerId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.assign")) return { error: "You do not have permission to reassign leads." };

  const result = await updateLead(leadId, { ownerId });
  if (!result.ok) return { error: result.error };

  const newOwner = ownerId ? await db.users.find(ownerId) : null;
  await db.activities.create({
    type: "NOTE",
    leadId,
    userId: user.id,
    subject: newOwner ? `Reassigned to ${newOwner.name}` : "Owner removed",
    completed: true,
    createdAt: new Date().toISOString(),
  });

  revalidateLeadViews(leadId);
  return { success: newOwner ? `Reassigned to ${newOwner.name}.` : "Owner cleared." };
}

export async function addActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to log activities." };

  const leadId = String(formData.get("leadId") ?? "");
  const result = await addActivity(
    leadId,
    {
      type: formData.get("type"),
      subject: formData.get("subject"),
      body: formData.get("body"),
      outcome: formData.get("outcome"),
      dueAt: formData.get("dueAt"),
      completed: formData.get("type") !== "TASK",
    },
    user.id,
  );
  if (!result.ok) return { error: result.error };

  revalidateLeadViews(leadId);
  return { success: "Activity logged." };
}

/** One-click Call / Email / WhatsApp / SMS logging from the lead detail page. */
export async function quickLogAction(
  leadId: string,
  type: Extract<ActivityType, "CALL" | "EMAIL" | "WHATSAPP" | "SMS">,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to log activities." };

  const lead = await getLead(leadId);
  if (!lead) return { error: "Lead not found" };

  // These record a touch the salesperson made themselves — the app does not
  // dial or send. "Email sent to <name>" read as though the system had
  // despatched something, which is what confused a real user reading the
  // timeline. Each phrase is written out in full so the grammar holds.
  const describe: Record<typeof type, (name: string) => string> = {
    CALL: (name) => `Called ${name}`,
    EMAIL: (name) => `Emailed ${name}`,
    WHATSAPP: (name) => `WhatsApp message to ${name}`,
    SMS: (name) => `SMS to ${name}`,
  };
  const subject = describe[type](lead.name);

  const result = await addActivity(leadId, { type, subject, completed: true }, user.id);
  if (!result.ok) return { error: result.error };

  revalidateLeadViews(leadId);
  return { success: `${subject} — logged.` };
}
