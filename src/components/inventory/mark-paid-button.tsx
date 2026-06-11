"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordPaymentAction } from "@/server/modules/bookings.actions";

export function MarkPaidButton({
  paymentId,
  bookingId,
}: {
  paymentId: string;
  bookingId: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | undefined>();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await recordPaymentAction(paymentId, bookingId);
            if (result.error) setError(result.error);
          });
        }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {pending ? "Saving…" : "Mark paid"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
