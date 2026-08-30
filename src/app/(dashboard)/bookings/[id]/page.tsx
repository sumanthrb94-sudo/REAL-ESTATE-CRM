import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IndianRupee, TrendingUp, Wallet, AlertCircle } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BookingStatusSelect } from "@/components/inventory/booking-status-select";
import { MarkPaidButton } from "@/components/inventory/mark-paid-button";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import { getBookingDetail } from "@/server/modules/bookings";
import { formatDate, formatINR, formatNumber, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, detail] = await Promise.all([requirePermission("booking.read"), getBookingDetail(id)]);
  if (!detail) notFound();

  const canWrite = can(user.role, "booking.write");
  const { booking, lead, unit, project, agent, payments, progress } = detail;
  const isCancelled = booking.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Bookings
      </Link>

      <PageHeader
        title={lead ? `Booking — ${lead.name}` : "Booking"}
        description={
          unit && project
            ? `Unit ${unit.unitNumber} · ${unit.type} at ${project.name}, booked ${formatDate(booking.bookedAt)}.`
            : `Booked ${formatDate(booking.bookedAt)}.`
        }
        actions={
          canWrite ? (
            <BookingStatusSelect bookingId={booking.id} status={booking.status} />
          ) : (
            <Badge tone={statusTone(booking.status)}>{humanize(booking.status)}</Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Value"
          value={formatINR(booking.totalValue)}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          label="Collected"
          value={formatINR(progress.paidAmount)}
          delta={{
            value: `${progress.paidCount} of ${progress.totalCount} milestones`,
            positive: true,
          }}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Outstanding"
          value={formatINR(progress.totalAmount - progress.paidAmount)}
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <StatCard
          label="Payment Progress"
          value={`${progress.pct}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {lead ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={lead.name} />
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-muted-foreground">{lead.phone}</p>
                  </div>
                </div>
                {lead.email ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{lead.email}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lead status</span>
                  <Badge tone={statusTone(lead.status)}>{humanize(lead.status)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">{humanize(lead.source)}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Lead record not found.</p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">Agent</span>
              <span className="font-medium">{agent?.name ?? "Unassigned"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {unit ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{unit.unitNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{unit.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Floor</span>
                  <span className="font-medium">{unit.floor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Carpet area</span>
                  <span className="font-medium">{formatNumber(unit.carpetArea)} sq ft</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Facing</span>
                  <span className="font-medium">{unit.facing ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unit status</span>
                  <Badge tone={statusTone(unit.status)}>{humanize(unit.status)}</Badge>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Unit record not found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Project</span>
                  <Link
                    href={`/inventory/${project.id}`}
                    className="font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Developer</span>
                  <span className="font-medium">{project.developer ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">
                    {project.locality ? `${project.locality}, ` : ""}
                    {project.city}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge tone={statusTone(project.status)}>{humanize(project.status)}</Badge>
                </div>
                {project.reraId ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">RERA</span>
                    <span className="font-medium">{project.reraId}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Project record not found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Milestones</CardTitle>
          <CardDescription>
            {formatINR(progress.paidAmount)} collected of {formatINR(progress.totalAmount)} (
            {progress.pct}%)
          </CardDescription>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              No payment schedule recorded for this booking.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Milestone</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Due Date</TH>
                  <TH>Status</TH>
                  <TH>Paid On</TH>
                  {canWrite && !isCancelled ? <TH className="text-right">Action</TH> : null}
                </TR>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-medium">{p.milestone}</TD>
                    <TD className="text-right">{formatINR(p.amount)}</TD>
                    <TD>{formatDate(p.dueDate)}</TD>
                    <TD>
                      <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
                    </TD>
                    <TD>{p.paidAt ? formatDate(p.paidAt) : "—"}</TD>
                    {canWrite && !isCancelled ? (
                      <TD className="text-right">
                        {p.status !== "PAID" ? (
                          <MarkPaidButton paymentId={p.id} bookingId={booking.id} />
                        ) : null}
                      </TD>
                    ) : null}
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
