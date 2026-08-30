// EstateCRM — shared domain types.
// These mirror prisma/schema.prisma and are the single source of truth for the
// in-memory data layer, services and UI. When you switch DATA_DRIVER to "prisma",
// these stay valid (Prisma's generated types are structurally compatible).

export type Role =
  | "ADMIN"
  | "SALES_HEAD"
  | "SALES_MANAGER"
  | "SALES_AGENT"
  | "MARKETING"
  | "CHANNEL_PARTNER"
  | "VIEWER";

export const ROLES: Role[] = [
  "ADMIN",
  "SALES_HEAD",
  "SALES_MANAGER",
  "SALES_AGENT",
  "MARKETING",
  "CHANNEL_PARTNER",
  "VIEWER",
];

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  active: boolean;
  teamId?: string;
  /**
   * Scrypt hash of the user's password, in the format produced by
   * `hashPassword()` in server/auth/password.ts. Never sent to the client —
   * strip it with `publicUser()` before returning a User across the boundary.
   */
  passwordHash?: string;
  /** Set when an admin resets the password; forces a change on next sign-in. */
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A User with secrets removed — safe to pass to client components. */
export type PublicUser = Omit<User, "passwordHash">;

export interface Team {
  id: string;
  name: string;
  region?: string;
  managerId?: string;
  createdAt: string;
}

// ─── Leads ───────────────────────────────────────────────────────────────
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "SITE_VISIT_SCHEDULED"
  | "SITE_VISIT_DONE"
  | "NEGOTIATION"
  | "BOOKED"
  | "LOST";

export const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT_DONE",
  "NEGOTIATION",
  "BOOKED",
  "LOST",
];

export type LeadSource =
  | "INSTAGRAM"
  | "WEBSITE"
  | "PORTAL_99ACRES"
  | "PORTAL_MAGICBRICKS"
  | "PORTAL_HOUSING"
  | "FACEBOOK"
  | "GOOGLE_ADS"
  | "WALK_IN"
  | "REFERRAL"
  | "CHANNEL_PARTNER"
  | "CALL_CENTER"
  | "OTHER";

export const LEAD_SOURCES: LeadSource[] = [
  "INSTAGRAM",
  "WEBSITE",
  "PORTAL_99ACRES",
  "PORTAL_MAGICBRICKS",
  "PORTAL_HOUSING",
  "FACEBOOK",
  "GOOGLE_ADS",
  "WALK_IN",
  "REFERRAL",
  "CHANNEL_PARTNER",
  "CALL_CENTER",
  "OTHER",
];

export type LeadTemperature = "HOT" | "WARM" | "COLD";

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  temperature: LeadTemperature;
  score: number;
  budgetMin?: number;
  budgetMax?: number;
  requirement?: string;
  projectId?: string;
  ownerId?: string;
  channelPartnerId?: string;
  campaignId?: string;
  tags: string[];
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
}

export type ActivityType =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "MEETING"
  | "STATUS_CHANGE"
  | "TASK";

export interface Activity {
  id: string;
  type: ActivityType;
  leadId: string;
  userId?: string;
  subject: string;
  body?: string;
  dueAt?: string;
  completed: boolean;
  outcome?: string;
  createdAt: string;
}

export type SiteVisitStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

export interface SiteVisit {
  id: string;
  leadId: string;
  projectId?: string;
  agentId?: string;
  scheduledAt: string;
  status: SiteVisitStatus;
  feedback?: string;
  createdAt: string;
}

export type DistributionStrategy =
  | "ROUND_ROBIN"
  | "LOAD_BALANCED"
  | "SOURCE_BASED"
  | "PROJECT_BASED";

export interface AssignmentRule {
  id: string;
  name: string;
  strategy: DistributionStrategy;
  priority: number;
  active: boolean;
  source?: LeadSource;
  projectId?: string;
  assigneeId?: string;
  createdAt: string;
}

// ─── Inventory ───────────────────────────────────────────────────────────
export type ProjectStatus = "UPCOMING" | "ONGOING" | "READY_TO_MOVE" | "SOLD_OUT";

export const PROJECT_STATUSES = [
  "UPCOMING",
  "ONGOING",
  "READY_TO_MOVE",
  "SOLD_OUT",
] as const satisfies readonly ProjectStatus[];

export interface Project {
  id: string;
  name: string;
  developer?: string;
  city: string;
  locality?: string;
  status: ProjectStatus;
  description?: string;
  amenities: string[];
  reraId?: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tower {
  id: string;
  projectId: string;
  name: string;
  floors: number;
}

export type UnitStatus = "AVAILABLE" | "BLOCKED" | "BOOKED" | "SOLD";

export const UNIT_STATUSES = [
  "AVAILABLE",
  "BLOCKED",
  "BOOKED",
  "SOLD",
] as const satisfies readonly UnitStatus[];

export interface Unit {
  id: string;
  projectId: string;
  towerId?: string;
  unitNumber: string;
  floor: number;
  type: string;
  carpetArea: number;
  builtUpArea?: number;
  facing?: string;
  basePrice: number;
  status: UnitStatus;
  createdAt: string;
}

// ─── Bookings ──────────────────────────────────────────────────────────────
export type BookingStatus = "TOKEN" | "AGREEMENT" | "REGISTERED" | "CANCELLED";

export interface Booking {
  id: string;
  leadId: string;
  unitId: string;
  projectId: string;
  agentId?: string;
  status: BookingStatus;
  totalValue: number;
  bookedAt: string;
}

export type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";

export interface Payment {
  id: string;
  bookingId: string;
  milestone: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paidAt?: string;
}

// ─── Channel partners ───────────────────────────────────────────────────────
export type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface ChannelPartner {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone: string;
  reraId?: string;
  city?: string;
  status: PartnerStatus;
  commissionPct: number;
  createdAt: string;
}

// ─── Marketing ──────────────────────────────────────────────────────────────
export type CampaignChannel = "EMAIL" | "SMS" | "WHATSAPP" | "MULTICHANNEL";
export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "PAUSED";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  templateId?: string;
  segmentId?: string;
  scheduledAt?: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  channel: CampaignChannel;
  subject?: string;
  body: string;
  createdAt: string;
}

export interface SegmentFilter {
  field: keyof Lead;
  op: "eq" | "in" | "gte" | "lte" | "contains";
  value: unknown;
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  filters: SegmentFilter[];
  createdAt: string;
}
