// What one person has to do today.
//
// The dashboard answers "how is the business doing". A customer-care executive
// signing in at 9am needs a different question answered: who do I call first.
// This module derives that from live data — no queue table to keep in sync, so
// an item disappears the moment the work behind it is done.
//
// Every section is scoped by ownership: an agent sees their own work, a manager
// sees their team's, and an admin sees everyone's.

import { db } from "@/server/db";
import { visibleOwnerIds } from "@/server/auth/guard";
import { teamMemberIds } from "@/server/modules/leads";
import type { Activity, Lead, SiteVisit, User } from "@/types/domain";

/** Activity types that count as having actually reached out to someone. */
const CONTACT_TYPES = new Set(["CALL", "EMAIL", "WHATSAPP", "SMS", "MEETING"]);

/** A lead with no contact for this long is going cold. */
const COLD_AFTER_DAYS = 7;

export interface AgendaVisit {
  visit: SiteVisit;
  lead?: Lead;
  projectName?: string;
  /** "10:30" — local time of the appointment. */
  at: string;
  overdue: boolean;
}

export interface AgendaTask {
  activity: Activity;
  lead?: Lead;
  overdue: boolean;
}

export interface AgendaLead {
  lead: Lead;
  /** Days since the last contact, or since arrival when never contacted. */
  waitingDays: number;
}

export interface DailyAgenda {
  /** Whose day this is; a manager's agenda spans their team. */
  scope: "mine" | "team" | "everyone";
  greetingName: string;
  /** Site visits scheduled for today, plus any left open from earlier. */
  visits: AgendaVisit[];
  /** Follow-ups due today or already overdue, oldest first. */
  tasks: AgendaTask[];
  /** Assigned but never contacted — the first calls of the day. */
  newLeads: AgendaLead[];
  /** In play, but nobody has touched them in a week. */
  goingCold: AgendaLead[];
  /** Leads with no owner at all. Only populated for someone who can assign. */
  unassigned: number;
  counts: {
    visitsToday: number;
    visitsOverdue: number;
    tasksDue: number;
    tasksOverdue: number;
    newLeads: number;
    goingCold: number;
  };
  /** True when there is genuinely nothing waiting. */
  clear: boolean;
}

const startOfToday = (now: Date) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));

/** How many caps a list before the page becomes a wall of rows. */
const LIST_CAP = 12;

export async function getDailyAgenda(user: User, now = new Date()): Promise<DailyAgenda> {
  const today = startOfToday(now);
  const endOfToday = new Date(today.getTime() + 86_400_000);
  const coldBefore = new Date(now.getTime() - COLD_AFTER_DAYS * 86_400_000);

  const ownerScope = await visibleOwnerIds(user, () => teamMemberIds(user));
  // undefined means "no restriction" — an admin or head sees everything.
  const owns = (ownerId?: string) =>
    ownerScope === undefined ? true : ownerId != null && ownerScope.includes(ownerId);

  const [leads, visits, activities, projects] = await Promise.all([
    db.leads.list(),
    db.siteVisits.list(),
    db.activities.list(),
    db.projects.list(),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  // Last contact per lead, so "never called" and "going cold" are one pass.
  const lastContact = new Map<string, number>();
  for (const a of activities) {
    if (!CONTACT_TYPES.has(a.type)) continue;
    const at = new Date(a.createdAt).getTime();
    const prev = lastContact.get(a.leadId);
    if (prev == null || at > prev) lastContact.set(a.leadId, at);
  }

  // ── Site visits ──────────────────────────────────────────────────────────
  const agendaVisits: AgendaVisit[] = visits
    .filter((v) => {
      if (v.status !== "SCHEDULED" && v.status !== "CONFIRMED") return false;
      if (!owns(v.agentId)) return false;
      return new Date(v.scheduledAt) < endOfToday;
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((visit) => {
      const at = new Date(visit.scheduledAt);
      return {
        visit,
        lead: leadById.get(visit.leadId),
        projectName: visit.projectId ? projectName.get(visit.projectId) : undefined,
        at: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        overdue: at < today,
      };
    });

  // ── Follow-up tasks ──────────────────────────────────────────────────────
  const agendaTasks: AgendaTask[] = activities
    .filter((a) => {
      if (a.completed || !a.dueAt) return false;
      if (!owns(a.userId)) return false;
      return new Date(a.dueAt) < endOfToday;
    })
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .map((activity) => ({
      activity,
      lead: leadById.get(activity.leadId),
      overdue: new Date(activity.dueAt!) < now,
    }));

  // ── Leads needing a first call ───────────────────────────────────────────
  const mine = leads.filter((l) => owns(l.ownerId) && l.status !== "LOST" && l.status !== "BOOKED");

  const newLeads: AgendaLead[] = mine
    .filter((l) => !lastContact.has(l.id))
    .map((lead) => ({ lead, waitingDays: daysBetween(new Date(lead.createdAt), now) }))
    // Longest wait first: a lead that has sat for three days is more urgent
    // than one that arrived an hour ago, and the score breaks the tie.
    .sort((a, b) => b.waitingDays - a.waitingDays || b.lead.score - a.lead.score);

  const goingCold: AgendaLead[] = mine
    .filter((l) => {
      const last = lastContact.get(l.id);
      return last != null && last < coldBefore.getTime();
    })
    .map((lead) => ({
      lead,
      waitingDays: daysBetween(new Date(lastContact.get(lead.id)!), now),
    }))
    .sort((a, b) => b.waitingDays - a.waitingDays);

  const unassigned = leads.filter((l) => !l.ownerId && l.status !== "LOST").length;

  const counts = {
    visitsToday: agendaVisits.filter((v) => !v.overdue).length,
    visitsOverdue: agendaVisits.filter((v) => v.overdue).length,
    tasksDue: agendaTasks.filter((t) => !t.overdue).length,
    tasksOverdue: agendaTasks.filter((t) => t.overdue).length,
    newLeads: newLeads.length,
    goingCold: goingCold.length,
  };

  return {
    scope: ownerScope === undefined ? "everyone" : ownerScope.length > 1 ? "team" : "mine",
    greetingName: user.name.split(" ")[0] ?? user.name,
    visits: agendaVisits.slice(0, LIST_CAP),
    tasks: agendaTasks.slice(0, LIST_CAP),
    newLeads: newLeads.slice(0, LIST_CAP),
    goingCold: goingCold.slice(0, LIST_CAP),
    unassigned,
    counts,
    clear:
      agendaVisits.length === 0 &&
      agendaTasks.length === 0 &&
      newLeads.length === 0 &&
      goingCold.length === 0,
  };
}

/** "Good morning" / "Good afternoon" / "Good evening", in IST-ish local time. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
