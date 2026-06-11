/**
 * EstateCRM — Firestore seeder.
 *
 * Writes the deterministic demo dataset into Firestore so a fresh Firebase
 * project is immediately explorable. Idempotent: documents are written by their
 * seed id, so re-running overwrites rather than duplicating.
 *
 * Usage (requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY):
 *   npm run db:seed:firebase
 *   npm run db:seed:firebase -- --wipe   # delete existing docs in each collection first
 */
// Best-effort load of .env.local (Node ≥20.12) so FIREBASE_* vars are available
// when run locally; harmless/no-op if the file or API is absent.
try {
  (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* no .env.local — rely on the ambient environment */
}

import { getDb } from "../src/server/db/firebase";
import { buildSeed } from "../src/server/db/seed";

const BATCH_LIMIT = 450; // Firestore caps writes at 500 per batch.

async function wipeCollection(db: FirebaseFirestore.Firestore, name: string) {
  const snap = await db.collection(name).get();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
    await batch.commit();
  }
  if (snap.size) console.log(`  · wiped ${snap.size} existing doc(s) from ${name}`);
}

async function main() {
  const wipe = process.argv.includes("--wipe");
  const db = getDb();
  const seed = buildSeed();
  const collections = Object.keys(seed);

  console.log(`Seeding Firestore — ${collections.length} collections${wipe ? " (wipe first)" : ""}…`);

  let total = 0;
  for (const name of collections) {
    const rows = seed[name] ?? [];
    if (wipe) await wipeCollection(db, name);

    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const row of rows.slice(i, i + BATCH_LIMIT)) {
        // Keep `id` as a field too (not just the doc key) for query parity.
        batch.set(db.collection(name).doc(row.id), row);
      }
      await batch.commit();
    }
    total += rows.length;
    console.log(`  ✓ ${name}: ${rows.length} doc(s)`);
  }

  console.log(`Done. Wrote ${total} documents across ${collections.length} collections.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
