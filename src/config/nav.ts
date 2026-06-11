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
];
