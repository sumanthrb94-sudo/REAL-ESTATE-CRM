"use client";

import * as React from "react";
import { Select } from "@/components/ui/input";
import { updateUnitStatusAction } from "@/server/modules/inventory.actions";
import { humanize } from "@/lib/utils";
import type { UnitStatus } from "@/types/domain";

const STATUS_OPTIONS: UnitStatus[] = ["AVAILABLE", "BLOCKED", "BOOKED", "SOLD"];

export function UnitStatusSelect({
  unitId,
  status,
  onChanged,
}: {
  unitId: string;
  status: UnitStatus;
  onChanged?: (status: UnitStatus) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | undefined>();

  const handleChange = (next: UnitStatus) => {
    setError(undefined);
    startTransition(async () => {
      const result = await updateUnitStatusAction(unitId, next);
      if (result.error) setError(result.error);
      else onChanged?.(next);
    });
  };

  return (
    <div className="space-y-1">
      <Select
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as UnitStatus)}
        aria-label="Unit status"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
