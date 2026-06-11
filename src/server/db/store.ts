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
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
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
