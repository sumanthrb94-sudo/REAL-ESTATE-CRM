// EstateCRM — data layer contract.
// Every feature module talks to the database ONLY through this interface, so the
// backing implementation (in-memory today, Prisma/Postgres tomorrow) is swappable
// without touching a single line of business logic.

import type {
  Activity,
  AssignmentRule,
  Booking,
  Campaign,
  ChannelPartner,
  Lead,
  Payment,
  Project,
  Segment,
  SiteVisit,
  Team,
  Template,
  Tower,
  Unit,
  User,
} from "@/types/domain";

export interface QueryOptions<T> {
  where?: Partial<Record<keyof T, unknown>>;
  orderBy?: { field: keyof T; dir?: "asc" | "desc" };
  skip?: number;
  take?: number;
}

export interface Repository<T extends { id: string }> {
  list(opts?: QueryOptions<T>): Promise<T[]>;
  count(where?: Partial<Record<keyof T, unknown>>): Promise<number>;
  find(id: string): Promise<T | null>;
  findOne(where: Partial<Record<keyof T, unknown>>): Promise<T | null>;
  create(data: Omit<T, "id"> & { id?: string }): Promise<T>;
  /**
   * Create many rows in as few round trips as the backend allows.
   *
   * Bulk paths (generating a tower's floor grid, importing a CSV) were creating
   * rows one at a time. Against the in-memory store that is free; against
   * Firestore it is one network round trip per row — 48 units became 48
   * sequential trips to the region, which is slow enough to look broken.
   */
  createMany(rows: Array<Omit<T, "id"> & { id?: string }>): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  /** Delete many rows by id, batched the same way as createMany. */
  deleteMany(ids: string[]): Promise<number>;
}

export interface DataStore {
  users: Repository<User>;
  teams: Repository<Team>;
  leads: Repository<Lead>;
  activities: Repository<Activity>;
  siteVisits: Repository<SiteVisit>;
  assignmentRules: Repository<AssignmentRule>;
  projects: Repository<Project>;
  towers: Repository<Tower>;
  units: Repository<Unit>;
  bookings: Repository<Booking>;
  payments: Repository<Payment>;
  channelPartners: Repository<ChannelPartner>;
  campaigns: Repository<Campaign>;
  templates: Repository<Template>;
  segments: Repository<Segment>;
}
