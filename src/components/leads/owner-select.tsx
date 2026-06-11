"use client";

// Owner reassignment dropdown (lead.assign permission gated server-side too).

import * as React from "react";
import { Label, Select } from "@/components/ui/input";
import { reassignLeadAction } from "@/server/modules/leads.actions";
import type { Option } from "@/components/leads/lead-form";

export function OwnerSelect({
  leadId,
  ownerId,
  owners,
}: {
  leadId: string;
  ownerId?: string;
  owners: Option[];
}) {
  const [error, setError] = React.useState<string | undefined>();
  const [isPending, startTransition] = React.useTransition();

  return (
    <div className="space-y-2">
      <Label htmlFor={`owner-${leadId}`}>Owner</Label>
      <Select
        id={`owner-${leadId}`}
        value={ownerId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            const result = await reassignLeadAction(leadId, next);
            setError(result.error);
          });
        }}
      >
        <option value="">Unassigned</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
