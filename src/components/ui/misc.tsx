import * as React from "react";
import { cn, initials } from "@/lib/utils";

// ─── Page header ──────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 card-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {delta ? (
        <p className={cn("mt-1 text-xs font-medium", delta.positive ? "text-success" : "text-destructive")}>
          {delta.value}
        </p>
      ) : null}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────
export function Section({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title ? (
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
