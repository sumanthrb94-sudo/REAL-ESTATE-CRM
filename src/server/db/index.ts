// EstateCRM — data layer entry point.
// Returns a process-wide singleton DataStore. Survives Next.js dev hot-reloads by
// caching on globalThis. Backend is chosen via DATA_DRIVER:
//   memory   (default) — seeded in-memory store, zero config
//   firebase           — Firestore via the Admin SDK (requires FIREBASE_* env vars)

import { hashPasswordSync } from "@/server/auth/password";
import { createFirestoreStore } from "./firebase";
import { createMemoryStore } from "./memory-store";
import { buildSeed, BOOTSTRAP_PASSWORD } from "./seed";
import type { DataStore } from "./store";

const globalForDb = globalThis as unknown as { __estateDb?: DataStore };

function memoryStore(): DataStore {
  return createMemoryStore(buildSeed(hashPasswordSync(BOOTSTRAP_PASSWORD)));
}

function init(): DataStore {
  const driver = process.env.DATA_DRIVER ?? "memory";

  // Say which backend is in use at boot. Silence here is expensive: a
  // misconfigured deployment falls back to `memory` and looks like it works
  // until the first restart drops every write.
  console.log(
    `[db] driver=${driver}` +
      (driver === "firebase"
        ? ` project=${process.env.FIREBASE_PROJECT_ID ?? "(unset)"}` +
          (process.env.FIRESTORE_EMULATOR_HOST ? ` emulator=${process.env.FIRESTORE_EMULATOR_HOST}` : "")
        : " (NOT durable — writes are lost on restart)"),
  );

  switch (driver) {
    case "firebase":
      // firebase-admin is loaded but does not connect until getDb() is called,
      // so memory-mode deploys are unaffected (and need no Firebase creds).
      return createFirestoreStore();
    case "prisma":
      throw new Error(
        "DATA_DRIVER=prisma is not implemented. Use `memory` (ephemeral) or `firebase` (durable). " +
          "Silently falling back to memory would look like it worked and then lose every write.",
      );
    case "memory":
      return memoryStore();
    default:
      throw new Error(
        `Unknown DATA_DRIVER "${driver}". Valid values are "memory" or "firebase".`,
      );
  }
}

export const db: DataStore = globalForDb.__estateDb ?? init();

// Cache on globalThis in EVERY environment, not just development.
//
// Next.js bundles server code per route, so this module is instantiated more
// than once inside a single process. Without a shared handle, each route got
// its own in-memory store: signing in on one route and reading the session on
// another saw two different databases, and writes appeared to vanish.
//
// This makes `memory` coherent within one process. It still cannot be coherent
// ACROSS processes — separate serverless instances each hold their own copy —
// which is why anything with real data belongs on DATA_DRIVER=firebase.
globalForDb.__estateDb = db;

export type { DataStore } from "./store";
