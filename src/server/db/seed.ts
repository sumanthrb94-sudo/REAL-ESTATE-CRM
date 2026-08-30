// EstateCRM — initial dataset.
//
// This is a *bootstrap*, not a demo. It creates the minimum needed to sign in
// and start working:
//
//   • one ADMIN account
//   • two projects — Agartha and SYL — with no towers or units yet
//   • one catch-all round-robin assignment rule
//
// Everything else (leads, activities, site visits, bookings, payments,
// campaigns, templates, segments, channel partners) starts empty. Towers and
// units are added through Inventory → project → Add tower, and leads arrive
// through Leads → Import or the New Lead form.

import type {
  Activity,
  AssignmentRule,
  Booking,
  Campaign,
  ChannelPartner,
  Lead,
  Payment,
  Project,
  Segment,
  SiteVisit,
  Team,
  Template,
  Tower,
  Unit,
  User,
} from "@/types/domain";
import type { SeedData } from "./memory-store";

/**
 * Password for the bootstrap admin account. Override with BOOTSTRAP_PASSWORD.
 * The account is flagged mustChangePassword, so this value only ever gets you
 * as far as the change-password screen.
 */
export const BOOTSTRAP_EMAIL = (process.env.BOOTSTRAP_EMAIL ?? "admin@estatecrm.local").toLowerCase();
export const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD ?? "changeme-on-first-login";

export const PROJECT_SEEDS = [
  {
    id: "proj_agartha",
    name: "Agartha",
    status: "UPCOMING" as const,
  },
  {
    id: "proj_syl",
    name: "SYL",
    status: "UPCOMING" as const,
  },
];

/**
 * Build the initial dataset. `passwordHash` is injected by the caller because
 * hashing is async and this function is used synchronously at store boot.
 */
export function buildSeed(adminPasswordHash?: string): SeedData {
  const now = new Date().toISOString();

  const users: User[] = [
    {
      id: "usr_admin",
      name: "Administrator",
      email: BOOTSTRAP_EMAIL,
      role: "ADMIN",
      active: true,
      passwordHash: adminPasswordHash,
      // Force a password change so the bootstrap credential cannot survive
      // into day-to-day use.
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const teams: Team[] = [];

  const projects: Project[] = PROJECT_SEEDS.map((p) => ({
    id: p.id,
    name: p.name,
    city: "",
    status: p.status,
    amenities: [],
    createdAt: now,
    updatedAt: now,
  }));

  // A catch-all so imported leads never land ownerless. It is configuration,
  // not data — edit or disable it under Sales → Lead Distribution.
  const assignmentRules: AssignmentRule[] = [
    {
      id: "rule_default",
      name: "Default round-robin",
      strategy: "ROUND_ROBIN",
      priority: 0,
      active: true,
      createdAt: now,
    },
  ];

  const towers: Tower[] = [];
  const units: Unit[] = [];
  const leads: Lead[] = [];
  const activities: Activity[] = [];
  const siteVisits: SiteVisit[] = [];
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  const channelPartners: ChannelPartner[] = [];
  const campaigns: Campaign[] = [];
  const templates: Template[] = [];
  const segments: Segment[] = [];

  return {
    users,
    teams,
    leads,
    activities,
    siteVisits,
    assignmentRules,
    projects,
    towers,
    units,
    bookings,
    payments,
    channelPartners,
    campaigns,
    templates,
    segments,
  };
}
