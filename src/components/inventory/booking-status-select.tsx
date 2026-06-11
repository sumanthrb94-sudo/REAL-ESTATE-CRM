"use client";

import * as React from "react";
import { Select } from "@/components/ui/input";
import { updateBookingStatusAction } from "@/server/modules/bookings.actions";
import { humanize } from "@/lib/utils";
import type { BookingStatus } from "@/types/domain";

const STATUS_OPTIONS: BookingStatus[] = ["TOKEN", "AGREEMENT", "REGISTERED", "CANCELLED"];

export function BookingStatusSelect({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | undefined>();

  return (
    <div className="space-y-1">
      <Select
        value={status}
        disabled={pending}
        className="w-44"
        aria-label="Booking status"
        onChange={(e) => {
          const next = e.target.value;
          setError(undefined);
          startTransition(async () => {
            const result = await updateBookingStatusAction(bookingId, next);
            if (result.error) setError(result.error);
          });
        }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
