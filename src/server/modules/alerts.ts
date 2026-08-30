// EstateCRM — notification feed.
//
// The bell previously showed a permanently-lit red dot with nothing behind it.
// These alerts are derived from live data instead: things that are actually
// waiting on someone, each linking to where the work gets done. No alert store
// to keep in sync — if the underlying condition clears, the alert disappears.

import { db } from "@/server/db";
import { can } from "@/server/auth/rbac";
import { visibleOwnerIds } from "@/server/auth/guard";
import { teamMemberIds } from "@/server/modules/leads";
import type { User } from "@/types/domain";

export type AlertTone = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getAlerts(user: User): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = startOfToday();
  const endOfToday = new Date(today.getTime() + 86_400_000);

  if (can(user.role, "lead.read")) {
    const ownerScope = await visibleOwnerIds(user, () => teamMemberIds(user));
    const visible = (ownerId?: string) =>
      !ownerScope || (ownerId != null && ownerScope.includes(ownerId));

    // Unassigned leads — only meaningful to someone who can assign them.
    if (can(user.role, "lead.assign")) {
      const unassigned = (await db.leads.list()).filter((l) => !l.ownerId && l.status !== "LOST");
      if (unassigned.length > 0) {
        alerts.push({
          id: "leads-unassigned",
          tone: "warning",
          title: `${unassigned.length} unassigned lead${unassigned.length === 1 ? "" : "s"}`,
          detail: "No owner yet — assign them or add a distribution rule.",
          href: "/leads?ownerId=__none__",
        });
      }
    }

    // Site visits happening today.
    const visitsToday = (await db.siteVisits.list()).filter((v) => {
      if (v.status !== "SCHEDULED" && v.status !== "CONFIRMED") return false;
      if (!visible(v.agentId)) return false;
      const at = new Date(v.scheduledAt);
      return at >= today && at < endOfToday;
    });
    if (visitsToday.length > 0) {
      alerts.push({
        id: "visits-today",
        tone: "info",
        title: `${visitsToday.length} site visit${visitsToday.length === 1 ? "" : "s"} today`,
        detail: "Confirm attendance and capture feedback afterwards.",
        href: "/site-visits",
      });
    }

    // Visits whose slot has passed but were never closed out.
    const stale = (await db.siteVisits.list()).filter((v) => {
      if (v.status !== "SCHEDULED" && v.status !== "CONFIRMED") return false;
      if (!visible(v.agentId)) return false;
      return new Date(v.scheduledAt) < today;
    });
    if (stale.length > 0) {
      alerts.push({
        id: "visits-stale",
        tone: "warning",
        title: `${stale.length} past visit${stale.length === 1 ? "" : "s"} not closed`,
        detail: "Mark them completed or as a no-show so reporting stays accurate.",
        href: "/site-visits",
      });
    }

    // Follow-up tasks that are overdue.
    const overdueTasks = (await db.activities.list()).filter((a) => {
      if (a.completed || !a.dueAt) return false;
      if (!visible(a.userId)) return false;
      return new Date(a.dueAt) < now;
    });
    if (overdueTasks.length > 0) {
      alerts.push({
        id: "tasks-overdue",
        tone: "warning",
        title: `${overdueTasks.length} overdue follow-up${overdueTasks.length === 1 ? "" : "s"}`,
        detail: "Tasks past their due date.",
        href: "/leads",
      });
    }
  }

  // Overdue payment milestones.
  if (can(user.role, "booking.read")) {
    const overdue = (await db.payments.list()).filter(
      (p) => p.status !== "PAID" && new Date(p.dueDate) < now,
    );
    if (overdue.length > 0) {
      alerts.push({
        id: "payments-overdue",
        tone: "critical",
        title: `${overdue.length} overdue payment milestone${overdue.length === 1 ? "" : "s"}`,
        detail: "Collections past their due date.",
        href: "/bookings",
      });
    }
  }

  // Channel partners waiting on KYC approval.
  if (can(user.role, "partner.write")) {
    const pending = await db.channelPartners.count({ status: "PENDING" });
    if (pending > 0) {
      alerts.push({
        id: "partners-pending",
        tone: "info",
        title: `${pending} partner${pending === 1 ? "" : "s"} awaiting approval`,
        detail: "Review KYC details and approve or suspend.",
        href: "/channel-partners?status=PENDING",
      });
    }
  }

  return alerts;
}
