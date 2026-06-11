"use server";

// EstateCRM — lead distribution server actions.

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { createRule, toggleRule } from "@/server/modules/distribution";
import type { ActionState } from "@/server/modules/leads.actions";

export async function createRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.assign")) return { error: "You do not have permission to manage distribution rules." };

  const result = await createRule({
    name: formData.get("name"),
    strategy: formData.get("strategy"),
    priority: formData.get("priority"),
    source: formData.get("source"),
    projectId: formData.get("projectId"),
    assigneeId: formData.get("assigneeId"),
    active: true,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/distribution");
  return { success: `Rule "${result.data.name}" created.` };
}

export async function toggleRuleAction(ruleId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.assign")) return { error: "You do not have permission to manage distribution rules." };

  const result = await toggleRule(ruleId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/distribution");
  return { success: `Rule ${result.data.active ? "activated" : "paused"}.` };
}
