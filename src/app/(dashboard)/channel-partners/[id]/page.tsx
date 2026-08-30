import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookCheck, IndianRupee, Target, Users } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PartnerEditForm } from "@/components/partners/partner-edit-form";
import { PartnerStatusActions } from "@/components/partners/partner-status-actions";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import { getPartnerDetail } from "@/server/modules/partners";
import { formatDate, formatINR, formatNumber, humanize } from "@/lib/utils";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("partner.read");

  const { id } = await params;
  const detail = await getPartnerDetail(id);
  if (!detail) notFound();

  const { partner, leads, bookings, projectNames, metrics } = detail;
  const canWrite = can(user.role, "partner.write");

  return (
    <div className="space-y-6">
      <Link
        href="/channel-partners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Channel Partners
      </Link>

      <PageHeader
        title={partner.name}
        description={[partner.company, partner.city].filter(Boolean).join(" · ") || undefined}
        actions={
          canWrite ? <PartnerStatusActions partnerId={partner.id} status={partner.status} /> : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sourced Leads"
          value={formatNumber(metrics.sourcedLeads)}
          delta={{ value: `${metrics.activeLeads} active`, positive: true }}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Booked Leads"
          value={formatNumber(metrics.bookedLeads)}
          icon={<BookCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Booking Value"
          value={formatINR(metrics.bookingValue)}
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          label="Commission Earned"
          value={formatINR(metrics.commissionEarned)}
          delta={{ value: `@ ${partner.commissionPct}% of booking value`, positive: true }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Partner Profile</CardTitle>
          <Badge tone={statusTone(partner.status)}>{partner.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-0.5 font-medium">{partner.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 font-medium">{partner.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">RERA ID</dt>
              <dd className="mt-0.5 font-medium">{partner.reraId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Onboarded</dt>
              <dd className="mt-0.5 font-medium">{formatDate(partner.createdAt)}</dd>
            </div>
          </dl>
          {canWrite ? <PartnerEditForm partner={partner} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sourced Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {leads.length === 0 ? (
            <EmptyState
              title="No leads sourced yet"
              description="Leads tagged to this partner will appear here."
              icon={<Users className="h-8 w-8" />}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Lead</TH>
                  <TH>Phone</TH>
                  <TH>Project</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Budget (max)</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {leads.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-medium">{l.name}</TD>
                    <TD>{l.phone}</TD>
                    <TD>{l.projectId ? projectNames[l.projectId] ?? "—" : "—"}</TD>
                    <TD>
                      <Badge tone={statusTone(l.status)}>{humanize(l.status)}</Badge>
                    </TD>
                    <TD className="text-right">{formatINR(l.budgetMax ?? l.budgetMin)}</TD>
                    <TD className="text-muted-foreground">{formatDate(l.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bookings & Commission ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {bookings.length === 0 ? (
            <EmptyState
              title="No bookings yet"
              description="Bookings from this partner's sourced leads will appear here, along with the commission earned."
              icon={<BookCheck className="h-8 w-8" />}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Lead</TH>
                  <TH>Project</TH>
                  <TH>Unit</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Booking Value</TH>
                  <TH className="text-right">Commission ({partner.commissionPct}%)</TH>
                  <TH>Booked</TH>
                </TR>
              </THead>
              <TBody>
                {bookings.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-medium">{b.leadName}</TD>
                    <TD>{b.projectName}</TD>
                    <TD>{b.unitNumber}</TD>
                    <TD>
                      <Badge tone={statusTone(b.status)}>{humanize(b.status)}</Badge>
                    </TD>
                    <TD className="text-right">{formatINR(b.totalValue)}</TD>
                    <TD className="text-right font-medium">{formatINR(b.commission)}</TD>
                    <TD className="text-muted-foreground">{formatDate(b.bookedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
