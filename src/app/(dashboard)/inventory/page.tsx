import Link from "next/link";
import { Building2, IndianRupee, Layers, PackageOpen } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { ProjectForm } from "@/components/inventory/project-form";
import { can } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guard";
import {
  listProjectCities,
  listProjects,
  PROJECT_STATUSES,
  type ProjectSummary,
} from "@/server/modules/inventory";
import { formatINR, formatNumber, humanize, percent } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ProjectCard({ summary }: { summary: ProjectSummary }) {
  const { project } = summary;
  return (
    <Link href={`/inventory/${project.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        {project.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImage}
            alt={project.name}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/15 via-accent to-secondary">
            <Building2 className="h-10 w-10 text-primary/50" />
          </div>
        )}
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold tracking-tight group-hover:underline">{project.name}</p>
              <p className="text-sm text-muted-foreground">
                {project.locality ? `${project.locality}, ` : ""}
                {project.city}
              </p>
            </div>
            <Badge tone={statusTone(project.status)}>{humanize(project.status)}</Badge>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {project.developer ? <p>By {project.developer}</p> : null}
            {project.reraId ? <p className="text-xs">RERA: {project.reraId}</p> : null}
          </div>
          <div className="space-y-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available units</span>
              <span className="font-medium">
                {formatNumber(summary.availableUnits)} / {formatNumber(summary.totalUnits)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success"
                style={{
                  width: summary.totalUnits
                    ? `${Math.round((summary.availableUnits / summary.totalUnits) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available value</span>
              <span className="font-semibold">{formatINR(summary.availableValue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const cityParam = first(sp.city);
  const statusParam = first(sp.status);
  const city = cityParam && cityParam !== "ALL" ? cityParam : undefined;
  const status = PROJECT_STATUSES.find((s) => s === statusParam);

  const [user, summaries, cities] = await Promise.all([
    requirePermission("inventory.read"),
    listProjects({ city, status }),
    listProjectCities(),
  ]);
  const canWrite = can(user.role, "inventory.write");

  const totalUnits = summaries.reduce((sum, s) => sum + s.totalUnits, 0);
  const availableUnits = summaries.reduce((sum, s) => sum + s.availableUnits, 0);
  const availableValue = summaries.reduce((sum, s) => sum + s.availableValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Projects, towers and unit availability across the portfolio."
        actions={canWrite ? <ProjectForm /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={summaries.length.toString()}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="Total Units"
          value={formatNumber(totalUnits)}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          label="Available Units"
          value={formatNumber(availableUnits)}
          delta={{ value: `${percent(availableUnits, totalUnits)} of stock`, positive: true }}
          icon={<PackageOpen className="h-5 w-5" />}
        />
        <StatCard
          label="Available Value"
          value={formatINR(availableValue)}
          icon={<IndianRupee className="h-5 w-5" />}
        />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="filter-city" className="text-xs font-medium text-muted-foreground">
            City
          </label>
          <select
            id="filter-city"
            name="city"
            defaultValue={cityParam ?? "ALL"}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
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
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {city || status ? (
          <Link
            href="/inventory"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {summaries.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No projects match these filters"
          description="Try a different city or status, or add a new project to the portfolio."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <ProjectCard key={summary.project.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}
