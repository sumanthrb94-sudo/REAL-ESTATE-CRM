// EstateCRM — lead distribution service.
// Implements automatic lead assignment driven by ordered AssignmentRules.
//
// How a lead gets an owner:
//   1. Active rules are evaluated in priority order (highest first).
//   2. The first rule whose conditions match the lead wins.
//   3. The winning rule's strategy decides WHO inside the assignable pool gets it:
//        ROUND_ROBIN   — cycle through the pool one by one (fair share).
//        LOAD_BALANCED — pick the user with the fewest open (not BOOKED/LOST) leads.
//        SOURCE_BASED  — route leads from a specific source (to the rule's fixed
//                        assignee if set, otherwise least-loaded).
//        PROJECT_BASED — route leads interested in a specific project (same
//                        assignee/fallback behaviour as SOURCE_BASED).
//      A rule with an explicit `assigneeId` always wins over the strategy fallback.

import { z } from "zod";
import { db } from "@/server/db";
import { listAssignableUsers } from "@/server/auth/session";
import type { ServiceResult } from "@/server/modules/leads";
import {
  LEAD_SOURCES,
  type AssignmentRule,
  type DistributionStrategy,
  type Lead,
  type LeadSource,
  type User,
} from "@/types/domain";

export const DISTRIBUTION_STRATEGIES: DistributionStrategy[] = [
  "ROUND_ROBIN",
  "LOAD_BALANCED",
  "SOURCE_BASED",
  "PROJECT_BASED",
];

/** Human-readable strategy explanations, shared with the /distribution UI. */
export const STRATEGY_DESCRIPTIONS: Record<DistributionStrategy, string> = {
  ROUND_ROBIN:
    "Cycles through the assignable team one agent at a time, so everyone receives an equal share of incoming leads.",
  LOAD_BALANCED:
    "Always hands the lead to the agent carrying the fewest open leads, keeping workloads even when lead flow is bursty.",
  SOURCE_BASED:
    "Routes leads arriving from a specific source (e.g. Facebook, 99acres) to a dedicated owner or specialist pool.",
  PROJECT_BASED:
    "Routes leads interested in a specific project to the agent or team that owns that project.",
};

// ─── Rules CRUD ─────────────────────────────────────────────────────────────
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(3, "Rule name must be at least 3 characters"),
    strategy: z.enum(DISTRIBUTION_STRATEGIES as [DistributionStrategy, ...DistributionStrategy[]]),
    priority: z.preprocess(
      (v) => (v === "" || v == null ? 0 : Number(v)),
      z
        .number({ invalid_type_error: "Priority must be a number" })
        .int("Priority must be a whole number")
        .min(0, "Priority cannot be negative")
        .max(100, "Priority cannot exceed 100"),
    ),
    source: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]).optional(),
    ),
    projectId: optionalString,
    assigneeId: optionalString,
    active: z.boolean().default(true),
  })
  .superRefine((rule, ctx) => {
    // Strategy-specific requirements: conditional strategies need their condition.
    if (rule.strategy === "SOURCE_BASED" && !rule.source) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source-based rules need a lead source" });
    }
    if (rule.strategy === "PROJECT_BASED" && !rule.projectId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Project-based rules need a project" });
    }
  });

export interface RuleListItem extends AssignmentRule {
  project: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
}

export async function listRules(): Promise<RuleListItem[]> {
  const [rules, projects, users] = await Promise.all([
    db.assignmentRules.list(),
    db.projects.list(),
    db.users.list(),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));
  return rules
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({
      ...r,
      project: r.projectId ? (projectById.get(r.projectId) ?? null) : null,
      assignee: r.assigneeId ? (userById.get(r.assigneeId) ?? null) : null,
    }));
}

export async function createRule(input: unknown): Promise<ServiceResult<AssignmentRule>> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule" };
  }
  const rule = await db.assignmentRules.create({
    ...parsed.data,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, data: rule };
}

export async function toggleRule(id: string): Promise<ServiceResult<AssignmentRule>> {
  const rule = await db.assignmentRules.find(id);
  if (!rule) return { ok: false, error: "Rule not found" };
  const updated = await db.assignmentRules.update(id, { active: !rule.active });
  if (!updated) return { ok: false, error: "Rule not found" };
  return { ok: true, data: updated };
}

// ─── Auto-assignment engine ─────────────────────────────────────────────────
// Round-robin cursors are kept per rule so each rule cycles independently.
// Cached on globalThis to survive Next.js dev hot reloads (same trick as the db).
const globalForDist = globalThis as unknown as { __estateRrCursors?: Map<string, number> };
const rrCursors: Map<string, number> = globalForDist.__estateRrCursors ?? new Map();
globalForDist.__estateRrCursors = rrCursors;

/** Does this rule apply to this lead? Unset conditions match everything. */
function ruleMatches(rule: AssignmentRule, lead: Lead): boolean {
  switch (rule.strategy) {
    case "SOURCE_BASED":
      return rule.source != null && rule.source === lead.source;
    case "PROJECT_BASED":
      return rule.projectId != null && rule.projectId === lead.projectId;
    case "ROUND_ROBIN":
    case "LOAD_BALANCED":
      // Optional conditions narrow the rule; a bare rule is a catch-all.
      if (rule.source && rule.source !== lead.source) return false;
      if (rule.projectId && rule.projectId !== lead.projectId) return false;
      return true;
  }
}

/** Pick the pool member with the fewest open leads (stable on ties). */
function leastLoaded(pool: User[], openLeadCounts: Map<string, number>): User | null {
  let best: User | null = null;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const user of pool) {
    const count = openLeadCounts.get(user.id) ?? 0;
    if (count < bestCount) {
      best = user;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Pure resolution step: given a matched rule, decide who gets the lead.
 * Exported separately so it is unit-testable without touching the store.
 */
export function resolveAssignee(
  rule: AssignmentRule,
  pool: User[],
  openLeadCounts: Map<string, number>,
): User | null {
  if (pool.length === 0) return null;

  // An explicit assignee on the rule always wins, regardless of strategy.
  if (rule.assigneeId) {
    const fixed = pool.find((u) => u.id === rule.assigneeId);
    if (fixed) return fixed;
    // Fixed assignee is inactive/unassignable — fall through to the strategy.
  }

  switch (rule.strategy) {
    case "ROUND_ROBIN": {
      const cursor = rrCursors.get(rule.id) ?? 0;
      rrCursors.set(rule.id, cursor + 1);
      return pool[cursor % pool.length] ?? null;
    }
    case "LOAD_BALANCED":
    case "SOURCE_BASED":
    case "PROJECT_BASED":
      // Conditional strategies without a fixed assignee fall back to the
      // least-loaded member so nobody drowns.
      return leastLoaded(pool, openLeadCounts);
  }
}

export interface AssignmentOutcome {
  user: User;
  rule: AssignmentRule;
}

/**
 * Assign an owner to `lead` using the active rule set and persist the result.
 * Returns the chosen user + winning rule, or null when no rule matched or the
 * assignable pool is empty (the lead stays unassigned for manual triage).
 */
export async function autoAssign(lead: Lead): Promise<AssignmentOutcome | null> {
  const [rules, pool, allLeads] = await Promise.all([
    db.assignmentRules.list({ where: { active: true } }),
    listAssignableUsers(),
    db.leads.list(),
  ]);

  // Workload snapshot for LOAD_BALANCED: open = anything still in the pipeline.
  const openLeadCounts = new Map<string, number>();
  for (const l of allLeads) {
    if (!l.ownerId || l.status === "BOOKED" || l.status === "LOST") continue;
    openLeadCounts.set(l.ownerId, (openLeadCounts.get(l.ownerId) ?? 0) + 1);
  }

  const ordered = rules.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  for (const rule of ordered) {
    if (!ruleMatches(rule, lead)) continue;
    const user = resolveAssignee(rule, pool, openLeadCounts);
    if (!user) continue; // pool empty / fixed assignee unresolvable — try next rule

    await db.leads.update(lead.id, { ownerId: user.id, updatedAt: new Date().toISOString() });
    await db.activities.create({
      type: "NOTE",
      leadId: lead.id,
      subject: `Auto-assigned to ${user.name}`,
      body: `Matched rule "${rule.name}" (${rule.strategy.replace(/_/g, " ").toLowerCase()}, priority ${rule.priority}).`,
      completed: true,
      createdAt: new Date().toISOString(),
    });
    return { user, rule };
  }

  return null;
}

/**
 * Batch variant of autoAssign for bulk operations such as CSV import.
 *
 * autoAssign() re-reads the rule set, the assignable pool and every lead on
 * each call, which is fine for one lead and quadratic for a thousand. This
 * loads that context once and keeps the round-robin cursor and the
 * load-balancing counts moving across the batch, so an import spreads leads
 * the same way a stream of individual creates would.
 *
 * Returns a map of leadId → ownerId for the leads that matched a rule.
 */
export async function autoAssignMany(leads: Lead[]): Promise<Map<string, string>> {
  const assignments = new Map<string, string>();
  if (leads.length === 0) return assignments;

  const [rules, pool, allLeads] = await Promise.all([
    db.assignmentRules.list({ where: { active: true } }),
    listAssignableUsers(),
    db.leads.list(),
  ]);
  if (pool.length === 0) return assignments;

  const openLeadCounts = new Map<string, number>();
  for (const l of allLeads) {
    if (!l.ownerId || l.status === "BOOKED" || l.status === "LOST") continue;
    openLeadCounts.set(l.ownerId, (openLeadCounts.get(l.ownerId) ?? 0) + 1);
  }

  const ordered = rules
    .slice()
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

  for (const lead of leads) {
    for (const rule of ordered) {
      if (!ruleMatches(rule, lead)) continue;
      const user = resolveAssignee(rule, pool, openLeadCounts);
      if (!user) continue;

      assignments.set(lead.id, user.id);
      // Count this lead against the winner so the next iteration balances
      // against it, rather than handing the whole batch to one agent.
      openLeadCounts.set(user.id, (openLeadCounts.get(user.id) ?? 0) + 1);
      break;
    }
  }

  return assignments;
}
