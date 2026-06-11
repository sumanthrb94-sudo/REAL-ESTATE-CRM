// EstateCRM — channel partner service.
// Directory, onboarding, approval workflow and commission computation for
// broker/channel-partner sourced business. All reads/writes go through the
// shared DataStore; inputs are validated with zod before touching the store.

import { z } from "zod";
import { db } from "@/server/db";
import type {
  Booking,
  ChannelPartner,
  Lead,
  PartnerStatus,
} from "@/types/domain";

// ─── Validation ─────────────────────────────────────────────────────────────

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(2, "Partner name must be at least 2 characters"),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
  company: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email("Enter a valid email address").optional(),
  reraId: z.string().trim().min(1).max(60).optional(),
  city: z.string().trim().min(1).max(60).optional(),
  commissionPct: z.coerce
    .number({ invalid_type_error: "Commission must be a number" })
    .min(0, "Commission cannot be negative")
    .max(15, "Commission cannot exceed 15%"),
});

export const partnerUpdateSchema = partnerCreateSchema.partial();

export const partnerStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    throw new Error(message);
  }
  return result.data;
}

// ─── Commission helpers ──────────────────────────────────────────────────────

/** Bookings that count toward commission: any non-cancelled booking on a partner-sourced lead. */
function commissionableBookings(leadIds: Set<string>, bookings: Booking[]): Booking[] {
  return bookings.filter((b) => leadIds.has(b.leadId) && b.status !== "CANCELLED");
}

function commissionOn(bookings: Booking[], commissionPct: number): number {
  return Math.round(bookings.reduce((sum, b) => sum + (b.totalValue * commissionPct) / 100, 0));
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export interface PartnerFilter {
  status?: PartnerStatus;
  city?: string;
}

export interface PartnerWithMetrics extends ChannelPartner {
  sourcedLeads: number;
  bookedLeads: number;
  bookingCount: number;
  bookingValue: number;
  commissionEarned: number;
}

export async function listPartners(filter: PartnerFilter = {}): Promise<PartnerWithMetrics[]> {
  const [partners, leads, bookings] = await Promise.all([
    db.channelPartners.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    db.leads.list(),
    db.bookings.list(),
  ]);

  const filtered = partners.filter((p) => {
    if (filter.status && p.status !== filter.status) return false;
    if (filter.city && (p.city ?? "").toLowerCase() !== filter.city.toLowerCase()) return false;
    return true;
  });

  return filtered.map((partner) => {
    const sourced = leads.filter((l) => l.channelPartnerId === partner.id);
    const leadIds = new Set(sourced.map((l) => l.id));
    const partnerBookings = commissionableBookings(leadIds, bookings);
    return {
      ...partner,
      sourcedLeads: sourced.length,
      bookedLeads: sourced.filter((l) => l.status === "BOOKED").length,
      bookingCount: partnerBookings.length,
      bookingValue: partnerBookings.reduce((sum, b) => sum + b.totalValue, 0),
      commissionEarned: commissionOn(partnerBookings, partner.commissionPct),
    };
  });
}

/** Distinct cities across all partners — used to drive the directory filter. */
export async function getPartnerCities(): Promise<string[]> {
  const partners = await db.channelPartners.list();
  const cities = new Set<string>();
  for (const p of partners) {
    if (p.city) cities.add(p.city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}

export interface PartnerBookingRow extends Booking {
  leadName: string;
  projectName: string;
  unitNumber: string;
  commission: number;
}

export interface PartnerDetail {
  partner: ChannelPartner;
  leads: Lead[];
  bookings: PartnerBookingRow[];
  projectNames: Record<string, string>;
  metrics: {
    sourcedLeads: number;
    activeLeads: number;
    bookedLeads: number;
    bookingValue: number;
    commissionEarned: number;
  };
}

export async function getPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const partner = await db.channelPartners.find(id);
  if (!partner) return null;

  const [leads, bookings, projects, units] = await Promise.all([
    db.leads.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    db.bookings.list({ orderBy: { field: "bookedAt", dir: "desc" } }),
    db.projects.list(),
    db.units.list(),
  ]);

  const sourced = leads.filter((l) => l.channelPartnerId === partner.id);
  const leadIds = new Set(sourced.map((l) => l.id));
  const leadById = new Map(sourced.map((l) => [l.id, l]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  const partnerBookings = commissionableBookings(leadIds, bookings);
  const bookingRows: PartnerBookingRow[] = partnerBookings.map((b) => ({
    ...b,
    leadName: leadById.get(b.leadId)?.name ?? "Unknown lead",
    projectName: projectById.get(b.projectId)?.name ?? "Unknown project",
    unitNumber: unitById.get(b.unitId)?.unitNumber ?? "—",
    commission: commissionOn([b], partner.commissionPct),
  }));

  const projectNames: Record<string, string> = {};
  for (const p of projects) projectNames[p.id] = p.name;

  return {
    partner,
    leads: sourced,
    bookings: bookingRows,
    projectNames,
    metrics: {
      sourcedLeads: sourced.length,
      activeLeads: sourced.filter((l) => !["BOOKED", "LOST"].includes(l.status)).length,
      bookedLeads: sourced.filter((l) => l.status === "BOOKED").length,
      bookingValue: partnerBookings.reduce((sum, b) => sum + b.totalValue, 0),
      commissionEarned: commissionOn(partnerBookings, partner.commissionPct),
    },
  };
}

export interface PartnerStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  sourcedLeads: number;
  bookedLeads: number;
  commissionPayable: number;
}

export async function getPartnerStats(): Promise<PartnerStats> {
  const partners = await listPartners();
  return {
    total: partners.length,
    active: partners.filter((p) => p.status === "ACTIVE").length,
    pending: partners.filter((p) => p.status === "PENDING").length,
    suspended: partners.filter((p) => p.status === "SUSPENDED").length,
    sourcedLeads: partners.reduce((sum, p) => sum + p.sourcedLeads, 0),
    bookedLeads: partners.reduce((sum, p) => sum + p.bookedLeads, 0),
    commissionPayable: partners.reduce((sum, p) => sum + p.commissionEarned, 0),
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createPartner(input: unknown): Promise<ChannelPartner> {
  const data = parseOrThrow(partnerCreateSchema, input);
  return db.channelPartners.create({
    name: data.name,
    phone: data.phone,
    company: data.company,
    email: data.email,
    reraId: data.reraId,
    city: data.city,
    commissionPct: data.commissionPct,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });
}

export async function updatePartner(id: string, input: unknown): Promise<ChannelPartner> {
  const patch = parseOrThrow(partnerUpdateSchema, input);
  const existing = await db.channelPartners.find(id);
  if (!existing) throw new Error("Channel partner not found");
  const updated = await db.channelPartners.update(id, patch);
  if (!updated) throw new Error("Failed to update channel partner");
  return updated;
}

/**
 * Move a partner through its lifecycle: approve (PENDING → ACTIVE), suspend
 * (ACTIVE/PENDING → SUSPENDED) or reinstate (SUSPENDED → ACTIVE).
 */
export async function setPartnerStatus(id: string, status: unknown): Promise<ChannelPartner> {
  const next = parseOrThrow(partnerStatusSchema, status);
  const existing = await db.channelPartners.find(id);
  if (!existing) throw new Error("Channel partner not found");
  if (existing.status === next) return existing;
  if (next === "PENDING") {
    throw new Error("A partner cannot be moved back to pending approval");
  }
  const updated = await db.channelPartners.update(id, { status: next });
  if (!updated) throw new Error("Failed to update partner status");
  return updated;
}
