import { Users, TrendingUp, Building2, CalendarCheck, IndianRupee, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TrendChart, CategoryBarChart, DonutChart } from "@/components/charts";
import {
  getAgentLeaderboard,
  getDashboardSummary,
  getLeadsBySource,
  getLeadsByStatus,
  getMonthlyTrend,
} from "@/server/modules/analytics";
import { requirePermission } from "@/server/auth/guard";
import { formatINR, humanize } from "@/lib/utils";

export default async function DashboardPage() {
  // The dashboard aggregates the whole organisation, so it needs report.read —
  // the same permission the nav registry gates it behind.
  await requirePermission("report.read");

  const [summary, byStatus, bySource, trend, leaderboard] = await Promise.all([
    getDashboardSummary(),
    getLeadsByStatus(),
    getLeadsBySource(),
    getMonthlyTrend(),
    getAgentLeaderboard(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time view of sales performance, pipeline and inventory."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard href="/leads" label="Total Leads" value={summary.totalLeads.toString()} delta={{ value: `+${summary.newLeadsThisWeek} this week`, positive: true }} icon={<Users className="h-5 w-5" />} />
        <StatCard href="/leads" label="Active Leads" value={summary.activeLeads.toString()} icon={<Target className="h-5 w-5" />} />
        <StatCard href="/reports" label="Conversion" value={`${summary.conversionRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard href="/pipeline" label="Pipeline Value" value={formatINR(summary.pipelineValue)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard href="/inventory" label="Available Units" value={summary.availableUnits.toString()} icon={<Building2 className="h-5 w-5" />} />
        <StatCard href="/site-visits" label="Upcoming Visits" value={summary.upcomingSiteVisits.toString()} icon={<CalendarCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads vs Bookings — last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lead Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={byStatus.map((s) => ({ name: humanize(s.status), value: s.count }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={bySource.map((s) => ({ source: humanize(s.source), count: s.count }))}
              xKey="source"
              barKey="count"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH>Booked</TH>
                  <TH>Conv.</TH>
                </TR>
              </THead>
              <TBody>
                {leaderboard.slice(0, 6).map((a) => (
                  <TR key={a.userId}>
                    <TD className="font-medium">{a.name}</TD>
                    <TD>{a.booked}</TD>
                    <TD>
                      <Badge tone={statusTone(a.conversionRate > 20 ? "BOOKED" : "NEW")}>{a.conversionRate}%</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
