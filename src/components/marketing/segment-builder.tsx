"use client";

// EstateCRM Marketing — segment builder: name/description plus dynamic
// field/op/value filter rows, with an ad-hoc audience preview before saving.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, X } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { humanize } from "@/lib/utils";
import {
  createSegmentAction,
  previewSegmentAction,
  updateSegmentAction,
} from "@/server/modules/marketing.actions";
import {
  OP_LABELS,
  SEGMENT_FIELDS,
  SEGMENT_OPS,
  formatFilterValue,
  parseFilterValue,
  type SegmentOp,
} from "@/components/marketing/shared";
import type { Lead, Segment, SegmentFilter } from "@/types/domain";

interface FilterRow {
  field: keyof Lead;
  op: SegmentOp;
  raw: string;
}

interface PreviewState {
  count: number;
  sample: { id: string; name: string; status: string; temperature: string }[];
}

function toRows(filters: SegmentFilter[]): FilterRow[] {
  return filters.map((f) => ({
    field: f.field,
    op: f.op,
    raw: formatFilterValue(f.value),
  }));
}

function toFilters(rows: FilterRow[]): SegmentFilter[] {
  return rows
    .filter((r) => r.raw.trim().length > 0)
    .map((r) => ({
      field: r.field,
      op: r.op,
      value: parseFilterValue(r.field, r.op, r.raw),
    }));
}

export function SegmentBuilder({
  segment,
  onClose,
}: {
  /** Existing segment to edit; omit to create a new one. */
  segment?: Segment;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [previewPending, startPreview] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);

  const [name, setName] = React.useState(segment?.name ?? "");
  const [description, setDescription] = React.useState(segment?.description ?? "");
  const [rows, setRows] = React.useState<FilterRow[]>(
    segment ? toRows(segment.filters) : [{ field: "temperature", op: "eq", raw: "" }],
  );

  function updateRow(index: number, patch: Partial<FilterRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setPreview(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { field: "status", op: "eq", raw: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setPreview(null);
  }

  function runPreview() {
    setError(null);
    const filters = toFilters(rows);
    if (filters.length === 0) {
      setError("Fill in at least one filter value to preview the audience.");
      return;
    }
    startPreview(async () => {
      const result = await previewSegmentAction(filters);
      if (result.ok && result.count !== undefined) {
        setPreview({ count: result.count, sample: result.sample ?? [] });
      } else {
        setError(result.error ?? "Preview failed");
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const filters = toFilters(rows);
    if (filters.length === 0) {
      setError("Add at least one filter with a value.");
      return;
    }
    const input = { name, description: description || undefined, filters };
    startTransition(async () => {
      const result = segment
        ? await updateSegmentAction(segment.id, input)
        : await createSegmentAction(input);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? "Failed to save segment");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{segment ? `Edit: ${segment.name}` : "New Segment"}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close builder">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="seg-name">Name</Label>
              <Input
                id="seg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hot Mumbai Buyers"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seg-desc">Description</Label>
              <Input
                id="seg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who is this audience?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filters <span className="font-normal text-muted-foreground">(leads must match all)</span></Label>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const def = SEGMENT_FIELDS.find((f) => f.field === row.field);
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
                    <Select
                      aria-label="Field"
                      className="sm:w-44"
                      value={String(row.field)}
                      onChange={(e) => updateRow(i, { field: e.target.value as keyof Lead, raw: "" })}
                    >
                      {SEGMENT_FIELDS.map((f) => (
                        <option key={String(f.field)} value={String(f.field)}>{f.label}</option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Operator"
                      className="sm:w-36"
                      value={row.op}
                      onChange={(e) => updateRow(i, { op: e.target.value as SegmentOp })}
                    >
                      {SEGMENT_OPS.map((op) => (
                        <option key={op} value={op}>{OP_LABELS[op]}</option>
                      ))}
                    </Select>
                    <Input
                      aria-label="Value"
                      className="flex-1"
                      value={row.raw}
                      onChange={(e) => updateRow(i, { raw: e.target.value })}
                      placeholder={
                        row.op === "in"
                          ? "Comma-separated values, e.g. HOT, WARM"
                          : def?.options
                            ? `e.g. ${def.options.slice(0, 3).join(", ")}`
                            : def?.kind === "number"
                              ? "e.g. 5000000"
                              : "Value"
                      }
                      list={def?.options ? `seg-options-${i}` : undefined}
                    />
                    {def?.options ? (
                      <datalist id={`seg-options-${i}`}>
                        {def.options.map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(i)}
                      disabled={rows.length === 1}
                      aria-label="Remove filter"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Add filter
            </Button>
          </div>

          {preview ? (
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                {preview.count} matching lead{preview.count === 1 ? "" : "s"}
              </p>
              {preview.sample.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {preview.sample.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      <span>{l.name}</span>
                      <Badge tone={statusTone(l.status)}>{humanize(l.status)}</Badge>
                      <Badge tone={l.temperature === "HOT" ? "destructive" : l.temperature === "WARM" ? "warning" : "muted"}>
                        {humanize(l.temperature)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : segment ? "Save Changes" : "Create Segment"}
            </Button>
            <Button type="button" variant="outline" disabled={previewPending} onClick={runPreview}>
              {previewPending ? "Evaluating…" : "Preview audience"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
