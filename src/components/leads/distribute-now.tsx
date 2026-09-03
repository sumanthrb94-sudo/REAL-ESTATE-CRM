"use client";

// "Distribute now" — place every ownerless lead against the active rules.
//
// The result is reported in full (who received how many) rather than as a
// bare success, because the interesting outcome is the split.

import * as React from "react";
import { Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distributeNowAction } from "@/server/modules/distribution.actions";
import type { ActionState } from "@/server/modules/leads.actions";

export function DistributeNow({ unassigned }: { unassigned: number }) {
  const [state, setState] = React.useState<ActionState>({});
  const [pending, start] = React.useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={unassigned > 0 ? "primary" : "outline"}
        disabled={pending}
        onClick={() => start(async () => setState(await distributeNowAction()))}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
        {unassigned > 0 ? `Distribute ${unassigned} unassigned` : "Distribute now"}
      </Button>
      {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-medium text-success">{state.success}</p> : null}
    </div>
  );
}
