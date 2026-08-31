// EstateCRM — Firestore implementation of the DataStore contract.
//
// Uses the Firebase Admin SDK (server-side only). Selected by DATA_DRIVER=firebase.
// Every feature module already talks only to the DataStore interface, so swapping
// the in-memory store for Firestore changes nothing in the business logic.
//
// Query strategy (deliberate): equality `where` filters are pushed to Firestore
// (equality-only multi-field queries need NO composite index), while orderBy /
// skip / take are applied in memory. This guarantees identical semantics to the
// in-memory store and avoids "this query requires an index" runtime errors on
// Vercel. Collection sizes here are small (dozens–hundreds), so this is cheap.

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { DataStore, QueryOptions, Repository } from "./store";
import { describePrivateKey, normalisePrivateKey } from "./private-key";

// ─── Admin SDK singleton (serverless-safe) ──────────────────────────────────
const globalForFb = globalThis as unknown as { __estateFs?: Firestore };

function readCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "[db] DATA_DRIVER=firebase requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }

  // Repairs the manglings a dashboard paste introduces; see private-key.ts.
  const privateKey = normalisePrivateKey(rawKey);

  // Log the key's shape — never the key — so a bad paste is diagnosable from
  // the runtime log instead of only "DECODER routines::unsupported".
  console.log(`[db] private key: ${describePrivateKey(rawKey)}`);

  return { projectId, clientEmail, privateKey };
}

export function getDb(): Firestore {
  if (globalForFb.__estateFs) return globalForFb.__estateFs;

  // Against the local Firestore emulator no service-account credentials are
  // needed — only a project id. Detected via the standard FIRESTORE_EMULATOR_HOST.
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  let app: App;
  if (emulator) {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? "estate-crm-emulator";
    app = getApps()[0] ?? initializeApp({ projectId });
  } else {
    const { projectId, clientEmail, privateKey } = readCredentials();
    app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const fs = getFirestore(app);
  // Domain objects carry optional fields that may be undefined (e.g. lostReason);
  // Firestore rejects undefined unless we opt in to ignoring them.
  try {
    fs.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if called twice on the same instance; safe to ignore.
  }
  globalForFb.__estateFs = fs;
  return fs;
}

// ─── Generic repository ─────────────────────────────────────────────────────
/** Firestore allows at most 500 operations per batch; stay under it. */
const BATCH_LIMIT = 450;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function matchesWhere<T>(item: T, where?: Partial<Record<keyof T, unknown>>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    return (item as Record<string, unknown>)[key] === value;
  });
}

export class FirestoreRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly collection: string,
    private readonly idPrefix: string,
  ) {}

  /**
   * Resolved per operation, never in the constructor.
   *
   * Connecting eagerly meant that merely importing this module initialised the
   * Admin SDK and parsed FIREBASE_PRIVATE_KEY. `next build` evaluates every
   * page module to collect its route config, so a production build demanded
   * valid Firestore credentials and died with "Failed to parse private key"
   * before serving a single request. getDb() caches on globalThis, so calling
   * it per operation costs nothing after the first.
   */
  private get db(): Firestore {
    return getDb();
  }

  private col() {
    return this.db.collection(this.collection);
  }

  /** Push equality filters to Firestore; returns the rows for in-memory shaping. */
  private async fetch(where?: Partial<Record<keyof T, unknown>>): Promise<T[]> {
    let query: FirebaseFirestore.Query = this.col();
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        if (value === undefined) continue;
        query = query.where(key, "==", value);
      }
    }
    const snap = await query.get();
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  }

  async list(opts?: QueryOptions<T>): Promise<T[]> {
    let rows = await this.fetch(opts?.where);
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
    const rows = await this.fetch(where);
    return rows.length;
  }

  async find(id: string): Promise<T | null> {
    const doc = await this.col().doc(id).get();
    return doc.exists ? ({ ...(doc.data() as object), id: doc.id } as T) : null;
  }

  async findOne(where: Partial<Record<keyof T, unknown>>): Promise<T | null> {
    const rows = await this.fetch(where);
    return rows.find((r) => matchesWhere(r, where)) ?? null;
  }

  async create(data: Omit<T, "id"> & { id?: string }): Promise<T> {
    const id = data.id ?? genId(this.idPrefix);
    // Store `id` as a field too (not just the doc key) so `where`/findOne on id
    // behaves identically to the in-memory store.
    const row = { ...data, id } as T;
    await this.col().doc(id).set(row as FirebaseFirestore.DocumentData);
    return row;
  }

  /**
   * Batched creates. Firestore caps a batch at 500 operations, so chunk below
   * that. One round trip per chunk instead of one per row.
   */
  async createMany(rows: Array<Omit<T, "id"> & { id?: string }>): Promise<T[]> {
    const created: T[] = [];
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const chunk = rows.slice(i, i + BATCH_LIMIT);
      const batch = this.db.batch();
      for (const data of chunk) {
        const id = data.id ?? genId(this.idPrefix);
        const row = { ...data, id } as T;
        batch.set(this.col().doc(id), row as FirebaseFirestore.DocumentData);
        created.push(row);
      }
      await batch.commit();
    }
    return created;
  }

  async deleteMany(ids: string[]): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      const batch = this.db.batch();
      for (const id of chunk) batch.delete(this.col().doc(id));
      await batch.commit();
      deleted += chunk.length;
    }
    return deleted;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return null;
    const { id: _omit, ...rest } = patch as Partial<T> & { id?: string };
    void _omit;
    await ref.set(rest as FirebaseFirestore.DocumentData, { merge: true });
    const updated = await ref.get();
    return { ...(updated.data() as object), id } as T;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.col().doc(id);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }
}

// ─── Store factory ──────────────────────────────────────────────────────────
// Collection names mirror the DataStore keys; id prefixes match the seed/in-memory
// store so generated ids stay consistent across backends.
const COLLECTIONS: Array<[keyof DataStore, string]> = [
  ["users", "usr"],
  ["teams", "team"],
  ["leads", "lead"],
  ["activities", "act"],
  ["siteVisits", "sv"],
  ["assignmentRules", "rule"],
  ["projects", "proj"],
  ["towers", "twr"],
  ["units", "unit"],
  ["bookings", "bkg"],
  ["payments", "pay"],
  ["channelPartners", "cp"],
  ["campaigns", "camp"],
  ["templates", "tmpl"],
  ["segments", "seg"],
];

export function createFirestoreStore(): DataStore {
  // Deliberately does not touch getDb(): building the store must stay free of
  // credentials so `next build` never needs them. The first real query connects.
  const store = {} as Record<keyof DataStore, FirestoreRepository<{ id: string }>>;
  for (const [key, prefix] of COLLECTIONS) {
    store[key] = new FirestoreRepository(key as string, prefix);
  }
  return store as unknown as DataStore;
}
