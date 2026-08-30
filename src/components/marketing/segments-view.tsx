"use client";

// EstateCRM Marketing — segment cards (live counts + sample matches) with
// create/edit/delete wired to the segment builder.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Filter, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/misc";
import { formatDate, formatINR, formatNumber, humanize } from "@/lib/utils";
import { deleteSegmentAction } from "@/server/modules/marketing.actions";
import { SegmentBuilder } from "@/components/marketing/segment-builder";
import { describeFilter } from "@/components/marketing/shared";
import type { Segment } from "@/types/domain";

export interface SegmentWithAudience {
  segment: Segment;
  count: number;
  sample: { id: string; name: string; status: string; temperature: string; score: number }[];
}

export function SegmentsView({
  segments,
  canWrite,
}: {
  segments: SegmentWithAudience[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [builder, setBuilder] = React.useState<{ open: boolean; segment?: Segment }>({ open: false });
  const [pending, startTransition] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function remove(id: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteSegmentAction(id);
      if (!result.ok) setDeleteError(result.error ?? "Failed to delete segment");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canWrite && !builder.open ? (
        <div className="flex justify-end">
          <Button onClick={() => setBuilder({ open: true })}>
            <Plus className="h-4 w-4" /> New Segment
          </Button>
        </div>
      ) : null}

      {builder.open ? (
        <SegmentBuilder
          key={builder.segment?.id ?? "new"}
          segment={builder.segment}
          onClose={() => setBuilder({ open: false })}
        />
      ) : null}

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

      {segments.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="No segments yet"
          description="Build your first audience segment to target campaigns at exactly the right leads."
          action={canWrite ? (
            <Button onClick={() => setBuilder({ open: true })}>
              <Plus className="h-4 w-4" /> New Segment
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {segments.map(({ segment, count, sample }) => (
            <Card key={segment.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">{segment.name}</CardTitle>
                  {segment.description ? (
                    <CardDescription className="mt-1">{segment.description}</CardDescription>
                  ) : null}
                </div>
                <Badge tone="primary" className="shrink-0">
                  <Users className="mr-1 h-3 w-3" />
                  {formatNumber(count)} lead{count === 1 ? "" : "s"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {segment.filters.map((f, i) => (
                    <Badge key={i} tone="muted">
                      {describeFilter({ field: String(f.field), op: f.op, value: f.value }, formatINR)}
                    </Badge>
                  ))}
                </div>

                {sample.length > 0 ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sample matches
                    </p>
                    <ul className="space-y-2">
                      {sample.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 text-sm">
                          <Avatar name={l.name} className="h-6 w-6 text-[10px]" />
                          <span className="font-medium">{l.name}</span>
                          <Badge tone={statusTone(l.status)}>{humanize(l.status)}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground">Score {l.score}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No leads currently match this segment.
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Created {formatDate(segment.createdAt)}</span>
                  {canWrite ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBuilder({ open: true, segment })}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => remove(segment.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
