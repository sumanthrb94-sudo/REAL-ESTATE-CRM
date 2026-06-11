// EstateCRM — data layer entry point.
// Returns a process-wide singleton DataStore. Survives Next.js dev hot-reloads by
// caching on globalThis. To switch backends later, branch on process.env.DATA_DRIVER
// and return a PrismaStore that implements the same DataStore interface.

import { createMemoryStore } from "./memory-store";
import { buildSeed } from "./seed";
import type { DataStore } from "./store";

const globalForDb = globalThis as unknown as { __estateDb?: DataStore };

function init(): DataStore {
  const driver = process.env.DATA_DRIVER ?? "memory";
  switch (driver) {
    case "prisma":
      // TODO: return new PrismaStore() once DATABASE_URL is configured.
      // Falls through to memory until the Prisma adapter is implemented.
      console.warn("[db] DATA_DRIVER=prisma not yet wired; using in-memory store.");
      return createMemoryStore(buildSeed());
    case "memory":
    default:
      return createMemoryStore(buildSeed());
  }
}

export const db: DataStore = globalForDb.__estateDb ?? init();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__estateDb = db;
}

export type { DataStore } from "./store";
