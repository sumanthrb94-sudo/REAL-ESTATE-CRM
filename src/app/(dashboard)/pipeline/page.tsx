// EstateCRM — /pipeline. Kanban view of the sales funnel, one column per
// LeadStatus with counts and value totals. Stage moves happen inline.

import { IndianRupee, KanbanSquare, Target, TrendingUp } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { PipelineBoard, type PipelineColumn } from "@/components/leads/pipeline-board";
import { can } from "@/server/auth/rbac";
import { requirePermission, visibleOwnerIds } from "@/server/auth/guard";
import { listLeads, teamMemberIds } from "@/server/modules/leads";
import { LEAD_STATUSES } from "@/types/domain";
import { formatINR, percent } from "@/lib/utils";

export default async function PipelinePage() {
  const user = await requirePermission("lead.read");
  const leads = await listLeads({
    ownerScope: await visibleOwnerIds(user, () => teamMemberIds(user)),
  });
  const canWrite = can(user.role, "lead.write");

  const columns: PipelineColumn[] = LEAD_STATUSES.map((status) => {
    const inStage = leads.filter((l) => l.status === status);
    return {
      status,
      leads: inStage.map((l) => ({
        id: l.id,
        name: l.name,
        value: l.budgetMax ?? l.budgetMin ?? 0,
        temperature: l.temperature,
        status: l.status,
        score: l.score,
        ownerName: l.owner?.name ?? null,
        projectName: l.project?.name ?? null,
      })),
      total: inStage.reduce((sum, l) => sum + (l.budgetMax ?? l.budgetMin ?? 0), 0),
    };
  });

  const open = leads.filter((l) => !["BOOKED", "LOST"].includes(l.status));
  const booked = leads.filter((l) => l.status === "BOOKED").length;
  const lost = leads.filter((l) => l.status === "LOST").length;
  const openValue = open.reduce((sum, l) => sum + (l.budgetMax ?? l.budgetMin ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Every open lead by stage — move cards forward as deals progress."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open Leads" value={open.length.toString()} icon={<KanbanSquare className="h-5 w-5" />} />
        <StatCard label="Open Value" value={formatINR(openValue)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Booked" value={booked.toString()} icon={<Target className="h-5 w-5" />} />
        <StatCard
          label="Win Rate"
          value={percent(booked, booked + lost)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <PipelineBoard columns={columns} canWrite={canWrite} />
    </div>
  );
}
