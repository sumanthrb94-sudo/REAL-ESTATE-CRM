"use server";

import { requireUser } from "@/server/auth/session";
import { globalSearch, type SearchResult } from "./search";

/**
 * Search action used by the topbar. Resolves the user server-side rather than
 * accepting an id from the client, so results are always scoped to whoever is
 * actually signed in.
 */
export async function searchAction(query: string): Promise<SearchResult[]> {
  const user = await requireUser();
  return globalSearch(user, query);
}
