"use client";

// Active/paused switch for a distribution rule.

import * as React from "react";
import { toggleRuleAction } from "@/server/modules/distribution.actions";
import { cn } from "@/lib/utils";

export function RuleToggle({ ruleId, active }: { ruleId: string; active: boolean }) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Pause rule" : "Activate rule"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleRuleAction(ruleId);
        })
      }
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        active ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform",
          active ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
