// EstateCRM — reports service.
// Executive-grade aggregations for the Reports hub. Reuses the analytics module
// where possible and layers richer funnel / source / project / revenue / team
// breakdowns on top of the shared DataStore.

import { db } from "@/server/db";
import {
  getAgentLeaderboard,
  type AgentPerformance,
} from "@/server/modules/analytics";
import {
  LEAD_STATUSES,
  type LeadSource,
  type LeadStatus,
  type ProjectStatus,
} from "@/types/domain";

const OPEN_STATUSES: LeadStatus[] = LEAD_STATUSES.filter(
  (s) => s !== "BOOKED" && s !== "LOST",
);

function pct(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

// ─── Sales funnel ────────────────────────────────────────────────────────────

export interface FunnelStage {
  stage: LeadStatus;
  /** Leads currently sitting at this stage. */
  atStage: number;
  /** Leads at this stage or any later stage (i.e. that progressed this far). */
  reached: number;
  /** % of leads from the previous stage that did NOT progress to this one. */
  dropOffPct: number;
  /** % of total funnel volume that reached this stage. */
  reachPct: number;
}

export interface SalesFunnelReport {
  stages: FunnelStage[];
  totalLeads: number;
  lostLeads: number;
  bookedLeads: number;
  overallConversionPct: number;
}

export async function getSalesFunnelReport(): Promise<SalesFunnelReport> {
  const leads = await db.leads.list();
  const funnelOrder: LeadStatus[] = LEAD_STATUSES.filter((s) => s !== "LOST");

  const atStage = new Map<LeadStatus, number>();
  for (const stage of funnelOrder) atStage.set(stage, 0);
  let lostLeads = 0;
  for (const lead of leads) {
    if (lead.status === "LOST") {
      lostLeads += 1;
    } else {
      atStage.set(lead.status, (atStage.get(lead.status) ?? 0) + 1);
    }
  }

  // Cumulative "reached" counts from the bottom of the funnel up.
  const reached: number[] = new Array<number>(funnelOrder.length).fill(0);
  let running = 0;
  for (let i = funnelOrder.length - 1; i >= 0; i--) {
    const stage = funnelOrder[i];
    running += stage ? atStage.get(stage) ?? 0 : 0;
    reached[i] = running;
  }

  const top = reached[0] ?? 0;
  const stages: FunnelStage[] = funnelOrder.map((stage, i) => {
    const reachedHere = reached[i] ?? 0;
    const reachedPrev = i === 0 ? reachedHere : reached[i - 1] ?? 0;
    return {
      stage,
      atStage: atStage.get(stage) ?? 0,
      reached: reachedHere,
      dropOffPct: i === 0 ? 0 : Math.max(0, 100 - pct(reachedHere, reachedPrev)),
      reachPct: pct(reachedHere, top),
    };
  });

  const bookedLeads = atStage.get("BOOKED") ?? 0;
  return {
    stages,
    totalLeads: leads.length,
    lostLeads,
    bookedLeads,
    overallConversionPct: pct(bookedLeads, leads.length),
  };
}

// ─── Source performance ──────────────────────────────────────────────────────

export interface SourcePerformance {
  source: LeadSource;
  leads: number;
  booked: number;
  lost: number;
  conversionPct: number;
  pipelineValue: number;
  bookingValue: number;
}

export async function getSourcePerformance(): Promise<SourcePerformance[]> {
  const [leads, bookings] = await Promise.all([db.leads.list(), db.bookings.list()]);
  const leadSourceById = new Map(leads.map((l) => [l.id, l.source]));

  const bookingValueBySource = new Map<LeadSource, number>();
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    const source = leadSourceById.get(b.leadId);
    if (!source) continue;
    bookingValueBySource.set(source, (bookingValueBySource.get(source) ?? 0) + b.totalValue);
  }

  const rows = new Map<LeadSource, SourcePerformance>();
  for (const lead of leads) {
    let row = rows.get(lead.source);
    if (!row) {
      row = {
        source: lead.source,
        leads: 0,
        booked: 0,
        lost: 0,
        conversionPct: 0,
        pipelineValue: 0,
        bookingValue: bookingValueBySource.get(lead.source) ?? 0,
      };
      rows.set(lead.source, row);
    }
    row.leads += 1;
    if (lead.status === "BOOKED") row.booked += 1;
    if (lead.status === "LOST") row.lost += 1;
    if (OPEN_STATUSES.includes(lead.status)) {
      row.pipelineValue += lead.budgetMax ?? lead.budgetMin ?? 0;
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, conversionPct: pct(row.booked, row.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

// ─── Project performance ─────────────────────────────────────────────────────

export interface ProjectPerformance {
  projectId: string;
  name: string;
  city: string;
  status: ProjectStatus;
  leads: number;
  siteVisits: number;
  siteVisitsDone: number;
  bookings: number;
  bookingValue: number;
  availableUnits: number;
}

export async function getProjectPerformance(): Promise<ProjectPerformance[]> {
  const [projects, leads, siteVisits, bookings, units] = await Promise.all([
    db.projects.list(),
    db.leads.list(),
    db.siteVisits.list(),
    db.bookings.list(),
    db.units.list(),
  ]);

  return projects
    .map((p) => {
      const projectBookings = bookings.filter(
        (b) => b.projectId === p.id && b.status !== "CANCELLED",
      );
      const visits = siteVisits.filter((v) => v.projectId === p.id);
      return {
        projectId: p.id,
        name: p.name,
        city: p.city,
        status: p.status,
        leads: leads.filter((l) => l.projectId === p.id).length,
        siteVisits: visits.length,
        siteVisitsDone: visits.filter((v) => v.status === "COMPLETED").length,
        bookings: projectBookings.length,
        bookingValue: projectBookings.reduce((sum, b) => sum + b.totalValue, 0),
        availableUnits: units.filter((u) => u.projectId === p.id && u.status === "AVAILABLE").length,
      };
    })
    .sort((a, b) => b.bookingValue - a.bookingValue);
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface RevenueReport {
  monthly: { month: string; value: number; bookings: number }[];
  byProject: { projectId: string; name: string; bookings: number; value: number }[];
  totalValue: number;
  totalBookings: number;
  avgBookingValue: number;
}

export async function getRevenueReport(): Promise<RevenueReport> {
  const [bookings, projects] = await Promise.all([db.bookings.list(), db.projects.list()]);
  const confirmed = bookings.filter((b) => b.status !== "CANCELLED");

  // Last 6 calendar months including the current one.
  const now = new Date();
  const months: { key: string; month: string; value: number; bookings: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleString("en-IN", { month: "short" }),
      value: 0,
      bookings: 0,
    });
  }
  for (const b of confirmed) {
    const d = new Date(b.bookedAt);
    const bucket = months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) {
      bucket.value += b.totalValue;
      bucket.bookings += 1;
    }
  }

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const byProjectMap = new Map<string, { projectId: string; name: string; bookings: number; value: number }>();
  for (const b of confirmed) {
    let row = byProjectMap.get(b.projectId);
    if (!row) {
      row = {
        projectId: b.projectId,
        name: projectNameById.get(b.projectId) ?? "Unknown project",
        bookings: 0,
        value: 0,
      };
      byProjectMap.set(b.projectId, row);
    }
    row.bookings += 1;
    row.value += b.totalValue;
  }

  const totalValue = confirmed.reduce((sum, b) => sum + b.totalValue, 0);
  return {
    monthly: months.map(({ month, value, bookings }) => ({ month, value, bookings })),
    byProject: [...byProjectMap.values()].sort((a, b) => b.value - a.value),
    totalValue,
    totalBookings: confirmed.length,
    avgBookingValue: confirmed.length ? Math.round(totalValue / confirmed.length) : 0,
  };
}

// ─── Team report ─────────────────────────────────────────────────────────────

export interface TeamMemberReport extends AgentPerformance {
  teamName: string;
  bookingValue: number;
}

export interface TeamSummary {
  teamId: string;
  name: string;
  region?: string;
  members: number;
  leads: number;
  booked: number;
  bookingValue: number;
  conversionPct: number;
}

export interface TeamReport {
  agents: TeamMemberReport[];
  teams: TeamSummary[];
}

export async function getTeamReport(): Promise<TeamReport> {
  const [leaderboard, users, teams, bookings] = await Promise.all([
    getAgentLeaderboard(),
    db.users.list(),
    db.teams.list(),
    db.bookings.list(),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const confirmed = bookings.filter((b) => b.status !== "CANCELLED");

  const bookingValueByAgent = new Map<string, number>();
  for (const b of confirmed) {
    if (!b.agentId) continue;
    bookingValueByAgent.set(b.agentId, (bookingValueByAgent.get(b.agentId) ?? 0) + b.totalValue);
  }

  const agents: TeamMemberReport[] = leaderboard.map((a) => {
    const teamId = userById.get(a.userId)?.teamId;
    return {
      ...a,
      teamName: teamId ? teamById.get(teamId)?.name ?? "Unassigned" : "Unassigned",
      bookingValue: bookingValueByAgent.get(a.userId) ?? 0,
    };
  });

  const teamSummaries: TeamSummary[] = teams
    .map((team) => {
      const memberIds = new Set(users.filter((u) => u.teamId === team.id).map((u) => u.id));
      const memberRows = leaderboard.filter((a) => memberIds.has(a.userId));
      const leadsCount = memberRows.reduce((sum, a) => sum + a.totalLeads, 0);
      const booked = memberRows.reduce((sum, a) => sum + a.booked, 0);
      const bookingValue = [...memberIds].reduce(
        (sum, id) => sum + (bookingValueByAgent.get(id) ?? 0),
        0,
      );
      return {
        teamId: team.id,
        name: team.name,
        region: team.region,
        members: memberIds.size,
        leads: leadsCount,
        booked,
        bookingValue,
        conversionPct: pct(booked, leadsCount),
      };
    })
    .sort((a, b) => b.bookingValue - a.bookingValue);

  return { agents, teams: teamSummaries };
}
