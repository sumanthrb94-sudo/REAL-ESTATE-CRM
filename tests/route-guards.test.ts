// Structural test: every page inside the (dashboard) route group must assert a
// permission before it renders.
//
// The audit that prompted this work found nine of twelve module pages served in
// full to any signed-in user, because the sidebar hid them but the routes
// themselves were open. Nothing in the type system prevents that from
// reappearing on the next page someone adds, so it is checked here instead.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV, permissionForPath, activeNavHref } from "@/config/nav";

const DASHBOARD_DIR = join(process.cwd(), "src/app/(dashboard)");
const API_DIR = join(process.cwd(), "src/app/api");

function findFiles(dir: string, match: (name: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findFiles(full, match, found);
    else if (match(entry)) found.push(full);
  }
  return found;
}

const findPages = (dir: string) => findFiles(dir, (n) => n === "page.tsx");

/** The guards that count as asserting a permission. */
const GUARDS = ["requirePermission(", "requireAnyPermission("];

describe("dashboard route guards", () => {
  const pages = findPages(DASHBOARD_DIR);

  it("finds the dashboard pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(15);
  });

  it.each(pages.map((p) => [p.replace(process.cwd() + "/", ""), p]))(
    "%s asserts a permission",
    (_label, path) => {
      const source = readFileSync(path, "utf8");
      const guarded = GUARDS.some((g) => source.includes(g));
      expect(
        guarded,
        `${path} renders without calling requirePermission(). Every page in the ` +
          `(dashboard) group must gate itself — the sidebar hiding a link is not access control.`,
      ).toBe(true);
    },
  );

  it("never leaves a page relying only on getCurrentUser", () => {
    for (const path of pages) {
      const source = readFileSync(path, "utf8");
      if (source.includes("getCurrentUser(")) {
        expect(
          GUARDS.some((g) => source.includes(g)),
          `${path} uses getCurrentUser() without a permission guard`,
        ).toBe(true);
      }
    }
  });
});

describe("API route guards", () => {
  // Route handlers sit outside the (dashboard) layout, so the layout's
  // permission check never runs for them. Each must authenticate itself.
  const routes = findFiles(API_DIR, (n) => n === "route.ts" || n === "route.tsx");
  const API_GUARDS = ["getSessionUser(", "requirePermission(", "requireAnyPermission("];

  it("finds the API routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
  });

  it.each(routes.map((p) => [p.replace(process.cwd() + "/", ""), p]))("%s authenticates", (_label, path) => {
    const source = readFileSync(path, "utf8");
    expect(
      API_GUARDS.some((g) => source.includes(g)),
      `${path} serves without resolving the session. Every route under src/app/api must call getSessionUser() or a permission guard.`,
    ).toBe(true);
  });
});

describe("permissionForPath", () => {
  it("resolves each nav item to its own permission", () => {
    for (const group of NAV) {
      for (const item of group.items) {
        expect(permissionForPath(item.href)).toBe(item.permission);
      }
    }
  });

  it("prefers the deepest match, so a child does not inherit its parent", () => {
    // /marketing and /marketing/templates share a prefix; the child must win.
    expect(permissionForPath("/marketing/templates")).toBe("marketing.read");
    expect(permissionForPath("/leads/lead_123")).toBe("lead.read");
    expect(permissionForPath("/inventory/proj_agartha")).toBe("inventory.read");
    expect(permissionForPath("/settings/users")).toBe("user.manage");
  });

  it("allows account pages to any signed-in user", () => {
    expect(permissionForPath("/account/password")).toBeUndefined();
  });

  it("denies by default for a route not in the registry", () => {
    // null means "not covered" — callers must treat that as deny, so a new
    // page is locked until it is registered.
    expect(permissionForPath("/some-new-page")).toBeNull();
  });

  it("does not match on a partial segment", () => {
    // "/leadsomething" must not inherit "/leads".
    expect(permissionForPath("/leadsomething")).toBeNull();
  });
});

describe("activeNavHref", () => {
  it("marks exactly one item active on a nested route", () => {
    const active = activeNavHref(NAV, "/marketing/templates");
    expect(active).toBe("/marketing/templates");

    // The bug this replaces: a plain startsWith lit both Campaigns and Templates.
    const lit = NAV.flatMap((g) => g.items).filter((i) => i.href === active);
    expect(lit).toHaveLength(1);
  });

  it("marks the parent active on its own detail routes", () => {
    expect(activeNavHref(NAV, "/leads/lead_123")).toBe("/leads");
    expect(activeNavHref(NAV, "/inventory/proj_syl")).toBe("/inventory");
  });

  it("returns null when nothing matches", () => {
    expect(activeNavHref(NAV, "/account/password")).toBeNull();
  });
});
