import Link from "next/link";
import { ArrowRight, BookmarkCheck, IndianRupee, Wallet, AlertCircle } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BookingForm } from "@/components/inventory/booking-form";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import {
  BOOKING_STATUSES,
  getBookingFormOptions,
  getBookingStats,
  listBookings,
} from "@/server/modules/bookings";
import { formatDate, formatINR, formatNumber, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const projectParam = first(sp.project);
  const statusParam = first(sp.status);
  const projectId = projectParam && projectParam !== "ALL" ? projectParam : undefined;
  const status = BOOKING_STATUSES.find((s) => s === statusParam);

  const [user, rows, stats, options] = await Promise.all([
    requirePermission("booking.read"),
    listBookings({ projectId, status }),
    getBookingStats(),
    getBookingFormOptions(),
  ]);
  const canWrite = can(user.role, "booking.write");
  const activeCount = stats.totalBookings - stats.byStatus.CANCELLED;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Token to registration — every unit booked across the portfolio."
        actions={
          canWrite ? (
            <BookingForm
              leads={options.leads}
              units={options.units}
              projects={options.projects}
              agents={options.agents}
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Booking Value"
          value={formatINR(stats.totalValue)}
          delta={{ value: `${formatNumber(activeCount)} active bookings`, positive: true }}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          label="Registered"
          value={formatNumber(stats.byStatus.REGISTERED)}
          delta={{
            value: `${formatNumber(stats.byStatus.TOKEN + stats.byStatus.AGREEMENT)} in pipeline`,
            positive: true,
          }}
          icon={<BookmarkCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Collected"
          value={formatINR(stats.collected)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Outstanding"
          value={formatINR(stats.outstanding)}
          delta={{ value: `${formatNumber(stats.overdueCount)} overdue milestones`, positive: stats.overdueCount === 0 }}
          icon={<AlertCircle className="h-5 w-5" />}
        />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="filter-project" className="text-xs font-medium text-muted-foreground">
            Project
          </label>
          <select
            id="filter-project"
            name="project"
            defaultValue={projectParam ?? "ALL"}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All projects</option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status ?? "ALL"}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All statuses</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {projectId || status ? (
          <Link
            href="/bookings"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BookmarkCheck className="h-8 w-8" />}
          title="No bookings match these filters"
          description="Adjust the project or status filter, or record a new booking from an available unit."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Lead</TH>
                  <TH>Project</TH>
                  <TH>Unit</TH>
                  <TH>Agent</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total Value</TH>
                  <TH>Booked</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.booking.id}>
                    <TD>
                      <Link
                        href={`/bookings/${row.booking.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.leadName}
                      </Link>
                    </TD>
                    <TD>{row.projectName}</TD>
                    <TD>
                      {row.unitNumber}
                      {row.unitType ? (
                        <span className="text-muted-foreground"> · {row.unitType}</span>
                      ) : null}
                    </TD>
                    <TD>{row.agentName ?? "—"}</TD>
                    <TD>
                      <Badge tone={statusTone(row.booking.status)}>
                        {humanize(row.booking.status)}
                      </Badge>
                    </TD>
                    <TD className="text-right font-medium">
                      {formatINR(row.booking.totalValue)}
                    </TD>
                    <TD>{formatDate(row.booking.bookedAt)}</TD>
                    <TD>
                      <Link
                        href={`/bookings/${row.booking.id}`}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="View booking"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
