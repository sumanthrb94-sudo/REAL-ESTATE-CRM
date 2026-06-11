import {
  BookCheck,
  IndianRupee,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CategoryBarChart } from "@/components/charts";
import { RevenueTrendChart } from "@/components/reports/revenue-chart";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { getDashboardSummary } from "@/server/modules/analytics";
import {
  getProjectPerformance,
  getRevenueReport,
  getSalesFunnelReport,
  getSourcePerformance,
  getTeamReport,
} from "@/server/modules/reports";
import { formatINR, formatNumber, humanize } from "@/lib/utils";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!can(user.role, "report.read")) {
    return (
      <EmptyState
        title="Access restricted"
        description="You do not have permission to view reports."
      />
    );
  }

  const [summary, funnel, sources, projects, revenue, team] = await Promise.all([
    getDashboardSummary(),
    getSalesFunnelReport(),
    getSourcePerformance(),
    getProjectPerformance(),
    getRevenueReport(),
    getTeamReport(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Executive analytics across funnel, sources, projects, revenue and teams."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Leads" value={formatNumber(summary.totalLeads)} delta={{ value: `+${summary.newLeadsThisWeek} this week`, positive: true }} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active Pipeline" value={formatNumber(summary.activeLeads)} icon={<Target className="h-5 w-5" />} />
        <StatCard label="Conversion" value={`${summary.conversionRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Pipeline Value" value={formatINR(summary.pipelineValue)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Booking Value" value={formatINR(summary.bookingValue)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Booked Leads" value={formatNumber(summary.bookedLeads)} icon={<BookCheck className="h-5 w-5" />} />
      </div>

      {/* ─── Sales funnel ─────────────────────────────────────────────── */}
      <Section
        title="Sales Funnel"
        description="How leads progress through each stage, and where they drop off."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leads Reaching Each Stage</CardTitle>
              <CardDescription>
                {funnel.lostLeads} leads marked lost · {funnel.overallConversionPct}% booked overall
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={funnel.stages.map((s) => ({
                  stage: humanize(s.stage),
                  reached: s.reached,
                }))}
                xKey="stage"
                barKey="reached"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stage-by-stage Drop-off</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Stage</TH>
                    <TH className="text-right">At Stage</TH>
                    <TH className="text-right">Reached</TH>
                    <TH className="text-right">Reach %</TH>
                    <TH className="text-right">Drop-off</TH>
                  </TR>
                </THead>
                <TBody>
                  {funnel.stages.map((s) => (
                    <TR key={s.stage}>
                      <TD className="font-medium">{humanize(s.stage)}</TD>
                      <TD className="text-right">{formatNumber(s.atStage)}</TD>
                      <TD className="text-right">{formatNumber(s.reached)}</TD>
                      <TD className="text-right">{s.reachPct}%</TD>
                      <TD className="text-right">
                        <Badge tone={s.dropOffPct >= 40 ? "destructive" : s.dropOffPct >= 20 ? "warning" : "success"}>
                          {s.dropOffPct}%
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Source performance ───────────────────────────────────────── */}
      <Section
        title="Source Performance"
        description="Lead volume, conversion and value contribution by acquisition channel."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Source Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sources.length === 0 ? (
                <EmptyState title="No leads yet" description="Source performance appears once leads are captured." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Source</TH>
                      <TH className="text-right">Leads</TH>
                      <TH className="text-right">Booked</TH>
                      <TH className="text-right">Lost</TH>
                      <TH className="text-right">Conversion</TH>
                      <TH className="text-right">Pipeline Value</TH>
                      <TH className="text-right">Booking Value</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {sources.map((s) => (
                      <TR key={s.source}>
                        <TD className="font-medium">{humanize(s.source)}</TD>
                        <TD className="text-right">{formatNumber(s.leads)}</TD>
                        <TD className="text-right">{formatNumber(s.booked)}</TD>
                        <TD className="text-right">{formatNumber(s.lost)}</TD>
                        <TD className="text-right">
                          <Badge tone={s.conversionPct >= 15 ? "success" : s.conversionPct >= 5 ? "warning" : "muted"}>
                            {s.conversionPct}%
                          </Badge>
                        </TD>
                        <TD className="text-right">{formatINR(s.pipelineValue)}</TD>
                        <TD className="text-right">{formatINR(s.bookingValue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Conversion by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={sources.map((s) => ({
                  source: humanize(s.source),
                  "conversion %": s.conversionPct,
                }))}
                xKey="source"
                barKey="conversion %"
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Project performance ──────────────────────────────────────── */}
      <Section
        title="Project Performance"
        description="Demand and sales velocity for every project in the portfolio."
      >
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {projects.length === 0 ? (
              <EmptyState title="No projects yet" description="Add projects to inventory to see performance here." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH>City</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Leads</TH>
                    <TH className="text-right">Site Visits</TH>
                    <TH className="text-right">Visits Done</TH>
                    <TH className="text-right">Bookings</TH>
                    <TH className="text-right">Booking Value</TH>
                    <TH className="text-right">Units Left</TH>
                  </TR>
                </THead>
                <TBody>
                  {projects.map((p) => (
                    <TR key={p.projectId}>
                      <TD className="font-medium">{p.name}</TD>
                      <TD>{p.city}</TD>
                      <TD>
                        <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
                      </TD>
                      <TD className="text-right">{formatNumber(p.leads)}</TD>
                      <TD className="text-right">{formatNumber(p.siteVisits)}</TD>
                      <TD className="text-right">{formatNumber(p.siteVisitsDone)}</TD>
                      <TD className="text-right">{formatNumber(p.bookings)}</TD>
                      <TD className="text-right font-medium">{formatINR(p.bookingValue)}</TD>
                      <TD className="text-right">{formatNumber(p.availableUnits)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* ─── Revenue ──────────────────────────────────────────────────── */}
      <Section
        title="Revenue"
        description={`${formatINR(revenue.totalValue)} across ${revenue.totalBookings} bookings · avg ${formatINR(revenue.avgBookingValue)} per booking.`}
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Booking Value — last 6 months</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueTrendChart data={revenue.monthly} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Project</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {revenue.byProject.length === 0 ? (
                <EmptyState title="No bookings yet" description="Revenue appears once units are booked." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Project</TH>
                      <TH className="text-right">Bookings</TH>
                      <TH className="text-right">Value</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {revenue.byProject.map((p) => (
                      <TR key={p.projectId}>
                        <TD className="font-medium">{p.name}</TD>
                        <TD className="text-right">{formatNumber(p.bookings)}</TD>
                        <TD className="text-right font-medium">{formatINR(p.value)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Team leaderboard ─────────────────────────────────────────── */}
      <Section
        title="Team Performance"
        description="Agent leaderboard and team-level contribution."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Agent Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {team.agents.length === 0 ? (
                <EmptyState title="No agents yet" description="Agent performance appears once leads are assigned." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Agent</TH>
                      <TH>Team</TH>
                      <TH className="text-right">Leads</TH>
                      <TH className="text-right">Site Visits</TH>
                      <TH className="text-right">Booked</TH>
                      <TH className="text-right">Conversion</TH>
                      <TH className="text-right">Booking Value</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {team.agents.map((a) => (
                      <TR key={a.userId}>
                        <TD className="font-medium">{a.name}</TD>
                        <TD className="text-muted-foreground">{a.teamName}</TD>
                        <TD className="text-right">{formatNumber(a.totalLeads)}</TD>
                        <TD className="text-right">{formatNumber(a.siteVisits)}</TD>
                        <TD className="text-right">{formatNumber(a.booked)}</TD>
                        <TD className="text-right">
                          <Badge tone={a.conversionRate >= 20 ? "success" : a.conversionRate >= 10 ? "warning" : "muted"}>
                            {a.conversionRate}%
                          </Badge>
                        </TD>
                        <TD className="text-right font-medium">{formatINR(a.bookingValue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {team.teams.length === 0 ? (
                <EmptyState title="No teams yet" description="Team rollups appear once teams are configured." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Team</TH>
                      <TH className="text-right">Booked</TH>
                      <TH className="text-right">Value</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {team.teams.map((t) => (
                      <TR key={t.teamId}>
                        <TD>
                          <span className="font-medium">{t.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t.members} members{t.region ? ` · ${t.region}` : ""} · {t.conversionPct}% conv.
                          </span>
                        </TD>
                        <TD className="text-right">{formatNumber(t.booked)}</TD>
                        <TD className="text-right font-medium">{formatINR(t.bookingValue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
