import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "success" | "warning" | "destructive" | "muted";

const tones: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

// Convenience: map common domain enums to a tone.
export function statusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (["BOOKED", "REGISTERED", "PAID", "ACTIVE", "COMPLETED", "AVAILABLE", "SOLD"].includes(s)) return "success";
  if (["LOST", "CANCELLED", "OVERDUE", "SUSPENDED", "NO_SHOW", "SOLD_OUT"].includes(s)) return "destructive";
  if (["NEGOTIATION", "PENDING", "SCHEDULED", "BLOCKED", "PAUSED", "UPCOMING"].includes(s)) return "warning";
  if (["NEW", "RUNNING", "QUALIFIED"].includes(s)) return "primary";
  return "muted";
}
