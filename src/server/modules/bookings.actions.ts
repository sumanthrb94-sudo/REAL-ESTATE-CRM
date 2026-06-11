"use server";

// EstateCRM — booking server actions.
// RBAC-gated wrappers around the bookings service for forms & widgets.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { createBooking, recordPayment, updateBookingStatus } from "./bookings";

export interface ActionState {
  error?: string;
}

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Invalid input";
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

async function assertBookingWrite(): Promise<void> {
  const user = await getCurrentUser();
  if (!can(user.role, "booking.write")) {
    throw new Error("You do not have permission to manage bookings.");
  }
}

export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let bookingId: string;
  try {
    await assertBookingWrite();
    const agentIdRaw = formData.get("agentId");
    const totalValueRaw = formData.get("totalValue");
    const totalValueStr = typeof totalValueRaw === "string" ? totalValueRaw.trim() : "";
    const booking = await createBooking({
      leadId: String(formData.get("leadId") ?? "").trim(),
      unitId: String(formData.get("unitId") ?? "").trim(),
      agentId:
        typeof agentIdRaw === "string" && agentIdRaw.trim() ? agentIdRaw.trim() : undefined,
      status: String(formData.get("status") ?? "TOKEN"),
      totalValue: totalValueStr ? Number(totalValueStr) : undefined,
    });
    bookingId = booking.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/bookings");
  revalidatePath("/inventory");
  redirect(`/bookings/${bookingId}`);
}

export async function updateBookingStatusAction(
  bookingId: string,
  status: string,
): Promise<ActionState> {
  try {
    await assertBookingWrite();
    await updateBookingStatus(bookingId, status);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/inventory");
  return {};
}

export async function recordPaymentAction(
  paymentId: string,
  bookingId: string,
): Promise<ActionState> {
  try {
    await assertBookingWrite();
    await recordPayment(paymentId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  return {};
}
