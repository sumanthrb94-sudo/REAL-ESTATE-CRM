"use client";

// Kanban pipeline board. One column per LeadStatus with counts and value
// totals; cards move stages via a compact select (logged as STATUS_CHANGE).

import * as React from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { changeLeadStatusAction } from "@/server/modules/leads.actions";
import { LEAD_STATUSES, type LeadStatus, type LeadTemperature } from "@/types/domain";
import { cn, formatINR, humanize } from "@/lib/utils";

export interface PipelineCard {
  id: string;
  name: string;
  value: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  score: number;
  ownerName: string | null;
  projectName: string | null;
}

export interface PipelineColumn {
  status: LeadStatus;
  leads: PipelineCard[];
  total: number;
}

const temperatureTone: Record<LeadTemperature, "destructive" | "warning" | "muted"> = {
  HOT: "destructive",
  WARM: "warning",
  COLD: "muted",
};

function MoveSelect({ card, disabled }: { card: PipelineCard; disabled: boolean }) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <select
      aria-label={`Move ${card.name}`}
      className="h-7 w-full rounded-md border border-input bg-card px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      value={card.status}
      disabled={disabled || isPending}
      onChange={(e) => {
        const next = e.target.value as LeadStatus;
        if (next === card.status) return;
        const lostReason =
          next === "LOST" ? (window.prompt("Lost reason?", "Not specified") ?? undefined) : undefined;
        if (next === "LOST" && lostReason === undefined) return; // prompt cancelled
        startTransition(async () => {
          await changeLeadStatusAction(card.id, next, lostReason);
        });
      }}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s === card.status ? `Stage: ${humanize(s)}` : `Move to ${humanize(s)}`}
        </option>
      ))}
    </select>
  );
}

export function PipelineBoard({ columns, canWrite }: { columns: PipelineColumn[]; canWrite: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.status}
          className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(col.status)}>{humanize(col.status)}</Badge>
              <span className="text-xs font-medium text-muted-foreground">{col.leads.length}</span>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{formatINR(col.total)}</span>
          </div>
          <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
            {col.leads.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No leads</p>
            ) : (
              col.leads.map((card) => (
                <div key={card.id} className="space-y-2 rounded-md border border-border bg-card p-3 card-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/leads/${card.id}`}
                      className="text-sm font-medium leading-tight hover:underline"
                    >
                      {card.name}
                    </Link>
                    <Badge tone={temperatureTone[card.temperature]}>{humanize(card.temperature)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatINR(card.value)}</span>
                    <span
                      className={cn(
                        "font-medium",
                        card.score >= 70 ? "text-success" : card.score >= 40 ? "text-warning" : undefined,
                      )}
                    >
                      Score {card.score}
                    </span>
                  </div>
                  {card.projectName ? (
                    <p className="truncate text-xs text-muted-foreground">{card.projectName}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {card.ownerName ? (
                      <>
                        <Avatar name={card.ownerName} className="h-6 w-6 text-[10px]" />
                        <span className="truncate text-xs text-muted-foreground">{card.ownerName}</span>
                      </>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                  {canWrite ? <MoveSelect card={card} disabled={!canWrite} /> : null}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
