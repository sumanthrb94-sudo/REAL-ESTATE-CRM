"use client";

import * as React from "react";
import { BadgeCheck, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPartnerStatusAction } from "@/server/modules/partners.actions";
import type { PartnerStatus } from "@/types/domain";

export function PartnerStatusActions({
  partnerId,
  status,
}: {
  partnerId: string;
  status: PartnerStatus;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function transition(next: PartnerStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setPartnerStatusAction(partnerId, next);
      if (!result.ok) setError(result.error ?? "Failed to update status");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {status === "PENDING" ? (
          <Button size="sm" onClick={() => transition("ACTIVE")} disabled={pending}>
            <BadgeCheck className="h-3.5 w-3.5" />
            Approve
          </Button>
        ) : null}
        {status === "SUSPENDED" ? (
          <Button size="sm" variant="outline" onClick={() => transition("ACTIVE")} disabled={pending}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reinstate
          </Button>
        ) : null}
        {status !== "SUSPENDED" ? (
          <Button size="sm" variant="destructive" onClick={() => transition("SUSPENDED")} disabled={pending}>
            <Ban className="h-3.5 w-3.5" />
            Suspend
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
