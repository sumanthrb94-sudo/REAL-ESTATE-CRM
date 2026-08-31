import { describe, expect, it } from "vitest";
import { can, permissionsFor } from "@/server/auth/rbac";
import { NAV, permissionForPath } from "@/config/nav";
import type { Role } from "@/types/domain";

const ROLES: Role[] = [
  "ADMIN",
  "SALES_HEAD",
  "SALES_MANAGER",
  "SALES_AGENT",
  "MARKETING",
  "CHANNEL_PARTNER",
  "VIEWER",
];

describe("dashboard access", () => {
  // /dashboard is where sign-in lands. Gating it behind report.read locked
  // SALES_AGENT and CHANNEL_PARTNER out of the app the moment they logged in.
  it("is granted to every role, because login redirects there", () => {
    for (const role of ROLES) {
      expect(can(role, "dashboard.read"), `${role} must reach its own dashboard`).toBe(true);
    }
  });

  it("is gated by dashboard.read, never by report.read", () => {
    expect(permissionForPath("/dashboard")).toBe("dashboard.read");
  });

  it("does not hand every role the reports module as a side effect", () => {
    expect(can("SALES_AGENT", "report.read")).toBe(false);
    expect(can("CHANNEL_PARTNER", "report.read")).toBe(false);
  });
});

describe("nav registry", () => {
  it("gates every destination behind a permission some role actually holds", () => {
    for (const group of NAV) {
      for (const item of group.items) {
        // permission is optional on NavItem: an entry without one is open to
        // anyone signed in, which is reachable by definition.
        const reachable =
          item.permission === undefined || ROLES.some((r) => can(r, item.permission!));
        expect(reachable, `${item.href} is unreachable by every role`).toBe(true);
      }
    }
  });

  it("denies routes that are not registered", () => {
    expect(permissionForPath("/definitely-not-a-route")).toBeNull();
  });

  it("keeps a sales agent out of management areas", () => {
    for (const path of ["/settings/users", "/distribution", "/reports", "/marketing"]) {
      const permission = permissionForPath(path);
      expect(permission, `${path} must be registered`).toBeTruthy();
      expect(can("SALES_AGENT", permission!), `${path} must deny SALES_AGENT`).toBe(false);
    }
  });

  it("gives a sales agent the surfaces they need to do the job", () => {
    for (const path of ["/dashboard", "/leads", "/pipeline", "/site-visits", "/inventory", "/bookings"]) {
      const permission = permissionForPath(path);
      expect(permission, `${path} must be registered`).toBeTruthy();
      expect(can("SALES_AGENT", permission!), `${path} must allow SALES_AGENT`).toBe(true);
    }
  });
});

describe("permission matrix", () => {
  it("gives no role an empty permission set", () => {
    for (const role of ROLES) expect(permissionsFor(role).length).toBeGreaterThan(0);
  });
});
