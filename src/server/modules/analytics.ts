// EstateCRM — analytics service.
// Cross-module aggregations consumed by the dashboard overview and the Reports module.

import { db } from "@/server/db";
import type { LeadSource, LeadStatus } from "@/types/domain";

export interface DashboardSummary {
  totalLeads: number;
  newLeadsThisWeek: number;
  activeLeads: number;
  bookedLeads: number;
  conversionRate: number; // %
  pipelineValue: number; // INR
  bookingValue: number; // INR
  availableUnits: number;
  upcomingSiteVisits: number;
  activeCampaigns: number;
}

const WEEK = 7 * 86_400_000;

/**
 * Restricts a list to the owners the viewer is allowed to see.
 *
 * `undefined` means no restriction (admins, heads, viewers). A SALES_AGENT
 * gets their own id and a SALES_MANAGER their team's, exactly as /leads,
 * /pipeline and /site-visits already scope their queries. Without this the
 * dashboard reported organisation-wide totals to every role.
 */
function scopeToOwners<T extends { ownerId?: string; agentId?: string }>(
  rows: T[],
  ownerIds?: string[],
): T[] {
  if (!ownerIds) return rows;
  const allowed = new Set(ownerIds);
  return rows.filter((r) => {
    const owner = r.ownerId ?? r.agentId;
    return owner != null && allowed.has(owner);
  });
}

export async function getDashboardSummary(ownerIds?: string[]): Promise<DashboardSummary> {
  const [allLeads, allBookings, units, allSiteVisits, campaigns] = await Promise.all([
    db.leads.list(),
    db.bookings.list(),
    db.units.list(),
    db.siteVisits.list(),
    db.campaigns.list(),
  ]);
  const leads = scopeToOwners(allLeads, ownerIds);
  const bookings = scopeToOwners(allBookings, ownerIds);
  const siteVisits = scopeToOwners(allSiteVisits, ownerIds);

  const now = Date.now();
  const newLeadsThisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() < WEEK).length;
  const bookedLeads = leads.filter((l) => l.status === "BOOKED").length;
  const lostLeads = leads.filter((l) => l.status === "LOST").length;
  const activeLeads = leads.length - bookedLeads - lostLeads;
  const closed = bookedLeads + lostLeads;

  const pipelineValue = leads
    .filter((l) => !["BOOKED", "LOST"].includes(l.status))
    .reduce((sum, l) => sum + (l.budgetMax ?? l.budgetMin ?? 0), 0);

  return {
    totalLeads: leads.length,
    newLeadsThisWeek,
    activeLeads,
    bookedLeads,
    conversionRate: closed ? Math.round((bookedLeads / closed) * 100) : 0,
    pipelineValue,
    bookingValue: bookings.reduce((sum, b) => sum + b.totalValue, 0),
    availableUnits: units.filter((u) => u.status === "AVAILABLE").length,
    upcomingSiteVisits: siteVisits.filter(
      (v) => new Date(v.scheduledAt).getTime() > now && ["SCHEDULED", "CONFIRMED"].includes(v.status),
    ).length,
    activeCampaigns: campaigns.filter((c) => ["RUNNING", "SCHEDULED"].includes(c.status)).length,
  };
}

export async function getLeadsByStatus(ownerIds?: string[]): Promise<{ status: LeadStatus; count: number }[]> {
  const leads = scopeToOwners(await db.leads.list(), ownerIds);
  const map = new Map<LeadStatus, number>();
  for (const l of leads) map.set(l.status, (map.get(l.status) ?? 0) + 1);
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

export async function getLeadsBySource(ownerIds?: string[]): Promise<{ source: LeadSource; count: number }[]> {
  const leads = scopeToOwners(await db.leads.list(), ownerIds);
  const map = new Map<LeadSource, number>();
  for (const l of leads) map.set(l.source, (map.get(l.source) ?? 0) + 1);
  return [...map.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

export interface AgentPerformance {
  userId: string;
  name: string;
  totalLeads: number;
  booked: number;
  siteVisits: number;
  conversionRate: number;
}

export async function getAgentLeaderboard(): Promise<AgentPerformance[]> {
  const [users, leads, siteVisits] = await Promise.all([
    db.users.list(),
    db.leads.list(),
    db.siteVisits.list(),
  ]);
  const agents = users.filter((u) => ["SALES_AGENT", "SALES_MANAGER"].includes(u.role));
  return agents
    .map((a) => {
      const own = leads.filter((l) => l.ownerId === a.id);
      const booked = own.filter((l) => l.status === "BOOKED").length;
      const visits = siteVisits.filter((v) => v.agentId === a.id).length;
      return {
        userId: a.id,
        name: a.name,
        totalLeads: own.length,
        booked,
        siteVisits: visits,
        conversionRate: own.length ? Math.round((booked / own.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.booked - a.booked);
}

/** Monthly lead vs booking trend for the last 6 months. */
export async function getMonthlyTrend(ownerIds?: string[]): Promise<{ month: string; leads: number; bookings: number }[]> {
  const [allLeads, allBookings] = await Promise.all([db.leads.list(), db.bookings.list()]);
  const leads = scopeToOwners(allLeads, ownerIds);
  const bookings = scopeToOwners(allBookings, ownerIds);
  const months: { key: string; label: string; leads: number; bookings: number }[] = [];
  // Six months ending with the current one. This was pinned to a hardcoded
  // June 2026 to match the old demo seed, which meant anything created after
  // that date fell outside the window and never appeared on the chart.
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-IN", { month: "short" }),
      leads: 0,
      bookings: 0,
    });
  }
  const bucket = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}`;
  };
  for (const l of leads) {
    const m = months.find((x) => x.key === bucket(l.createdAt));
    if (m) m.leads += 1;
  }
  for (const b of bookings) {
    const m = months.find((x) => x.key === bucket(b.bookedAt));
    if (m) m.bookings += 1;
  }
  return months.map(({ label, leads, bookings }) => ({ month: label, leads, bookings }));
}
