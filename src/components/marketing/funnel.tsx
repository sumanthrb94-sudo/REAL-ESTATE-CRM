// EstateCRM Marketing — campaign funnel visualisation.
// Pure presentational component (server-renderable): horizontal stage bars
// sized by share-of-sent, with stage-to-stage conversion rates.

import { cn, formatNumber } from "@/lib/utils";
import type { FunnelStage } from "@/server/modules/marketing";

const STAGE_COLORS: Record<FunnelStage["stage"], string> = {
  Sent: "bg-[#2563eb]",
  Delivered: "bg-[#0891b2]",
  Opened: "bg-[#16a34a]",
  Clicked: "bg-[#f59e0b]",
  Converted: "bg-[#7c3aed]",
};

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.stage}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">{s.stage}</span>
            <span className="text-muted-foreground">
              {formatNumber(s.count)}
              {i > 0 ? (
                <span className="ml-2 text-xs">
                  {s.rateOfPrevious}% of prev · {s.rateOfSent}% of sent
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", STAGE_COLORS[s.stage])}
              style={{ width: `${Math.max(s.rateOfSent, s.count > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
