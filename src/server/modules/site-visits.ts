// EstateCRM — site visits service.
// Scheduling, status transitions and feedback capture for project site visits.
// Visit transitions keep the owning lead's pipeline stage in sync (scheduling a
// visit advances early-stage leads; completing one moves them to SITE_VISIT_DONE).

import { z } from "zod";
import { db } from "@/server/db";
import { changeStatus, type ServiceResult } from "@/server/modules/leads";
import type {
  Lead,
  Project,
  SiteVisit,
  SiteVisitStatus,
  User,
} from "@/types/domain";

export const SITE_VISIT_STATUSES: SiteVisitStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

// ─── Validation ─────────────────────────────────────────────────────────────
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

export const visitInputSchema = z.object({
  leadId: z.string().min(1, "Pick a lead"),
  projectId: optionalString,
  agentId: optionalString,
  scheduledAt: z
    .string()
    .min(1, "Pick a date and time")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time")
    .transform((v) => new Date(v).toISOString()),
});

export type VisitInput = z.input<typeof visitInputSchema>;

// ─── Queries ────────────────────────────────────────────────────────────────
export interface SiteVisitFilter {
  status?: SiteVisitStatus;
  leadId?: string;
  agentId?: string;
  projectId?: string;
}

export interface SiteVisitListItem extends SiteVisit {
  lead: Lead | null;
  project: Project | null;
  agent: User | null;
}

export async function listSiteVisits(filter: SiteVisitFilter = {}): Promise<SiteVisitListItem[]> {
  const [visits, leads, projects, users] = await Promise.all([
    db.siteVisits.list({ orderBy: { field: "scheduledAt", dir: "asc" } }),
    db.leads.list(),
    db.projects.list(),
    db.users.list(),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return visits
    .filter((v) => {
      if (filter.status && v.status !== filter.status) return false;
      if (filter.leadId && v.leadId !== filter.leadId) return false;
      if (filter.agentId && v.agentId !== filter.agentId) return false;
      if (filter.projectId && v.projectId !== filter.projectId) return false;
      return true;
    })
    .map((v) => ({
      ...v,
      lead: leadById.get(v.leadId) ?? null,
      project: v.projectId ? (projectById.get(v.projectId) ?? null) : null,
      agent: v.agentId ? (userById.get(v.agentId) ?? null) : null,
    }));
}

// ─── Mutations ──────────────────────────────────────────────────────────────
export async function scheduleVisit(input: unknown, actorId?: string): Promise<ServiceResult<SiteVisit>> {
  const parsed = visitInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid site visit" };
  }
  const lead = await db.leads.find(parsed.data.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const visit = await db.siteVisits.create({
    ...parsed.data,
    // Default the visit to the lead's project / owner when not chosen explicitly.
    projectId: parsed.data.projectId ?? lead.projectId,
    agentId: parsed.data.agentId ?? lead.ownerId,
    status: "SCHEDULED",
    createdAt: new Date().toISOString(),
  });

  // Advance early-stage leads to SITE_VISIT_SCHEDULED (records a STATUS_CHANGE).
  if (["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status)) {
    await changeStatus(lead.id, "SITE_VISIT_SCHEDULED", undefined, actorId);
  }

  return { ok: true, data: visit };
}

export async function updateVisitStatus(
  id: string,
  status: SiteVisitStatus,
  actorId?: string,
): Promise<ServiceResult<SiteVisit>> {
  if (!SITE_VISIT_STATUSES.includes(status)) return { ok: false, error: "Invalid visit status" };
  const visit = await db.siteVisits.find(id);
  if (!visit) return { ok: false, error: "Site visit not found" };

  const updated = await db.siteVisits.update(id, { status });
  if (!updated) return { ok: false, error: "Site visit not found" };

  // Completing the visit moves a scheduled lead forward in the pipeline.
  if (status === "COMPLETED") {
    const lead = await db.leads.find(visit.leadId);
    if (lead && ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT_SCHEDULED"].includes(lead.status)) {
      await changeStatus(lead.id, "SITE_VISIT_DONE", undefined, actorId);
    }
  }

  return { ok: true, data: updated };
}

export async function addFeedback(id: string, feedback: string): Promise<ServiceResult<SiteVisit>> {
  const trimmed = feedback.trim();
  if (trimmed.length < 2) return { ok: false, error: "Feedback is too short" };
  const updated = await db.siteVisits.update(id, { feedback: trimmed });
  if (!updated) return { ok: false, error: "Site visit not found" };
  return { ok: true, data: updated };
}
