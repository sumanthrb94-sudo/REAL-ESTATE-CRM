// EstateCRM — page and action guards.
//
// Every page under (dashboard) calls one of these before rendering. The
// previous build filtered the *navigation* by permission but left the routes
// themselves open, so anyone who typed a URL got the page — this closes that.
//
// `npm test` includes a check that every page.tsx in the (dashboard) group
// calls a guard, so a newly added page cannot quietly ship unprotected.

import { forbidden } from "next/navigation";
import { can, type Permission } from "./rbac";
import { requireUser } from "./session";
import type { User } from "@/types/domain";

/**
 * Require a session and a permission. Redirects to /login when signed out,
 * and renders the 403 page when signed in without the permission — the two
 * cases need different outcomes, since re-authenticating never fixes the second.
 */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, permission)) forbidden();
  return user;
}

/**
 * Require a session and any one of several permissions. Used by pages that
 * several roles reach for different reasons.
 */
export async function requireAnyPermission(...permissions: Permission[]): Promise<User> {
  const user = await requireUser();
  if (!permissions.some((p) => can(user.role, p))) forbidden();
  return user;
}

/**
 * Assert a permission inside a server action, as a defence in depth behind the
 * page guard: a form's action is a POST endpoint that can be called directly,
 * so it must never rely on the page having gated the render.
 */
export async function assertPermission(
  permission: Permission,
  message = "You do not have permission to do that.",
): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new Error(message);
  return user;
}

/**
 * Row-level visibility. A Sales Agent sees only the leads they own; a Sales
 * Manager sees their team's; everyone above sees everything.
 *
 * Returns undefined when the user may see all rows, otherwise the set of owner
 * ids they are limited to. Callers pass this to the module services rather
 * than filtering in the UI, so the constraint cannot be bypassed by a query
 * parameter.
 */
export async function visibleOwnerIds(
  user: User,
  teamMemberIds: () => Promise<string[]>,
): Promise<string[] | undefined> {
  switch (user.role) {
    case "SALES_AGENT":
      return [user.id];
    case "SALES_MANAGER":
      return await teamMemberIds();
    default:
      return undefined;
  }
}
