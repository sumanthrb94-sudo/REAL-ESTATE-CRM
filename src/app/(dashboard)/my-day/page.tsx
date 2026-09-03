// EstateCRM — /my-day: the first screen of the working day.
//
// A customer-care executive signing in at 9am does not need six months of
// trend charts; they need to know who to call first. Everything here is a link
// to the place the work actually gets done, and an empty section disappears
// rather than sitting there as a zero.

import Link from "next/link";
import { CalendarClock, CheckCircle2, Flame, PhoneCall, Snowflake, TriangleAlert, UserPlus } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { getDailyAgenda, greeting, type AgendaLead } from "@/server/modules/agenda";
import { formatBudgetRange, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** One number and its label, only rendered when there is something to say. */
function Count({
  value,
  label,
  tone,
  href,
  icon,
}: {
  value: number;
  label: string;
  tone: "default" | "warning" | "critical";
  href: string;
  icon: React.ReactNode;
}) {
  if (value === 0) return null;
  const toneClass =
    tone === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-warning/40 bg-warning/5"
        : "border-border";
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${toneClass}`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

function LeadRow({ item, reason }: { item: AgendaLead; reason: string }) {
  const { lead, waitingDays } = item;
  return (
    <li>
      <Link href={`/leads/${lead.id}`} className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-muted/50">
        <span className="min-w-0">
          <span className="block truncate font-medium">{lead.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {lead.phone}
            {lead.budgetMin || lead.budgetMax
              ? ` · ${formatBudgetRange(lead.budgetMin, lead.budgetMax)}`
              : ""}
            {` · ${humanize(lead.source)}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <Badge tone={statusTone(lead.status)}>{humanize(lead.status)}</Badge>
          <span className="mt-1 block text-xs text-muted-foreground">
            {waitingDays === 0 ? "today" : `${waitingDays}d ${reason}`}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ul className="divide-y divide-border border-t border-border">{children}</ul>
      </CardContent>
    </Card>
  );
}

export default async function MyDayPage() {
  // Every signed-in role has dashboard.read, and everyone has a day.
  const user = await requirePermission("dashboard.read");
  const agenda = await getDailyAgenda(user);
  const scopeLabel =
    agenda.scope === "mine" ? "yours" : agenda.scope === "team" ? "your team's" : "everyone's";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${agenda.greetingName}`}
        description={
          agenda.clear
            ? "Nothing is waiting on you right now."
            : `Everything below is ${scopeLabel}, ordered by what has waited longest.`
        }
      />

      {agenda.clear ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
            <div>
              <p className="font-medium">You are clear.</p>
              <p className="text-sm text-muted-foreground">
                No visits, no follow-ups due, and every lead assigned to you has been contacted.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Count value={agenda.counts.newLeads} label="to call first" tone="default" href="/leads?status=NEW" icon={<PhoneCall className="h-5 w-5" />} />
          <Count value={agenda.counts.visitsToday} label="visits today" tone="default" href="/site-visits" icon={<CalendarClock className="h-5 w-5" />} />
          <Count value={agenda.counts.tasksDue} label="follow-ups due" tone="default" href="/leads" icon={<Flame className="h-5 w-5" />} />
          <Count value={agenda.counts.tasksOverdue} label="overdue" tone="critical" href="/leads" icon={<TriangleAlert className="h-5 w-5" />} />
          <Count value={agenda.counts.visitsOverdue} label="visits not closed" tone="warning" href="/site-visits" icon={<TriangleAlert className="h-5 w-5" />} />
          <Count value={agenda.counts.goingCold} label="going cold" tone="warning" href="/leads" icon={<Snowflake className="h-5 w-5" />} />
        </div>
      )}

      {can(user.role, "lead.assign") && agenda.unassigned > 0 ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-medium">
                  {agenda.unassigned} lead{agenda.unassigned === 1 ? "" : "s"} belong to nobody
                </p>
                <p className="text-sm text-muted-foreground">
                  A lead with no owner is a lead nobody opens. Distribute them now, or check the
                  rules if this keeps happening.
                </p>
              </div>
            </div>
            <Link
              href="/distribution"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Distribute
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {agenda.visits.length > 0 ? (
          <Section
            title="Site visits"
            description="Today's appointments, and anything left open from earlier."
            icon={<CalendarClock className="h-4 w-4" />}
          >
            {agenda.visits.map(({ visit, lead, projectName, at, overdue }) => (
              <li key={visit.id}>
                <Link href="/site-visits" className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-muted/50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{lead?.name ?? "Unknown lead"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {projectName ?? "No project"}
                      {lead?.phone ? ` · ${lead.phone}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium tabular-nums">{at}</span>
                    {overdue ? (
                      <Badge tone="warning">not closed</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{humanize(visit.status)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </Section>
        ) : null}

        {agenda.tasks.length > 0 ? (
          <Section
            title="Follow-ups"
            description="Due today or already past due, oldest first."
            icon={<Flame className="h-4 w-4" />}
          >
            {agenda.tasks.map(({ activity, lead, overdue }) => (
              <li key={activity.id}>
                <Link
                  href={lead ? `/leads/${lead.id}` : "/leads"}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{activity.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lead?.name ?? "Unknown lead"}
                      {lead?.phone ? ` · ${lead.phone}` : ""}
                    </span>
                  </span>
                  {overdue ? (
                    <Badge tone="destructive">overdue</Badge>
                  ) : (
                    <Badge tone="muted">{humanize(activity.type)}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </Section>
        ) : null}

        {agenda.newLeads.length > 0 ? (
          <Section
            title="Call these first"
            description="Assigned to you and never contacted. Longest wait at the top."
            icon={<PhoneCall className="h-4 w-4" />}
          >
            {agenda.newLeads.map((item) => (
              <LeadRow key={item.lead.id} item={item} reason="waiting" />
            ))}
          </Section>
        ) : null}

        {agenda.goingCold.length > 0 ? (
          <Section
            title="Going cold"
            description="Still in play, but untouched for a week or more."
            icon={<Snowflake className="h-4 w-4" />}
          >
            {agenda.goingCold.map((item) => (
              <LeadRow key={item.lead.id} item={item} reason="since contact" />
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
