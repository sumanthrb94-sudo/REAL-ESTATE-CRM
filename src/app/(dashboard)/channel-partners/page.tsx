import Link from "next/link";
import { Handshake, Hourglass, IndianRupee, Users } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ResponsiveRecords } from "@/components/ui/record-list";
import { OnboardPartnerForm } from "@/components/partners/onboard-partner-form";
import { PartnerStatusActions } from "@/components/partners/partner-status-actions";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import {
  getPartnerCities,
  getPartnerStats,
  listPartners,
} from "@/server/modules/partners";
import { formatINR, formatNumber } from "@/lib/utils";
import type { PartnerStatus } from "@/types/domain";

const PARTNER_STATUSES: PartnerStatus[] = ["PENDING", "ACTIVE", "SUSPENDED"];

function asStatus(value: string | undefined): PartnerStatus | undefined {
  return PARTNER_STATUSES.find((s) => s === value);
}

export default async function ChannelPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; city?: string }>;
}) {
  const user = await requirePermission("partner.read");

  const params = await searchParams;
  const status = asStatus(params.status);
  const city = params.city?.trim() || undefined;
  const canWrite = can(user.role, "partner.write");

  const [partners, stats, cities] = await Promise.all([
    listPartners({ status, city }),
    getPartnerStats(),
    getPartnerCities(),
  ]);

  const isFiltered = Boolean(status || city);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Channel Partners"
        description="Broker network: onboarding, approvals, sourced business and commission payouts."
        actions={canWrite ? <OnboardPartnerForm /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active Partners"
          value={formatNumber(stats.active)}
          icon={<Handshake className="h-5 w-5" />}
        />
        <StatCard
          label="Pending Approval"
          value={formatNumber(stats.pending)}
          delta={stats.pending > 0 ? { value: "Awaiting review", positive: false } : undefined}
          icon={<Hourglass className="h-5 w-5" />}
        />
        <StatCard
          label="Partner-sourced Leads"
          value={formatNumber(stats.sourcedLeads)}
          delta={{ value: `${stats.bookedLeads} booked`, positive: true }}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Commission Payable"
          value={formatINR(stats.commissionPayable)}
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>Partner Directory</CardTitle>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <Select name="status" defaultValue={status ?? ""} className="w-40">
              <option value="">All statuses</option>
              {PARTNER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
            <Select name="city" defaultValue={city ?? ""} className="w-40">
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
            {isFiltered ? (
              <Link
                href="/channel-partners"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Reset
              </Link>
            ) : null}
          </form>
        </CardHeader>
        <CardContent className="pt-0">
          {partners.length === 0 ? (
            <EmptyState
              title="No partners found"
              description={
                isFiltered
                  ? "No channel partners match the current filters. Try clearing them."
                  : "Onboard your first channel partner to start tracking sourced leads and commissions."
              }
              icon={<Handshake className="h-8 w-8" />}
            />
          ) : (
            <ResponsiveRecords
              items={partners.map((p) => ({
                id: p.id,
                href: `/channel-partners/${p.id}`,
                title: p.name,
                subtitle: [p.company, p.city].filter(Boolean).join(" · ") || undefined,
                badges: <Badge tone={statusTone(p.status)}>{p.status}</Badge>,
                meta: [
                  p.phone,
                  `${p.commissionPct}% commission`,
                  `${formatNumber(p.sourcedLeads)} leads · ${p.bookedLeads} booked`,
                  `${formatINR(p.commissionEarned)} earned`,
                ],
                actions: canWrite ? (
                  <PartnerStatusActions partnerId={p.id} status={p.status} />
                ) : null,
              }))}
            >
            <Table>
              <THead>
                <TR>
                  <TH>Partner</TH>
                  <TH>City</TH>
                  <TH>Contact</TH>
                  <TH>RERA</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Commission</TH>
                  <TH className="text-right">Sourced Leads</TH>
                  <TH className="text-right">Earned</TH>
                  {canWrite ? <TH>Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {partners.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/channel-partners/${p.id}`} className="group block">
                        <span className="font-medium group-hover:underline">{p.name}</span>
                        {p.company ? (
                          <span className="block text-xs text-muted-foreground">{p.company}</span>
                        ) : null}
                      </Link>
                    </TD>
                    <TD>{p.city ?? "—"}</TD>
                    <TD>
                      <span className="block">{p.phone}</span>
                      {p.email ? (
                        <span className="block text-xs text-muted-foreground">{p.email}</span>
                      ) : null}
                    </TD>
                    <TD className="text-xs text-muted-foreground">{p.reraId ?? "—"}</TD>
                    <TD>
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    </TD>
                    <TD className="text-right">{p.commissionPct}%</TD>
                    <TD className="text-right">
                      {formatNumber(p.sourcedLeads)}
                      <span className="block text-xs text-muted-foreground">
                        {p.bookedLeads} booked
                      </span>
                    </TD>
                    <TD className="text-right font-medium">{formatINR(p.commissionEarned)}</TD>
                    {canWrite ? (
                      <TD>
                        <PartnerStatusActions partnerId={p.id} status={p.status} />
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
            </ResponsiveRecords>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
