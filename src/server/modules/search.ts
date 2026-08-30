// EstateCRM — global search.
//
// Backs the topbar search field. Results are permission-filtered and, for
// agents and managers, scoped to the leads they are allowed to see — search
// must not become a way around row-level visibility.

import { db } from "@/server/db";
import { can } from "@/server/auth/rbac";
import { teamMemberIds } from "@/server/modules/leads";
import { visibleOwnerIds } from "@/server/auth/guard";
import type { User } from "@/types/domain";

export type SearchResultKind = "lead" | "project" | "partner" | "booking";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const MAX_PER_KIND = 5;

/** Case- and punctuation-insensitive contains, so "98200 10001" matches "+919820010001". */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s()+\-.]/g, "");
}

function matches(query: string, ...fields: Array<string | undefined>): boolean {
  const q = normalise(query);
  if (!q) return false;
  return fields.some((f) => f && normalise(f).includes(q));
}

export async function globalSearch(user: User, rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const results: SearchResult[] = [];

  if (can(user.role, "lead.read")) {
    const ownerScope = await visibleOwnerIds(user, () => teamMemberIds(user));
    const leads = await db.leads.list();
    results.push(
      ...leads
        .filter((l) => !ownerScope || (l.ownerId != null && ownerScope.includes(l.ownerId)))
        .filter((l) => matches(query, l.name, l.phone, l.email, l.requirement))
        .slice(0, MAX_PER_KIND)
        .map((l) => ({
          kind: "lead" as const,
          id: l.id,
          title: l.name,
          subtitle: l.phone,
          href: `/leads/${l.id}`,
        })),
    );
  }

  if (can(user.role, "inventory.read")) {
    const projects = await db.projects.list();
    results.push(
      ...projects
        .filter((p) => matches(query, p.name, p.developer, p.city, p.locality, p.reraId))
        .slice(0, MAX_PER_KIND)
        .map((p) => ({
          kind: "project" as const,
          id: p.id,
          title: p.name,
          subtitle: [p.locality, p.city].filter(Boolean).join(", "),
          href: `/inventory/${p.id}`,
        })),
    );
  }

  if (can(user.role, "partner.read")) {
    const partners = await db.channelPartners.list();
    results.push(
      ...partners
        .filter((p) => matches(query, p.name, p.company, p.phone, p.email, p.reraId))
        .slice(0, MAX_PER_KIND)
        .map((p) => ({
          kind: "partner" as const,
          id: p.id,
          title: p.name,
          subtitle: p.company,
          href: `/channel-partners/${p.id}`,
        })),
    );
  }

  return results;
}
