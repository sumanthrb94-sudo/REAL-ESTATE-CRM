"use client";

// Row-level controls for a site visit: status transitions (confirm, complete,
// no-show, cancel) and inline feedback capture once the visit has happened.

import * as React from "react";
import { Check, MessageSquarePlus, UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addVisitFeedbackAction,
  updateVisitStatusAction,
} from "@/server/modules/site-visits.actions";
import type { SiteVisitStatus } from "@/types/domain";

export function VisitActions({
  visitId,
  status,
  feedback,
}: {
  visitId: string;
  status: SiteVisitStatus;
  feedback?: string;
}) {
  const [error, setError] = React.useState<string | undefined>();
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const move = (next: SiteVisitStatus) => {
    startTransition(async () => {
      const result = await updateVisitStatusAction(visitId, next);
      setError(result.error);
    });
  };

  const saveFeedback = (formData: FormData) => {
    startTransition(async () => {
      const result = await addVisitFeedbackAction(visitId, formData);
      setError(result.error);
      if (!result.error) setShowFeedback(false);
    });
  };

  const open = status === "SCHEDULED" || status === "CONFIRMED";
  const done = status === "COMPLETED" || status === "NO_SHOW";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {status === "SCHEDULED" ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => move("CONFIRMED")}>
            <Check className="h-3.5 w-3.5" /> Confirm
          </Button>
        ) : null}
        {open ? (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => move("COMPLETED")}>
              <Check className="h-3.5 w-3.5" /> Completed
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => move("NO_SHOW")}>
              <UserX className="h-3.5 w-3.5" /> No-show
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => move("CANCELLED")}>
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        ) : null}
        {done && !showFeedback ? (
          <Button size="sm" variant="ghost" onClick={() => setShowFeedback(true)}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> {feedback ? "Edit feedback" : "Add feedback"}
          </Button>
        ) : null}
      </div>
      {showFeedback ? (
        <form action={saveFeedback} className="flex items-center gap-2">
          <Input
            name="feedback"
            defaultValue={feedback ?? ""}
            placeholder="Visitor feedback…"
            className="h-8 w-56 text-xs"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
