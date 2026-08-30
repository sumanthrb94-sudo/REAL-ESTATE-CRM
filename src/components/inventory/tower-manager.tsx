"use client";

// Inventory entry for a project: add towers, then fill them with units either
// one at a time or by generating a floor grid. Both projects ship with no
// inventory, so this is the way stock gets into the system.

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Grid3x3, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import {
  bulkCreateUnitsAction,
  createTowerAction,
  createUnitAction,
  deleteTowerAction,
  type ActionState,
} from "@/server/modules/inventory.actions";
import { UNIT_STATUSES } from "@/types/domain";
import { formatINR, formatNumber, humanize } from "@/lib/utils";

export interface TowerRow {
  id: string;
  name: string;
  floors: number;
  unitCount: number;
}

type Mode = "none" | "tower" | "bulk" | "single";

/** Suggested unit types; the field is free text so anything else is allowed. */
const UNIT_TYPES = ["1BHK", "2BHK", "2.5BHK", "3BHK", "4BHK", "Penthouse", "Studio", "Shop"];
const FACINGS = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"];

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) return <p className="text-sm font-medium text-success">{state.success}</p>;
  return null;
}

export function TowerManager({
  projectId,
  towers,
  canWrite,
}: {
  projectId: string;
  towers: TowerRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("none");

  const [towerState, towerAction, towerPending] = useActionState<ActionState, FormData>(
    createTowerAction.bind(null, projectId),
    {},
  );
  const [bulkState, bulkAction, bulkPending] = useActionState<ActionState, FormData>(
    bulkCreateUnitsAction.bind(null, projectId),
    {},
  );
  const [unitState, unitAction, unitPending] = useActionState<ActionState, FormData>(
    createUnitAction.bind(null, projectId),
    {},
  );

  // Pull the new towers/units back down after a successful write. revalidatePath
  // alone does not reliably re-render the parent server component for a
  // useActionState form, and this page's whole point is showing what you added.
  React.useEffect(() => {
    if (towerState.success) {
      setMode("none");
      router.refresh();
    }
  }, [towerState, router]);

  React.useEffect(() => {
    if (bulkState.success) router.refresh();
  }, [bulkState, router]);

  React.useEffect(() => {
    if (unitState.success) router.refresh();
  }, [unitState, router]);

  if (!canWrite) {
    return towers.length === 0 ? (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="No towers yet"
        description="This project has no inventory. Someone with inventory permissions needs to add it."
      />
    ) : null;
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Inventory setup</CardTitle>
          <CardDescription>
            {towers.length === 0
              ? "Start by adding a tower, then generate its floors."
              : `${towers.length} tower(s) · ${formatNumber(towers.reduce((n, t) => n + t.unitCount, 0))} units`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "tower" ? "secondary" : "outline"} onClick={() => setMode(mode === "tower" ? "none" : "tower")}>
            <Plus className="h-4 w-4" /> Add tower
          </Button>
          <Button
            size="sm"
            variant={mode === "bulk" ? "secondary" : "outline"}
            disabled={towers.length === 0}
            onClick={() => setMode(mode === "bulk" ? "none" : "bulk")}
          >
            <Grid3x3 className="h-4 w-4" /> Generate floors
          </Button>
          <Button
            size="sm"
            variant={mode === "single" ? "secondary" : "outline"}
            disabled={towers.length === 0}
            onClick={() => setMode(mode === "single" ? "none" : "single")}
          >
            <Plus className="h-4 w-4" /> Single unit
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Existing towers ── */}
        {towers.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {towers.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.floors} floors · {formatNumber(t.unitCount)} units
                  </span>
                </span>
                <DeleteTowerButton towerId={t.id} projectId={projectId} name={t.name} />
              </li>
            ))}
          </ul>
        ) : null}

        {/* ── Add tower ── */}
        {mode === "tower" ? (
          <form action={towerAction} className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tower-name">Tower name *</Label>
              <Input id="tower-name" name="name" placeholder="e.g. Tower A" required maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tower-floors">Floors *</Label>
              <Input id="tower-floors" name="floors" type="number" min={1} max={200} defaultValue={10} required />
            </div>
            <div className="flex items-end gap-3 sm:col-span-3">
              <Button type="submit" disabled={towerPending}>
                {towerPending ? "Creating…" : "Create tower"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
              <Feedback state={towerState} />
            </div>
          </form>
        ) : null}

        {/* ── Generate a floor grid ── */}
        {mode === "bulk" ? (
          <form action={bulkAction} className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
            <p className="text-sm text-muted-foreground sm:col-span-3">
              Creates one unit per position on every floor in the range. Unit numbers follow{" "}
              <code className="rounded bg-muted px-1 text-xs">A-1201</code> — tower, floor, then position.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tower">Tower *</Label>
              <Select id="bulk-tower" name="towerId" required>
                {towers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.floors} floors)
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-from">First floor *</Label>
              <Input id="bulk-from" name="fromFloor" type="number" min={0} max={200} defaultValue={1} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-to">Last floor *</Label>
              <Input id="bulk-to" name="toFloor" type="number" min={0} max={200} defaultValue={10} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-per-floor">Units per floor *</Label>
              <Input id="bulk-per-floor" name="unitsPerFloor" type="number" min={1} max={20} defaultValue={4} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-type">Unit type *</Label>
              <Input id="bulk-type" name="type" list="unit-types" placeholder="e.g. 2BHK" required />
              <datalist id="unit-types">
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-carpet">Carpet area (sq ft) *</Label>
              <Input id="bulk-carpet" name="carpetArea" type="number" min={1} step={1} placeholder="e.g. 950" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-builtup">Built-up area (sq ft)</Label>
              <Input id="bulk-builtup" name="builtUpArea" type="number" min={0} step={1} placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-facing">Facing</Label>
              <Select id="bulk-facing" name="facing" defaultValue="">
                <option value="">— Not set —</option>
                {FACINGS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-rate">Rate (₹ per sq ft) *</Label>
              <Input id="bulk-rate" name="ratePerSqFt" type="number" min={1} step={1} placeholder="e.g. 12000" required />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Button type="submit" disabled={bulkPending}>
                {bulkPending ? "Generating…" : "Generate units"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
              <Feedback state={bulkState} />
            </div>
          </form>
        ) : null}

        {/* ── Single unit ── */}
        {mode === "single" ? (
          <form action={unitAction} className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit-tower">Tower *</Label>
              <Select id="unit-tower" name="towerId" required>
                {towers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-number">Unit number *</Label>
              <Input id="unit-number" name="unitNumber" placeholder="e.g. A-1203" required maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-floor">Floor *</Label>
              <Input id="unit-floor" name="floor" type="number" min={0} max={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-type">Type *</Label>
              <Input id="unit-type" name="type" list="unit-types" placeholder="e.g. 3BHK" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-carpet">Carpet area (sq ft) *</Label>
              <Input id="unit-carpet" name="carpetArea" type="number" min={1} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-builtup">Built-up area (sq ft)</Label>
              <Input id="unit-builtup" name="builtUpArea" type="number" min={0} placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-facing">Facing</Label>
              <Select id="unit-facing" name="facing" defaultValue="">
                <option value="">— Not set —</option>
                {FACINGS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-price">Base price (₹) *</Label>
              <Input id="unit-price" name="basePrice" type="number" min={0} step={1000} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-status">Status</Label>
              <Select id="unit-status" name="status" defaultValue="AVAILABLE">
                {UNIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Button type="submit" disabled={unitPending}>
                {unitPending ? "Creating…" : "Create unit"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
              <Feedback state={unitState} />
            </div>
          </form>
        ) : null}

        {towers.length === 0 && mode === "none" ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No towers yet"
            description="Add a tower, then generate its floors to create the unit matrix."
            action={
              <Button onClick={() => setMode("tower")}>
                <Plus className="h-4 w-4" /> Add the first tower
              </Button>
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeleteTowerButton({
  towerId,
  projectId,
  name,
}: {
  towerId: string;
  projectId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function onDelete() {
    if (!window.confirm(`Delete ${name} and all of its units? This cannot be undone.`)) return;
    setPending(true);
    setError(undefined);
    const result = await deleteTowerAction(towerId, projectId);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      {error ? (
        <span role="alert" className="max-w-40 text-xs text-destructive">
          {error}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Delete ${name}`}
        className="text-destructive hover:bg-destructive/10"
      >
        {pending ? <X className="h-4 w-4 animate-pulse" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </span>
  );
}

/** Re-exported so the project page can show a price hint without duplicating it. */
export { formatINR };
