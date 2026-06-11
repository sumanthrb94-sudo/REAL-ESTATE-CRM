"use client";

// Pipeline stage changer for a single lead. Moving to LOST asks for a reason
// before committing; every transition is logged as a STATUS_CHANGE activity.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { changeLeadStatusAction } from "@/server/modules/leads.actions";
import { LEAD_STATUSES, type LeadStatus } from "@/types/domain";
import { humanize } from "@/lib/utils";

export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pendingLost, setPendingLost] = React.useState(false);
  const [lostReason, setLostReason] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [isPending, startTransition] = React.useTransition();

  const commit = (next: LeadStatus, reason?: string) => {
    startTransition(async () => {
      const result = await changeLeadStatusAction(leadId, next, reason);
      setError(result.error);
      if (!result.error) {
        setPendingLost(false);
        setLostReason("");
      }
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`status-${leadId}`}>Pipeline Stage</Label>
      <Select
        id={`status-${leadId}`}
        value={pendingLost ? "LOST" : status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          if (next === "LOST") setPendingLost(true);
          else {
            setPendingLost(false);
            commit(next);
          }
        }}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      {pendingLost ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <Label htmlFor={`lost-reason-${leadId}`}>Lost reason</Label>
          <Input
            id={`lost-reason-${leadId}`}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="e.g. Budget mismatch"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={isPending} onClick={() => commit("LOST", lostReason)}>
              {isPending ? "Saving…" : "Mark Lost"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingLost(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
