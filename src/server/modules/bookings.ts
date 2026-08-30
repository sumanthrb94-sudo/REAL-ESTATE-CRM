// EstateCRM — bookings service.
// Bookings tie a lead to a unit; creating one flips the unit to BOOKED and
// generates the standard payment milestone schedule. All inputs zod-validated.

import { z } from "zod";
import { db } from "@/server/db";
import type {
  Booking,
  BookingStatus,
  Lead,
  Payment,
  PaymentStatus,
  Project,
  Unit,
  UnitStatus,
  User,
} from "@/types/domain";

export const BOOKING_STATUSES = [
  "TOKEN",
  "AGREEMENT",
  "REGISTERED",
  "CANCELLED",
] as const satisfies readonly BookingStatus[];

// ─── Schemas ────────────────────────────────────────────────────────────────
export const bookingInputSchema = z.object({
  leadId: z.string().trim().min(1, "Lead is required"),
  unitId: z.string().trim().min(1, "Unit is required"),
  agentId: z.string().trim().min(1).optional(),
  status: z.enum(BOOKING_STATUSES).default("TOKEN"),
  totalValue: z
    .number({ invalid_type_error: "Total value must be a number" })
    .int("Total value must be a whole rupee amount")
    .positive("Total value must be positive")
    .optional(),
});
export type BookingInput = z.input<typeof bookingInputSchema>;

const bookingFilterSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
});
export type BookingFilter = z.input<typeof bookingFilterSchema>;

const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/** Standard payment milestone plan applied to every new booking. */
const MILESTONE_PLAN = [
  { milestone: "Booking Token", pct: 0.1, dueInDays: 0 },
  { milestone: "Agreement", pct: 0.2, dueInDays: 30 },
  { milestone: "Slab Completion", pct: 0.4, dueInDays: 90 },
  { milestone: "Possession", pct: 0.3, dueInDays: 180 },
] as const;

// ─── Result shapes ──────────────────────────────────────────────────────────
export interface BookingRow {
  booking: Booking;
  leadName: string;
  projectName: string;
  unitNumber: string;
  unitType?: string;
  agentName?: string;
}

export interface PaymentProgress {
  totalAmount: number;
  paidAmount: number;
  pct: number;
  paidCount: number;
  totalCount: number;
}

export interface BookingDetail {
  booking: Booking;
  lead: Lead | null;
  unit: Unit | null;
  project: Project | null;
  agent: User | null;
  payments: Payment[];
  progress: PaymentProgress;
}

export interface BookingStats {
  totalBookings: number;
  totalValue: number; // non-cancelled bookings
  byStatus: Record<BookingStatus, number>;
  collected: number;
  outstanding: number;
  overdueCount: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────
export async function listBookings(filter: BookingFilter = {}): Promise<BookingRow[]> {
  const f = bookingFilterSchema.parse(filter);
  const [bookings, leads, projects, units, users] = await Promise.all([
    db.bookings.list({
      where: {
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.status ? { status: f.status } : {}),
      },
      orderBy: { field: "bookedAt", dir: "desc" },
    }),
    db.leads.list(),
    db.projects.list(),
    db.units.list(),
    db.users.list(),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return bookings.map((booking) => {
    const unit = unitById.get(booking.unitId);
    return {
      booking,
      leadName: leadById.get(booking.leadId)?.name ?? "Unknown lead",
      projectName: projectById.get(booking.projectId)?.name ?? "Unknown project",
      unitNumber: unit?.unitNumber ?? "—",
      unitType: unit?.type,
      agentName: booking.agentId ? userById.get(booking.agentId)?.name : undefined,
    };
  });
}

export async function getBookingDetail(id: string): Promise<BookingDetail | null> {
  const booking = await db.bookings.find(id);
  if (!booking) return null;

  const [lead, unit, project, agent, payments] = await Promise.all([
    db.leads.find(booking.leadId),
    db.units.find(booking.unitId),
    db.projects.find(booking.projectId),
    booking.agentId ? db.users.find(booking.agentId) : Promise.resolve(null),
    db.payments.list({ where: { bookingId: id }, orderBy: { field: "dueDate", dir: "asc" } }),
  ]);

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paid = payments.filter((p) => p.status === "PAID");
  const paidAmount = paid.reduce((sum, p) => sum + p.amount, 0);

  return {
    booking,
    lead,
    unit,
    project,
    agent,
    payments,
    progress: {
      totalAmount,
      paidAmount,
      pct: totalAmount ? Math.round((paidAmount / totalAmount) * 100) : 0,
      paidCount: paid.length,
      totalCount: payments.length,
    },
  };
}

// ─── Form options ───────────────────────────────────────────────────────────
export interface BookingFormOptions {
  leads: { id: string; name: string; phone: string }[];
  units: { id: string; projectId: string; unitNumber: string; type: string; basePrice: number }[];
  projects: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}

/** Option lists for the "New Booking" form: bookable leads, open units, projects, agents. */
export async function getBookingFormOptions(): Promise<BookingFormOptions> {
  const [leads, units, projects, users, bookings] = await Promise.all([
    db.leads.list({ orderBy: { field: "name", dir: "asc" } }),
    db.units.list({ orderBy: { field: "unitNumber", dir: "asc" } }),
    db.projects.list({ orderBy: { field: "name", dir: "asc" } }),
    db.users.list(),
    db.bookings.list(),
  ]);

  const leadsWithActiveBooking = new Set(
    bookings.filter((b) => b.status !== "CANCELLED").map((b) => b.leadId),
  );

  return {
    leads: leads
      .filter((l) => l.status !== "LOST" && !leadsWithActiveBooking.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, phone: l.phone })),
    units: units
      .filter((u) => u.status === "AVAILABLE" || u.status === "BLOCKED")
      .map((u) => ({
        id: u.id,
        projectId: u.projectId,
        unitNumber: u.unitNumber,
        type: u.type,
        basePrice: u.basePrice,
      })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    agents: users
      .filter((u) => u.active && ["SALES_AGENT", "SALES_MANAGER", "SALES_HEAD"].includes(u.role))
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

// ─── Mutations ──────────────────────────────────────────────────────────────
export async function createBooking(input: unknown): Promise<Booking> {
  const data = bookingInputSchema.parse(input);

  const [lead, unit] = await Promise.all([
    db.leads.find(data.leadId),
    db.units.find(data.unitId),
  ]);
  if (!lead) throw new Error("Lead not found");
  if (!unit) throw new Error("Unit not found");
  if (unit.status === "BOOKED" || unit.status === "SOLD") {
    throw new Error(`Unit ${unit.unitNumber} is already ${unit.status.toLowerCase()}`);
  }
  const existing = await db.bookings.findOne({ unitId: unit.id });
  if (existing && existing.status !== "CANCELLED") {
    throw new Error(`Unit ${unit.unitNumber} already has an active booking`);
  }

  const totalValue = data.totalValue ?? unit.basePrice;
  const nowIso = new Date().toISOString();
  const booking = await db.bookings.create({
    leadId: lead.id,
    unitId: unit.id,
    projectId: unit.projectId,
    agentId: data.agentId ?? lead.ownerId,
    status: data.status,
    totalValue,
    bookedAt: nowIso,
  });

  // Side effects: flip the unit, advance the lead, lay out the payment plan.
  await db.units.update(unit.id, { status: "BOOKED" });
  await db.leads.update(lead.id, { status: "BOOKED", updatedAt: nowIso });

  const day = 86_400_000;
  await Promise.all(
    MILESTONE_PLAN.map((m, i) =>
      db.payments.create({
        bookingId: booking.id,
        milestone: m.milestone,
        amount: Math.round(totalValue * m.pct),
        dueDate: new Date(Date.now() + m.dueInDays * day).toISOString(),
        // The booking token is collected at booking time; the rest are due later.
        ...paymentStatusPatch(i === 0 ? "PAID" : "PENDING", nowIso),
      }),
    ),
  );

  return booking;
}

export async function updateBookingStatus(id: string, status: unknown): Promise<Booking> {
  const parsed = bookingStatusSchema.parse(status);
  const booking = await db.bookings.find(id);
  if (!booking) throw new Error("Booking not found");

  const updated = await db.bookings.update(id, { status: parsed });
  if (!updated) throw new Error("Booking not found");

  // Keep the unit in sync with the booking lifecycle.
  const unitStatus: UnitStatus =
    parsed === "CANCELLED" ? "AVAILABLE" : parsed === "REGISTERED" ? "SOLD" : "BOOKED";
  await db.units.update(booking.unitId, { status: unitStatus });

  return updated;
}

/**
 * The only place a payment's status is set.
 *
 * PAID and `paidAt` must move together — a milestone showing a green "Paid"
 * badge beside an empty Paid On column is a data bug that reads as a UI bug.
 * Routing every status change through here keeps the two in lockstep.
 */
export function paymentStatusPatch(
  status: PaymentStatus,
  paidAt = new Date().toISOString(),
): Pick<Payment, "status" | "paidAt"> {
  return status === "PAID" ? { status, paidAt } : { status, paidAt: undefined };
}

/** True when a payment record violates the PAID ⇔ paidAt invariant. */
export function isPaymentConsistent(payment: Pick<Payment, "status" | "paidAt">): boolean {
  return payment.status === "PAID" ? Boolean(payment.paidAt) : true;
}

/** Mark a milestone payment as PAID. */
export async function recordPayment(paymentId: string): Promise<Payment> {
  const payment = await db.payments.find(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "PAID") return payment;

  const updated = await db.payments.update(paymentId, paymentStatusPatch("PAID"));
  if (!updated) throw new Error("Payment not found");
  return updated;
}

// ─── Stats ──────────────────────────────────────────────────────────────────
export async function getBookingStats(): Promise<BookingStats> {
  const [bookings, payments] = await Promise.all([db.bookings.list(), db.payments.list()]);

  const byStatus: Record<BookingStatus, number> = {
    TOKEN: 0,
    AGREEMENT: 0,
    REGISTERED: 0,
    CANCELLED: 0,
  };
  for (const b of bookings) byStatus[b.status] += 1;

  const activeBookingIds = new Set(
    bookings.filter((b) => b.status !== "CANCELLED").map((b) => b.id),
  );
  const activePayments = payments.filter((p) => activeBookingIds.has(p.bookingId));

  return {
    totalBookings: bookings.length,
    totalValue: bookings
      .filter((b) => b.status !== "CANCELLED")
      .reduce((sum, b) => sum + b.totalValue, 0),
    byStatus,
    collected: activePayments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0),
    outstanding: activePayments
      .filter((p) => p.status !== "PAID")
      .reduce((sum, p) => sum + p.amount, 0),
    overdueCount: activePayments.filter((p) => p.status === "OVERDUE").length,
  };
}
