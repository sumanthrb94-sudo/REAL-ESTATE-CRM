// EstateCRM — navigation registry.
// Each module's pages are registered here. Grouped to mirror the Sell.Do-class
// information architecture. `permission` gates visibility via RBAC.

import type { Permission } from "@/server/auth/rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  permission?: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "report.read" }],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: "Users", permission: "lead.read" },
      { label: "Pipeline", href: "/pipeline", icon: "KanbanSquare", permission: "lead.read" },
      { label: "Site Visits", href: "/site-visits", icon: "CalendarCheck", permission: "lead.read" },
      { label: "Lead Distribution", href: "/distribution", icon: "Shuffle", permission: "lead.assign" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Projects", href: "/inventory", icon: "Building2", permission: "inventory.read" },
      { label: "Bookings", href: "/bookings", icon: "FileSignature", permission: "booking.read" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Campaigns", href: "/marketing", icon: "Megaphone", permission: "marketing.read" },
      { label: "Templates", href: "/marketing/templates", icon: "FileText", permission: "marketing.read" },
      { label: "Segments", href: "/marketing/segments", icon: "Filter", permission: "marketing.read" },
    ],
  },
  {
    label: "Network",
    items: [
      { label: "Channel Partners", href: "/channel-partners", icon: "Handshake", permission: "partner.read" },
    ],
  },
  {
    label: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: "BarChart3", permission: "report.read" }],
  },
  {
    label: "Settings",
    items: [{ label: "Users", href: "/settings/users", icon: "UserCog", permission: "user.manage" }],
  },
];

/**
 * The single nav item that should read as "current" for a pathname, or null.
 *
 * Longest match wins on segment boundaries, so `/marketing/templates` lights
 * Templates only — a plain `startsWith` used to light both it and Campaigns.
 */
export function activeNavHref(groups: NavGroup[], pathname: string): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (isMatch && (best === null || item.href.length > best.length)) best = item.href;
    }
  }
  return best;
}

/**
 * Routes that require a session but no particular permission — every signed-in
 * user reaches their own account pages.
 */
const OPEN_ROUTES = ["/account"];

/**
 * The permission a pathname requires, derived from NAV so the navigation
 * registry stays the single source of truth for access.
 *
 * Matching is longest-prefix on segment boundaries, so `/leads/lead_1`
 * inherits `/leads` and `/marketing/templates` beats `/marketing`.
 *
 * Returns `undefined` for a route that needs only a session, and `null` for a
 * route not covered by the registry at all — callers should treat null as
 * "deny", so a new page is locked until it is registered here.
 */
export function permissionForPath(pathname: string): Permission | undefined | null {
  if (OPEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return undefined;

  let match: NavItem | undefined;
  for (const group of NAV) {
    for (const item of group.items) {
      const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (isMatch && (!match || item.href.length > match.href.length)) match = item;
    }
  }
  if (!match) return null;
  return match.permission;
}
