// EstateCRM — /marketing: campaign dashboard.
// Stat cards, campaign table with lifecycle actions, new-campaign form and a
// conversion funnel for the selected (or top) campaign.

import Link from "next/link";
import { Megaphone, MousePointerClick, Send, TrendingUp } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { CampaignRowActions } from "@/components/marketing/campaign-row-actions";
import { Funnel } from "@/components/marketing/funnel";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import {
  buildFunnel,
  getMarketingStats,
  listCampaigns,
  listSegments,
  listTemplates,
} from "@/server/modules/marketing";
import { formatDate, formatNumber, humanize, percent } from "@/lib/utils";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const [{ campaign: selectedId }, user, stats, campaigns, templates, segments] = await Promise.all([
    searchParams,
    requirePermission("marketing.read"),
    getMarketingStats(),
    listCampaigns(),
    listTemplates(),
    listSegments(),
  ]);
  const canWrite = can(user.role, "marketing.write");

  const templateName = new Map(templates.map((t) => [t.id, t.name]));
  const segmentName = new Map(segments.map((s) => [s.id, s.name]));

  const focus =
    campaigns.find((c) => c.id === selectedId) ??
    [...campaigns].sort((a, b) => b.sent - a.sent)[0];
  const funnel = focus ? buildFunnel(focus) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Campaigns"
        description="Plan, launch and measure email, SMS and WhatsApp campaigns across your lead base."
        actions={canWrite ? <CampaignForm templates={templates} segments={segments} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Campaigns"
          value={stats.activeCampaigns.toString()}
          delta={{ value: `${stats.totalCampaigns} total`, positive: true }}
          icon={<Megaphone className="h-5 w-5" />}
        />
        <StatCard label="Total Sent" value={formatNumber(stats.totalSent)} icon={<Send className="h-5 w-5" />} />
        <StatCard
          label="Avg Open Rate"
          value={`${stats.openRate}%`}
          delta={{ value: `${stats.clickRate}% click-through`, positive: stats.clickRate > 0 }}
          icon={<MousePointerClick className="h-5 w-5" />}
        />
        <StatCard
          label="Avg Conversion"
          value={`${stats.conversionRate}%`}
          delta={{ value: `${formatNumber(stats.totalConverted)} conversions`, positive: stats.totalConverted > 0 }}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>Click a campaign to inspect its funnel.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {campaigns.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-8 w-8" />}
                title="No campaigns yet"
                description="Create your first campaign to start engaging leads at scale."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Campaign</TH>
                    <TH>Channel</TH>
                    <TH>Status</TH>
                    <TH>Scheduled</TH>
                    <TH className="text-right">Sent</TH>
                    <TH className="text-right">Opened</TH>
                    <TH className="text-right">Clicked</TH>
                    <TH className="text-right">Conv.</TH>
                    {canWrite ? <TH>Actions</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {campaigns.map((c) => (
                    <TR key={c.id} className={focus?.id === c.id ? "bg-accent/40 hover:bg-accent/40" : undefined}>
                      <TD>
                        <Link href={`/marketing?campaign=${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c.templateId ? templateName.get(c.templateId) ?? "—" : "No template"}
                          {" · "}
                          {c.segmentId ? segmentName.get(c.segmentId) ?? "—" : "All leads"}
                        </p>
                      </TD>
                      <TD>
                        <Badge tone="primary">{humanize(c.channel)}</Badge>
                      </TD>
                      <TD>
                        <Badge tone={statusTone(c.status)}>{humanize(c.status)}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(c.scheduledAt)}</TD>
                      <TD className="text-right tabular-nums">{formatNumber(c.sent)}</TD>
                      <TD className="text-right tabular-nums">
                        {formatNumber(c.opened)}
                        <span className="ml-1 text-xs text-muted-foreground">{percent(c.opened, c.delivered)}</span>
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatNumber(c.clicked)}
                        <span className="ml-1 text-xs text-muted-foreground">{percent(c.clicked, c.opened)}</span>
                      </TD>
                      <TD className="text-right tabular-nums">
                        {formatNumber(c.converted)}
                        <span className="ml-1 text-xs text-muted-foreground">{percent(c.converted, c.sent)}</span>
                      </TD>
                      {canWrite ? (
                        <TD>
                          <CampaignRowActions campaignId={c.id} status={c.status} />
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>
              {funnel ? funnel.campaign.name : "No campaign selected"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {funnel && funnel.campaign.sent > 0 ? (
              <div className="space-y-5">
                <Funnel stages={funnel.stages} />
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Delivery rate</p>
                    <p className="font-semibold">{funnel.deliveryRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open rate</p>
                    <p className="font-semibold">{funnel.openRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Click rate</p>
                    <p className="font-semibold">{funnel.clickRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conversion</p>
                    <p className="font-semibold">{funnel.conversionRate}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Send className="h-8 w-8" />}
                title="No sends yet"
                description={
                  funnel
                    ? "This campaign has not sent any messages yet. Start it to begin collecting funnel data."
                    : "Create a campaign to see its conversion funnel here."
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
