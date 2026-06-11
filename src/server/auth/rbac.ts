// EstateCRM — role-based access control.
// Central permission matrix consumed by both server actions and UI guards.

import type { Role } from "@/types/domain";

export type Permission =
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
    "lead.read", "lead.write", "lead.assign",
    "inventory.read", "booking.read", "booking.write",
    "marketing.read", "partner.read", "partner.write", "report.read",
  ],
  SALES_MANAGER: [
    "lead.read", "lead.write", "lead.assign",
    "inventory.read", "booking.read", "booking.write",
    "partner.read", "report.read",
  ],
  SALES_AGENT: [
    "lead.read", "lead.write",
    "inventory.read", "booking.read", "booking.write",
  ],
  MARKETING: [
    "lead.read", "marketing.read", "marketing.write", "report.read",
  ],
  CHANNEL_PARTNER: ["lead.read", "inventory.read"],
  VIEWER: [
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
