"use client";

// Catches render and data-fetch failures inside the dashboard.
//
// Firestore lives in Mumbai and every page here is force-dynamic, so a dropped
// connection or a permissions change surfaces as a thrown error mid-render.
// Without this boundary Next.js falls back to its own error screen, which
// strands the user outside the app shell with no way back.

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[dashboard] render failed:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-border bg-card p-8 text-center card-shadow"
    >
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">This page could not load</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong reaching the database. Your data is safe — retrying usually clears it.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-6">
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
