"use server";

// EstateCRM — site visit server actions.

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import type { ActionState } from "@/server/modules/leads.actions";
import { addFeedback, scheduleVisit, updateVisitStatus } from "@/server/modules/site-visits";
import type { SiteVisitStatus } from "@/types/domain";

function revalidateVisitViews(leadId?: string) {
  revalidatePath("/site-visits");
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function scheduleVisitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to schedule site visits." };

  const result = await scheduleVisit(
    {
      leadId: formData.get("leadId"),
      projectId: formData.get("projectId"),
      agentId: formData.get("agentId"),
      scheduledAt: formData.get("scheduledAt"),
    },
    user.id,
  );
  if (!result.ok) return { error: result.error };

  revalidateVisitViews(result.data.leadId);
  return { success: "Site visit scheduled." };
}

export async function updateVisitStatusAction(visitId: string, status: SiteVisitStatus): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to update site visits." };

  const result = await updateVisitStatus(visitId, status, user.id);
  if (!result.ok) return { error: result.error };

  revalidateVisitViews(result.data.leadId);
  return { success: `Visit marked ${status.replace(/_/g, " ").toLowerCase()}.` };
}

export async function addVisitFeedbackAction(visitId: string, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.write")) return { error: "You do not have permission to update site visits." };

  const result = await addFeedback(visitId, String(formData.get("feedback") ?? ""));
  if (!result.ok) return { error: result.error };

  revalidateVisitViews(result.data.leadId);
  return { success: "Feedback saved." };
}
