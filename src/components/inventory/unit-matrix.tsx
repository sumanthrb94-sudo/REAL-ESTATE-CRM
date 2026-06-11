"use client";

import * as React from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UnitStatusSelect } from "@/components/inventory/unit-status-select";
import { cn, formatINR, formatNumber, humanize } from "@/lib/utils";
import type { Unit, UnitStatus } from "@/types/domain";
import type { TowerGroup } from "@/server/modules/inventory";

const STATUS_CHIP: Record<UnitStatus, string> = {
  AVAILABLE: "border-success/40 bg-success/15 text-success hover:bg-success/30",
  BLOCKED: "border-warning/40 bg-warning/15 text-warning hover:bg-warning/30",
  BOOKED: "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
  SOLD: "border-border bg-muted text-muted-foreground hover:bg-muted/70",
};

const LEGEND: { status: UnitStatus; swatch: string }[] = [
  { status: "AVAILABLE", swatch: "bg-success/60" },
  { status: "BLOCKED", swatch: "bg-warning/60" },
  { status: "BOOKED", swatch: "bg-primary/60" },
  { status: "SOLD", swatch: "bg-muted-foreground/40" },
];

export function UnitMatrix({
  towers,
  unassignedUnits,
  canWrite,
}: {
  towers: TowerGroup[];
  unassignedUnits: Unit[];
  canWrite: boolean;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const allUnits = React.useMemo(() => {
    const units: Unit[] = [...unassignedUnits];
    for (const group of towers) for (const floor of group.floors) units.push(...floor.units);
    return units;
  }, [towers, unassignedUnits]);

  const selected = selectedId ? (allUnits.find((u) => u.id === selectedId) ?? null) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {LEGEND.map((item) => (
            <span key={item.status} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", item.swatch)} />
              {humanize(item.status)}
            </span>
          ))}
        </div>

        {towers.map((group) => (
          <Card key={group.tower.id}>
            <CardHeader>
              <CardTitle>{group.tower.name}</CardTitle>
              <CardDescription>
                {group.tower.floors} floors · {group.unitCount} units
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {group.floors.map((floor) => (
                  <div key={floor.floor} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground">
                      F{floor.floor}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {floor.units.map((unit) => (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setSelectedId(unit.id)}
                          title={`${unit.unitNumber} · ${unit.type} · ${humanize(unit.status)}`}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                            STATUS_CHIP[unit.status],
                            selectedId === unit.id && "ring-2 ring-ring",
                          )}
                        >
                          {unit.unitNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {unassignedUnits.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Units</CardTitle>
              <CardDescription>{unassignedUnits.length} units without a tower</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {unassignedUnits.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => setSelectedId(unit.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                      STATUS_CHIP[unit.status],
                      selectedId === unit.id && "ring-2 ring-ring",
                    )}
                  >
                    {unit.unitNumber}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Unit Details</CardTitle>
            <CardDescription>
              {selected ? `Unit ${selected.unitNumber}` : "Select a unit from the matrix"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge tone={statusTone(selected.status)}>{humanize(selected.status)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{selected.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Floor</span>
                  <span className="font-medium">{selected.floor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Carpet area</span>
                  <span className="font-medium">{formatNumber(selected.carpetArea)} sq ft</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Built-up area</span>
                  <span className="font-medium">
                    {selected.builtUpArea ? `${formatNumber(selected.builtUpArea)} sq ft` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Facing</span>
                  <span className="font-medium">{selected.facing ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Base price</span>
                  <span className="font-semibold">{formatINR(selected.basePrice)}</span>
                </div>
                {canWrite ? (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Change status
                    </p>
                    <UnitStatusSelect unitId={selected.id} status={selected.status} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click any unit chip to see its specs, price and availability
                {canWrite ? " — and update its status." : "."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
