import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, Lock, BookmarkCheck, Tag } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader, Section, StatCard } from "@/components/ui/misc";
import { DonutChart } from "@/components/charts";
import { UnitMatrix } from "@/components/inventory/unit-matrix";
import { TowerManager } from "@/components/inventory/tower-manager";
import { ProjectForm } from "@/components/inventory/project-form";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import { getProjectDetail } from "@/server/modules/inventory";
import { formatINR, formatNumber, humanize } from "@/lib/utils";
import { UNIT_STATUS_HEX } from "@/lib/status-colors";
import type { UnitStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const STAT_ICONS: Record<UnitStatus, React.ReactNode> = {
  AVAILABLE: <CheckCircle2 className="h-5 w-5" />,
  BLOCKED: <Lock className="h-5 w-5" />,
  BOOKED: <BookmarkCheck className="h-5 w-5" />,
  SOLD: <Tag className="h-5 w-5" />,
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, detail] = await Promise.all([requirePermission("inventory.read"), getProjectDetail(id)]);
  if (!detail) notFound();

  const canWrite = can(user.role, "inventory.write");
  const { project, breakdown } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Inventory
      </Link>

      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(project.status)}>{humanize(project.status)}</Badge>
            {canWrite ? <ProjectForm project={project} /> : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {project.developer ?? "Independent"}
        </span>
        <span>
          {project.locality ? `${project.locality}, ` : ""}
          {project.city}
        </span>
        {project.reraId ? <span>RERA: {project.reraId}</span> : null}
        <span>
          {detail.towers.length} towers · {formatNumber(detail.totalUnits)} units ·{" "}
          {formatINR(detail.totalValue)} total value
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {breakdown.map((b) => (
          <StatCard
            key={b.status}
            label={`${humanize(b.status)} Units`}
            value={formatNumber(b.count)}
            delta={{ value: formatINR(b.value), positive: b.status === "AVAILABLE" }}
            icon={STAT_ICONS[b.status]}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Unit Status Mix</CardTitle>
            <CardDescription>Share of units by availability status</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={breakdown
                .filter((b) => b.count > 0)
                .map((b) => ({ name: humanize(b.status), value: b.count }))}
              // Same four colours the unit matrix below uses.
              colors={Object.fromEntries(
                (Object.keys(UNIT_STATUS_HEX) as UnitStatus[]).map((s) => [
                  humanize(s),
                  UNIT_STATUS_HEX[s],
                ]),
              )}
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Amenities</CardTitle>
            <CardDescription>What residents get at {project.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.amenities.length ? (
              <div className="flex flex-wrap gap-2">
                {project.amenities.map((a) => (
                  <Badge key={a} tone="muted" className="px-3 py-1">
                    {a}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No amenities listed yet.</p>
            )}
            <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
              {detail.towers.map((t) => (
                <div
                  key={t.tower.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
                >
                  <span className="font-medium">{t.tower.name}</span>
                  <span className="text-muted-foreground">
                    {t.tower.floors} floors · {t.unitCount} units
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <TowerManager
        projectId={project.id}
        canWrite={canWrite}
        towers={detail.towers.map((t) => ({
          id: t.tower.id,
          name: t.tower.name,
          floors: t.tower.floors,
          unitCount: t.unitCount,
        }))}
      />

      {detail.totalUnits > 0 ? (
        <Section
          title="Unit Availability Matrix"
          description="Units grouped by tower and floor — click a unit for details."
        >
          <UnitMatrix
            towers={detail.towers}
            unassignedUnits={detail.unassignedUnits}
            canWrite={canWrite}
          />
        </Section>
      ) : null}
    </div>
  );
}
