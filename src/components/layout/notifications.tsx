"use client";

// Notification bell. The dot only lights when there is something to act on —
// each entry is derived from live data by server/modules/alerts.ts.

import * as React from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Info, CircleAlert } from "lucide-react";
import type { Alert, AlertTone } from "@/server/modules/alerts";
import { cn } from "@/lib/utils";

const TONE_ICON: Record<AlertTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  critical: CircleAlert,
};

const TONE_CLASS: Record<AlertTone, string> = {
  info: "text-primary",
  warning: "text-warning",
  critical: "text-destructive",
};

export function Notifications({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasCritical = alerts.some((a) => a.tone === "critical");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={alerts.length ? `Notifications, ${alerts.length} items` : "Notifications, none"}
        aria-expanded={open}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {alerts.length > 0 ? (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
              hasCritical ? "bg-destructive" : "bg-warning",
            )}
          />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Needs attention</p>
          </div>
          {alerts.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {alerts.map((a) => {
                const Icon = TONE_ICON[a.tone];
                return (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_CLASS[a.tone])} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{a.title}</span>
                        <span className="block text-xs text-muted-foreground">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
