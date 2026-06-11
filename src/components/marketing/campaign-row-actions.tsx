"use client";

// EstateCRM Marketing — per-row campaign lifecycle controls.
// Renders only the transitions that are legal from the campaign's current status.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCheck, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCampaignStatusAction } from "@/server/modules/marketing.actions";
import type { CampaignStatus } from "@/types/domain";

interface ActionDef {
  to: CampaignStatus;
  label: string;
  icon: React.ReactNode;
}

const ACTIONS_BY_STATUS: Record<CampaignStatus, ActionDef[]> = {
  DRAFT: [
    { to: "SCHEDULED", label: "Schedule", icon: <CalendarClock className="h-3.5 w-3.5" /> },
    { to: "RUNNING", label: "Start", icon: <Play className="h-3.5 w-3.5" /> },
  ],
  SCHEDULED: [
    { to: "RUNNING", label: "Start", icon: <Play className="h-3.5 w-3.5" /> },
  ],
  RUNNING: [
    { to: "PAUSED", label: "Pause", icon: <Pause className="h-3.5 w-3.5" /> },
    { to: "COMPLETED", label: "Complete", icon: <CheckCheck className="h-3.5 w-3.5" /> },
  ],
  PAUSED: [
    { to: "RUNNING", label: "Resume", icon: <Play className="h-3.5 w-3.5" /> },
    { to: "COMPLETED", label: "Complete", icon: <CheckCheck className="h-3.5 w-3.5" /> },
  ],
  COMPLETED: [],
};

export function CampaignRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const actions = ACTIONS_BY_STATUS[status];

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function transition(to: CampaignStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setCampaignStatusAction(campaignId, to);
      if (!result.ok) {
        setError(result.error ?? "Transition failed");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.to}
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => transition(a.to)}
          title={`${a.label} campaign`}
        >
          {a.icon}
          {a.label}
        </Button>
      ))}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
