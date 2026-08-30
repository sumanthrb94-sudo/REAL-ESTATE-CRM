// EstateCRM — /leads. Filterable, searchable leads table with inline creation.

import Link from "next/link";
import { Flame, IndianRupee, Upload, UserPlus, Users } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadForm } from "@/components/leads/lead-form";
import { can } from "@/server/auth/rbac";
import { requirePermission, visibleOwnerIds } from "@/server/auth/guard";
import {
  getLeadFormOptions,
  listLeads,
  teamMemberIds,
  type LeadFilters as Filters,
} from "@/server/modules/leads";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadSource,
  type LeadStatus,
  type LeadTemperature,
} from "@/types/domain";
import { formatDate, formatINR, humanize } from "@/lib/utils";

const TEMPS: LeadTemperature[] = ["HOT", "WARM", "COLD"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const temperatureTone = (t: LeadTemperature) =>
  t === "HOT" ? "destructive" : t === "WARM" ? "warning" : "muted";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = first(params.status);
  const source = first(params.source);
  const temperature = first(params.temperature);

  const user = await requirePermission("lead.read");

  const filters: Filters = {
    status: LEAD_STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : undefined,
    source: LEAD_SOURCES.includes(source as LeadSource) ? (source as LeadSource) : undefined,
    temperature: TEMPS.includes(temperature as LeadTemperature) ? (temperature as LeadTemperature) : undefined,
    ownerId: first(params.owner) ?? first(params.ownerId),
    search: first(params.q),
    // Row-level scope, imposed by role — an agent cannot widen it with a query
    // parameter because this overrides `ownerId` inside listLeads().
    ownerScope: await visibleOwnerIds(user, () => teamMemberIds(user)),
  };

  const [leads, options] = await Promise.all([listLeads(filters), getLeadFormOptions()]);
  const canWrite = can(user.role, "lead.write");
  const canAssign = can(user.role, "lead.assign");

  const hotCount = leads.filter((l) => l.temperature === "HOT").length;
  const unassigned = leads.filter((l) => !l.ownerId).length;
  const pipelineValue = leads
    .filter((l) => !["BOOKED", "LOST"].includes(l.status))
    .reduce((sum, l) => sum + (l.budgetMax ?? l.budgetMin ?? 0), 0);

  const ownerOptions = options.owners.map((o) => ({ id: o.id, name: o.name }));
  const projectOptions = options.projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Capture, qualify and work every enquiry from first touch to booking."
        actions={
          canWrite ? (
            <Link
              href="/leads/import"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
          ) : (
            <Badge tone="muted">Read-only access</Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Matching Leads" value={leads.length.toString()} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Hot Leads" value={hotCount.toString()} icon={<Flame className="h-5 w-5" />} />
        <StatCard label="Unassigned" value={unassigned.toString()} icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Pipeline Value" value={formatINR(pipelineValue)} icon={<IndianRupee className="h-5 w-5" />} />
      </div>

      {canWrite ? <LeadForm projects={projectOptions} owners={ownerOptions} canAssign={canAssign} /> : null}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <LeadFilters owners={ownerOptions} />
          {leads.length === 0 ? (
            <EmptyState
              title="No leads match these filters"
              description="Try clearing the filters, or create a new lead to get started."
              icon={<Users className="h-8 w-8" />}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Lead</TH>
                  <TH>Status</TH>
                  <TH>Source</TH>
                  <TH>Temp</TH>
                  <TH>Score</TH>
                  <TH>Budget</TH>
                  <TH>Owner</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {leads.map((lead) => (
                  <TR key={lead.id}>
                    <TD>
                      <Link href={`/leads/${lead.id}`} className="block hover:underline">
                        <span className="font-medium">{lead.name}</span>
                        <span className="block text-xs text-muted-foreground">{lead.phone}</span>
                      </Link>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(lead.status)}>{humanize(lead.status)}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{humanize(lead.source)}</TD>
                    <TD>
                      <Badge tone={temperatureTone(lead.temperature)}>{humanize(lead.temperature)}</Badge>
                    </TD>
                    <TD className="font-medium">{lead.score}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {lead.budgetMin || lead.budgetMax
                        ? `${formatINR(lead.budgetMin)} – ${formatINR(lead.budgetMax)}`
                        : "—"}
                    </TD>
                    <TD>
                      {lead.owner ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={lead.owner.name} className="h-6 w-6 text-[10px]" />
                          <span className="whitespace-nowrap text-xs">{lead.owner.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Unassigned</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(lead.createdAt)}</TD>
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
