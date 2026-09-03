// EstateCRM — in-memory implementation of the DataStore contract.
// Backed by Maps; fully async to match the eventual Prisma adapter's signature.

import type { DataStore, QueryOptions, Repository } from "./store";

let counter = 0;
function genId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

function matchesWhere<T>(item: T, where?: Partial<Record<keyof T, unknown>>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    return (item as Record<string, unknown>)[key] === value;
  });
}

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly data = new Map<string, T>();

  constructor(
    seed: T[] = [],
    private readonly idPrefix = "id",
  ) {
    for (const row of seed) this.data.set(row.id, row);
  }

  async list(opts?: QueryOptions<T>): Promise<T[]> {
    let rows = [...this.data.values()].filter((r) => matchesWhere(r, opts?.where));
    if (opts?.orderBy) {
      const { field, dir = "asc" } = opts.orderBy;
      rows = rows.sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return dir === "asc" ? cmp : -cmp;
      });
    }
    const skip = opts?.skip ?? 0;
    const take = opts?.take ?? rows.length;
    return rows.slice(skip, skip + take);
  }

  async count(where?: Partial<Record<keyof T, unknown>>): Promise<number> {
    return [...this.data.values()].filter((r) => matchesWhere(r, where)).length;
  }

  async find(id: string): Promise<T | null> {
    return this.data.get(id) ?? null;
  }

  async findOne(where: Partial<Record<keyof T, unknown>>): Promise<T | null> {
    return [...this.data.values()].find((r) => matchesWhere(r, where)) ?? null;
  }

  async create(data: Omit<T, "id"> & { id?: string }): Promise<T> {
    const id = data.id ?? genId(this.idPrefix);
    const row = { ...(data as object), id } as T;
    this.data.set(id, row);
    return row;
  }

  async createMany(rows: Array<Omit<T, "id"> & { id?: string }>): Promise<T[]> {
    const created: T[] = [];
    for (const row of rows) created.push(await this.create(row));
    return created;
  }

  async deleteMany(ids: string[]): Promise<number> {
    let n = 0;
    for (const id of ids) if (this.data.delete(id)) n++;
    return n;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const existing = this.data.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id } as T;
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.data.delete(id);
  }
}

export interface SeedData {
  [collection: string]: Array<{ id: string }>;
}

export function createMemoryStore(seed: SeedData): DataStore {
  const repo = <T extends { id: string }>(name: keyof typeof seed, prefix: string) =>
    new InMemoryRepository<T>((seed[name as string] ?? []) as T[], prefix);

  return {
    users: repo("users", "usr"),
    teams: repo("teams", "team"),
    leads: repo("leads", "lead"),
    activities: repo("activities", "act"),
    mediaGenerations: repo("mediaGenerations", "gen"),
    siteVisits: repo("siteVisits", "sv"),
    assignmentRules: repo("assignmentRules", "rule"),
    projects: repo("projects", "proj"),
    towers: repo("towers", "twr"),
    units: repo("units", "unit"),
    bookings: repo("bookings", "bkg"),
    payments: repo("payments", "pay"),
    channelPartners: repo("channelPartners", "cp"),
    campaigns: repo("campaigns", "camp"),
    templates: repo("templates", "tmpl"),
    segments: repo("segments", "seg"),
  };
}
