// EstateCRM — /leads/[id]. Full lead workspace: contact info, stage and owner
// management, budget/requirement, site visits and the activity timeline.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarCheck,
  CheckSquare,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  StickyNote,
  Users,
} from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { ActivityForm } from "@/components/leads/activity-form";
import { OwnerSelect } from "@/components/leads/owner-select";
import { StatusSelect } from "@/components/leads/status-select";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import { listAssignableUsers } from "@/server/auth/session";
import { canViewLead, getLeadDetail } from "@/server/modules/leads";
import type { ActivityType, LeadTemperature } from "@/types/domain";
import { formatBudgetRange, formatDate, formatDateTime, humanize } from "@/lib/utils";

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  STATUS_CHANGE: ArrowRightLeft,
  TASK: CheckSquare,
};

const temperatureTone = (t: LeadTemperature) =>
  t === "HOT" ? "destructive" : t === "WARM" ? "warning" : "muted";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, detail, assignable] = await Promise.all([
    requirePermission("lead.read"),
    getLeadDetail(id),
    listAssignableUsers(),
  ]);
  if (!detail) notFound();
  // Row-level scope: an agent may hold lead.read and still not own this lead.
  // 404 rather than 403 — revealing that the record exists is itself a leak.
  if (!(await canViewLead(user, detail.lead))) notFound();

  const { lead, activities, siteVisits, owner, project, activityUsers } = detail;
  const canWrite = can(user.role, "lead.write");
  const canAssign = can(user.role, "lead.assign");
  const owners = assignable.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/leads"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            <Badge tone={statusTone(lead.status)}>{humanize(lead.status)}</Badge>
            <Badge tone={temperatureTone(lead.temperature)}>{humanize(lead.temperature)}</Badge>
            {lead.tags.map((tag) => (
              <Badge key={tag} tone="primary">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {humanize(lead.source)} lead · created {formatDate(lead.createdAt)} · score{" "}
            <span className="font-semibold text-foreground">{lead.score}/100</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact &amp; Requirement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                <p className="mt-1 text-sm font-medium">{lead.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="mt-1 text-sm font-medium">{lead.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget</p>
                <p className="mt-1 text-sm font-medium">
                  {lead.budgetMin || lead.budgetMax
                    ? formatBudgetRange(lead.budgetMin, lead.budgetMax)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Contact</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(lead.lastContactAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Interested Project
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  {project ? (
                    <>
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {project.name}
                      <span className="text-muted-foreground">
                        · {project.locality ? `${project.locality}, ` : ""}
                        {project.city}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirement</p>
                <p className="mt-1 text-sm font-medium">{lead.requirement ?? "—"}</p>
              </div>
              {lead.status === "LOST" ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Lost Reason</p>
                  <p className="mt-1 text-sm font-medium">{lead.lostReason ?? "Not specified"}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {canWrite ? <ActivityForm leadId={lead.id} /> : null}
              {activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Log a call, note or meeting to start the timeline."
                  icon={<StickyNote className="h-8 w-8" />}
                />
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {activities.map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.type];
                    const actor = activity.userId ? activityUsers.get(activity.userId) : undefined;
                    return (
                      <li key={activity.id} className="relative">
                        <span className="absolute -left-[35px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{activity.subject}</span>
                          <Badge tone={activity.type === "STATUS_CHANGE" ? "primary" : "muted"}>
                            {humanize(activity.type)}
                          </Badge>
                          {activity.outcome ? <Badge tone="warning">{activity.outcome}</Badge> : null}
                        </div>
                        {activity.body ? (
                          <p className="mt-1 text-sm text-muted-foreground">{activity.body}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(activity.createdAt)}
                          {actor ? ` · ${actor.name}` : ""}
                          {activity.dueAt ? ` · due ${formatDateTime(activity.dueAt)}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite ? (
                <StatusSelect leadId={lead.id} status={lead.status} />
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage</p>
                  <Badge tone={statusTone(lead.status)} className="mt-1">
                    {humanize(lead.status)}
                  </Badge>
                </div>
              )}
              {canAssign ? (
                <OwnerSelect leadId={lead.id} ownerId={lead.ownerId} owners={owners} />
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
                  {owner ? (
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Avatar name={owner.name} className="h-6 w-6 text-[10px]" /> {owner.name}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm italic text-muted-foreground">Unassigned</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site Visits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {siteVisits.length === 0 ? (
                <EmptyState
                  title="No site visits"
                  description="Schedule one from the Site Visits page."
                  icon={<CalendarCheck className="h-8 w-8" />}
                />
              ) : (
                siteVisits.map((visit) => (
                  <div key={visit.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatDateTime(visit.scheduledAt)}</p>
                      <Badge tone={statusTone(visit.status)}>{humanize(visit.status)}</Badge>
                    </div>
                    {visit.feedback ? (
                      <p className="mt-1 text-xs text-muted-foreground">“{visit.feedback}”</p>
                    ) : null}
                  </div>
                ))
              )}
              <Link
                href="/site-visits"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <CalendarCheck className="h-3.5 w-3.5" /> Manage visits
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
