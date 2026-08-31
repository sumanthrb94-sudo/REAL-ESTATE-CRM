// EstateCRM — role-based access control.
// Central permission matrix consumed by both server actions and UI guards.

import type { Role } from "@/types/domain";

export type Permission =
  | "dashboard.read"
  | "lead.read"
  | "lead.write"
  | "lead.assign"
  | "inventory.read"
  | "inventory.write"
  | "booking.read"
  | "booking.write"
  | "marketing.read"
  | "marketing.write"
  | "partner.read"
  | "partner.write"
  | "report.read"
  | "settings.write"
  | "user.manage";

const ALL: Permission[] = [
  "dashboard.read",
  "lead.read", "lead.write", "lead.assign",
  "inventory.read", "inventory.write",
  "booking.read", "booking.write",
  "marketing.read", "marketing.write",
  "partner.read", "partner.write",
  "report.read", "settings.write", "user.manage",
];

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: ALL,
  SALES_HEAD: [
    "dashboard.read",
    "lead.read", "lead.write", "lead.assign",
    "inventory.read", "booking.read", "booking.write",
    "marketing.read", "partner.read", "partner.write", "report.read",
  ],
  SALES_MANAGER: [
    "dashboard.read",
    "lead.read", "lead.write", "lead.assign",
    "inventory.read", "booking.read", "booking.write",
    "partner.read", "report.read",
  ],
  SALES_AGENT: [
    "dashboard.read",
    "lead.read", "lead.write",
    "inventory.read", "booking.read", "booking.write",
  ],
  MARKETING: [
    "dashboard.read",
    "lead.read", "marketing.read", "marketing.write", "report.read",
  ],
  CHANNEL_PARTNER: ["dashboard.read", "lead.read", "inventory.read"],
  VIEWER: [
    "dashboard.read",
    "lead.read", "inventory.read", "booking.read",
    "marketing.read", "partner.read", "report.read",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}
