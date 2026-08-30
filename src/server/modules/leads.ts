// EstateCRM — leads service.
// All lead reads/writes go through here. Pages and server actions never touch
// the db singleton for lead data directly, so business rules (scoring, status
// transitions, activity logging) live in exactly one place.

import { z } from "zod";
import { db } from "@/server/db";
import { visibleOwnerIds } from "@/server/auth/guard";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type Activity,
  type ActivityType,
  type Lead,
  type LeadSource,
  type LeadStatus,
  type LeadTemperature,
  type Project,
  type SiteVisit,
  type User,
} from "@/types/domain";

// ─── Shared result type ─────────────────────────────────────────────────────
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const LEAD_TEMPERATURES: LeadTemperature[] = ["HOT", "WARM", "COLD"];

/** Activity types a user may log manually (STATUS_CHANGE is system-generated). */
export const LOGGABLE_ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "MEETING",
  "TASK",
] as const satisfies readonly ActivityType[];

/** Activity types that count as "contact made" and bump lastContactAt. */
const CONTACT_TYPES: ActivityType[] = ["CALL", "EMAIL", "SMS", "WHATSAPP", "MEETING"];

// ─── Validation schemas ─────────────────────────────────────────────────────
/** "" → undefined so empty <select>/<input> values behave as "not provided". */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const optionalAmount = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z
    .number({ invalid_type_error: "Budget must be a number" })
    .nonnegative("Budget cannot be negative")
    .optional(),
);

export const leadInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().trim().min(8, "Enter a valid phone number"),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email("Enter a valid email").optional(),
  ),
  status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]).default("NEW"),
  source: z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]).default("OTHER"),
  temperature: z.enum(["HOT", "WARM", "COLD"]).default("WARM"),
  budgetMin: optionalAmount,
  budgetMax: optionalAmount,
  requirement: optionalString,
  projectId: optionalString,
  ownerId: optionalString,
  channelPartnerId: optionalString,
  campaignId: optionalString,
  tags: z.array(z.string()).default([]),
});

export type LeadInput = z.input<typeof leadInputSchema>;

export const activityInputSchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  subject: z.string().trim().min(2, "Subject must be at least 2 characters"),
  body: optionalString,
  outcome: optionalString,
  dueAt: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
      .transform((v) => new Date(v).toISOString())
      .optional(),
  ),
  completed: z.boolean().default(true),
});

export type ActivityInput = z.input<typeof activityInputSchema>;

// ─── Scoring ────────────────────────────────────────────────────────────────
/**
 * Deterministic 0–100 lead score.
 * Weighted blend of temperature (40), pipeline stage (30), source intent (15),
 * declared budget (10) and contact recency (5).
 */
export function computeLeadScore(
  lead: Pick<Lead, "temperature" | "status" | "source" | "budgetMin" | "budgetMax" | "lastContactAt">,
): number {
  let score = 0;

  // 1. Temperature — the strongest human-curated signal.
  score += lead.temperature === "HOT" ? 40 : lead.temperature === "WARM" ? 25 : 10;

  // 2. Pipeline progression — further along means more likely to convert.
  const stageWeight: Record<LeadStatus, number> = {
    NEW: 2,
    CONTACTED: 6,
    QUALIFIED: 12,
    SITE_VISIT_SCHEDULED: 18,
    SITE_VISIT_DONE: 24,
    NEGOTIATION: 30,
    BOOKED: 30,
    LOST: 0,
  };
  score += stageWeight[lead.status];

  // 3. Source intent — walk-ins and referrals close far more often than cold portals.
  const highIntent: LeadSource[] = ["WALK_IN", "REFERRAL", "CHANNEL_PARTNER"];
  const midIntent: LeadSource[] = ["WEBSITE", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING"];
  score += highIntent.includes(lead.source) ? 15 : midIntent.includes(lead.source) ? 10 : 5;

  // 4. Declared budget — a stated budget signals a serious buyer.
  const budget = lead.budgetMax ?? lead.budgetMin ?? 0;
  score += budget >= 20_000_000 ? 10 : budget >= 10_000_000 ? 8 : budget > 0 ? 5 : 0;

  // 5. Contact recency — engagement decays.
  if (lead.lastContactAt) {
    const days = (Date.now() - new Date(lead.lastContactAt).getTime()) / 86_400_000;
    score += days <= 3 ? 5 : days <= 14 ? 3 : 1;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Sentinel accepted in the ownerId filter to mean "leads with no owner". */
export const UNASSIGNED = "__none__";

export interface LeadFilters {
  status?: LeadStatus;
  source?: LeadSource;
  temperature?: LeadTemperature;
  /** User-chosen filter. Pass UNASSIGNED for leads with no owner. */
  ownerId?: string;
  search?: string;
  /**
   * Server-imposed row-level scope. When set, only leads owned by one of these
   * ids are returned, whatever `ownerId` asks for. Callers get this from
   * `visibleOwnerIds()`; it is never derived from user input.
   */
  ownerScope?: string[];
}

export interface LeadListItem extends Lead {
  owner: User | null;
  project: Project | null;
}

/** The set of user ids a manager may see: their team, plus themselves. */
export async function teamMemberIds(user: User): Promise<string[]> {
  if (!user.teamId) return [user.id];
  const users = await db.users.list({ where: { teamId: user.teamId } });
  return [...new Set([user.id, ...users.map((u) => u.id)])];
}

export async function listLeads(filters: LeadFilters = {}): Promise<LeadListItem[]> {
  const [leads, users, projects] = await Promise.all([
    db.leads.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    db.users.list(),
    db.projects.list(),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const q = filters.search?.trim().toLowerCase();

  return leads
    .filter((l) => {
      // Row-level scope first — it outranks every user-supplied filter.
      if (filters.ownerScope && !(l.ownerId != null && filters.ownerScope.includes(l.ownerId))) {
        return false;
      }
      if (filters.status && l.status !== filters.status) return false;
      if (filters.source && l.source !== filters.source) return false;
      if (filters.temperature && l.temperature !== filters.temperature) return false;
      if (filters.ownerId === UNASSIGNED) {
        if (l.ownerId) return false;
      } else if (filters.ownerId && l.ownerId !== filters.ownerId) {
        return false;
      }
      if (q) {
        const haystack = `${l.name} ${l.phone} ${l.email ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .map((l) => ({
      ...l,
      owner: l.ownerId ? (userById.get(l.ownerId) ?? null) : null,
      project: l.projectId ? (projectById.get(l.projectId) ?? null) : null,
    }));
}

/** True when `user` is allowed to open this specific lead. */
export async function canViewLead(user: User, lead: Lead): Promise<boolean> {
  const scope = await visibleOwnerIds(user, () => teamMemberIds(user));
  if (!scope) return true;
  return lead.ownerId != null && scope.includes(lead.ownerId);
}

export async function getLead(id: string): Promise<Lead | null> {
  return db.leads.find(id);
}

export interface LeadDetail {
  lead: Lead;
  activities: Activity[]; // newest first
  siteVisits: SiteVisit[]; // soonest first
  owner: User | null;
  project: Project | null;
  activityUsers: Map<string, User>;
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const lead = await db.leads.find(id);
  if (!lead) return null;

  const [activities, siteVisits, users, project] = await Promise.all([
    db.activities.list({ where: { leadId: id }, orderBy: { field: "createdAt", dir: "desc" } }),
    db.siteVisits.list({ where: { leadId: id }, orderBy: { field: "scheduledAt", dir: "asc" } }),
    db.users.list(),
    lead.projectId ? db.projects.find(lead.projectId) : Promise.resolve(null),
  ]);

  const activityUsers = new Map(users.map((u) => [u.id, u]));
  return {
    lead,
    activities,
    siteVisits,
    owner: lead.ownerId ? (activityUsers.get(lead.ownerId) ?? null) : null,
    project,
    activityUsers,
  };
}

/** Option lists shared by lead forms (projects + assignable owners). */
export async function getLeadFormOptions(): Promise<{
  projects: Project[];
  owners: User[];
}> {
  const [projects, users] = await Promise.all([db.projects.list(), db.users.list()]);
  return {
    projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
    owners: users.filter((u) => u.active && ["SALES_AGENT", "SALES_MANAGER", "SALES_HEAD"].includes(u.role)),
  };
}

// ─── Mutations ──────────────────────────────────────────────────────────────
export async function createLead(input: unknown): Promise<ServiceResult<Lead>> {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lead data" };
  }
  const now = new Date().toISOString();
  const data = parsed.data;
  if (data.budgetMin != null && data.budgetMax != null && data.budgetMax < data.budgetMin) {
    return { ok: false, error: "Max budget cannot be lower than min budget" };
  }
  const lead = await db.leads.create({
    ...data,
    score: computeLeadScore({ ...data, budgetMin: data.budgetMin, budgetMax: data.budgetMax }),
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, data: lead };
}

export async function updateLead(id: string, patch: unknown): Promise<ServiceResult<Lead>> {
  const parsed = leadInputSchema.partial().safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lead data" };
  }
  const existing = await db.leads.find(id);
  if (!existing) return { ok: false, error: "Lead not found" };

  const merged = { ...existing, ...parsed.data };
  const updated = await db.leads.update(id, {
    ...parsed.data,
    score: computeLeadScore(merged),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, error: "Lead not found" };
  return { ok: true, data: updated };
}

/**
 * Transition a lead's pipeline stage and record a STATUS_CHANGE activity so the
 * timeline is a complete audit trail. `lostReason` is stored when moving to
 * LOST and cleared on any other transition.
 */
export async function changeStatus(
  id: string,
  status: LeadStatus,
  lostReason?: string,
  actorId?: string,
): Promise<ServiceResult<Lead>> {
  if (!LEAD_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
  const lead = await db.leads.find(id);
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.status === status) return { ok: true, data: lead };

  const updated = await db.leads.update(id, {
    status,
    lostReason: status === "LOST" ? (lostReason?.trim() || "Not specified") : undefined,
    score: computeLeadScore({ ...lead, status }),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, error: "Lead not found" };

  await db.activities.create({
    type: "STATUS_CHANGE",
    leadId: id,
    userId: actorId,
    subject: `Status changed: ${lead.status} → ${status}`,
    body: status === "LOST" && lostReason ? `Lost reason: ${lostReason}` : undefined,
    completed: true,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, data: updated };
}

export async function addActivity(
  leadId: string,
  input: unknown,
  actorId?: string,
): Promise<ServiceResult<Activity>> {
  const parsed = activityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid activity" };
  }
  const lead = await db.leads.find(leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const activity = await db.activities.create({
    ...parsed.data,
    leadId,
    userId: actorId,
    createdAt: new Date().toISOString(),
  });

  // Outbound touches refresh lastContactAt (which feeds the score's recency factor).
  if (CONTACT_TYPES.includes(parsed.data.type)) {
    const lastContactAt = new Date().toISOString();
    await db.leads.update(leadId, {
      lastContactAt,
      score: computeLeadScore({ ...lead, lastContactAt }),
      updatedAt: lastContactAt,
    });
  }

  return { ok: true, data: activity };
}
