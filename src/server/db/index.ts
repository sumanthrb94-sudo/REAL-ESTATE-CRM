// EstateCRM — data layer entry point.
// Returns a process-wide singleton DataStore. Survives Next.js dev hot-reloads by
// caching on globalThis. Backend is chosen via DATA_DRIVER:
//   memory   (default) — seeded in-memory store, zero config
//   firebase           — Firestore via the Admin SDK (requires FIREBASE_* env vars)

import { createFirestoreStore } from "./firebase";
import { createMemoryStore } from "./memory-store";
import { buildSeed } from "./seed";
import type { DataStore } from "./store";

const globalForDb = globalThis as unknown as { __estateDb?: DataStore };

function init(): DataStore {
  const driver = process.env.DATA_DRIVER ?? "memory";
  switch (driver) {
    case "firebase":
      // firebase-admin is loaded but does not connect until getDb() is called,
      // so memory-mode deploys are unaffected (and need no Firebase creds).
      return createFirestoreStore();
    case "prisma":
      // TODO: return new PrismaStore() once DATABASE_URL is configured.
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
