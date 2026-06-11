// EstateCRM — /site-visits. Upcoming and past project visits with scheduling,
// status transitions (confirm / complete / no-show / cancel) and feedback.

import Link from "next/link";
import { CalendarCheck, CalendarClock, CheckCircle2, UserX } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VisitActions } from "@/components/leads/visit-actions";
import { VisitForm } from "@/components/leads/visit-form";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { getLeadFormOptions, listLeads } from "@/server/modules/leads";
import { listSiteVisits, type SiteVisitListItem } from "@/server/modules/site-visits";
import { formatDateTime, humanize } from "@/lib/utils";

function VisitTable({ visits, canWrite }: { visits: SiteVisitListItem[]; canWrite: boolean }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date &amp; Time</TH>
          <TH>Lead</TH>
          <TH>Project</TH>
          <TH>Agent</TH>
          <TH>Status</TH>
          <TH>Feedback</TH>
          {canWrite ? <TH>Actions</TH> : null}
        </TR>
      </THead>
      <TBody>
        {visits.map((visit) => (
          <TR key={visit.id}>
            <TD className="whitespace-nowrap font-medium">{formatDateTime(visit.scheduledAt)}</TD>
            <TD>
              {visit.lead ? (
                <Link href={`/leads/${visit.lead.id}`} className="hover:underline">
                  <span className="font-medium">{visit.lead.name}</span>
                  <span className="block text-xs text-muted-foreground">{visit.lead.phone}</span>
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TD>
            <TD className="text-muted-foreground">{visit.project?.name ?? "—"}</TD>
            <TD>
              {visit.agent ? (
                <span className="flex items-center gap-2">
                  <Avatar name={visit.agent.name} className="h-6 w-6 text-[10px]" />
                  <span className="whitespace-nowrap text-xs">{visit.agent.name}</span>
                </span>
              ) : (
                <span className="text-xs italic text-muted-foreground">Unassigned</span>
              )}
            </TD>
            <TD>
              <Badge tone={statusTone(visit.status)}>{humanize(visit.status)}</Badge>
            </TD>
            <TD className="max-w-52 text-xs text-muted-foreground">
              {visit.feedback ? `“${visit.feedback}”` : "—"}
            </TD>
            {canWrite ? (
              <TD>
                <VisitActions visitId={visit.id} status={visit.status} feedback={visit.feedback} />
              </TD>
            ) : null}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default async function SiteVisitsPage() {
  const [user, visits, leads, options] = await Promise.all([
    getCurrentUser(),
    listSiteVisits(),
    listLeads(),
    getLeadFormOptions(),
  ]);
  const canWrite = can(user.role, "lead.write");

  const now = Date.now();
  const isOpen = (v: SiteVisitListItem) => ["SCHEDULED", "CONFIRMED"].includes(v.status);
  // Upcoming = still actionable; everything else (done, missed, cancelled, overdue) is history.
  const upcoming = visits.filter((v) => isOpen(v) && new Date(v.scheduledAt).getTime() >= now);
  const past = visits
    .filter((v) => !isOpen(v) || new Date(v.scheduledAt).getTime() < now)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  const completed = visits.filter((v) => v.status === "COMPLETED").length;
  const noShows = visits.filter((v) => v.status === "NO_SHOW").length;

  const schedulableLeads = leads
    .filter((l) => l.status !== "LOST")
    .map((l) => ({ id: l.id, name: `${l.name} (${l.phone})` }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Visits"
        description="Schedule, confirm and capture feedback for project site visits."
        actions={
          canWrite ? undefined : <Badge tone="muted">Read-only access</Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Visits" value={visits.length.toString()} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Upcoming" value={upcoming.length.toString()} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Completed" value={completed.toString()} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="No-shows" value={noShows.toString()} icon={<UserX className="h-5 w-5" />} />
      </div>

      {canWrite ? (
        <VisitForm
          leads={schedulableLeads}
          projects={options.projects.map((p) => ({ id: p.id, name: p.name }))}
          agents={options.owners.map((o) => ({ id: o.id, name: o.name }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Visits</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming visits"
              description="Schedule a site visit to fill the calendar."
              icon={<CalendarClock className="h-8 w-8" />}
            />
          ) : (
            <VisitTable visits={upcoming} canWrite={canWrite} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past &amp; Closed Visits</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {past.length === 0 ? (
            <EmptyState
              title="No visit history"
              description="Completed, missed and cancelled visits will appear here."
              icon={<CalendarCheck className="h-8 w-8" />}
            />
          ) : (
            <VisitTable visits={past} canWrite={canWrite} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
