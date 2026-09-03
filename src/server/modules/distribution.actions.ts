"use server";

// EstateCRM — lead distribution server actions.

import { revalidatePath } from "next/cache";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { createRule, distributeUnassigned, toggleRule } from "@/server/modules/distribution";
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

/**
 * Run the daily sweep by hand.
 *
 * The scheduled run covers the normal case; this is for the manager who has
 * just fixed a rule, or just imported a file, and wants the leads placed now
 * rather than tomorrow morning.
 */
export async function distributeNowAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!can(user.role, "lead.assign")) {
    return { error: "You do not have permission to distribute leads." };
  }

  const result = await distributeUnassigned();
  revalidatePath("/distribution");
  revalidatePath("/leads");
  revalidatePath("/my-day");

  if (result.considered === 0) return { success: "Every lead already has an owner." };
  if (result.assigned === 0) {
    return {
      error: `${result.considered} lead${result.considered === 1 ? "" : "s"} could not be placed — no active rule matched them, or no agent is available to receive them.`,
    };
  }

  const split = result.perAgent.map((a) => `${a.name} ${a.count}`).join(", ");
  const tail = result.remaining > 0 ? ` ${result.remaining} still unplaced.` : "";
  return { success: `Assigned ${result.assigned} of ${result.considered} — ${split}.${tail}` };
}
