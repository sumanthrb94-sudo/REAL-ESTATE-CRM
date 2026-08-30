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
import { buildSeed, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD } from "../src/server/db/seed";
import { hashPasswordSync } from "../src/server/auth/password";

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
  const seed = buildSeed(hashPasswordSync(BOOTSTRAP_PASSWORD));
  const collections = Object.keys(seed);

  // Re-seeding without --wipe would reset an existing admin's password back to
  // the bootstrap value, so refuse when that account already exists.
  const existingAdmin = await db.collection("users").doc("usr_admin").get();
  if (existingAdmin.exists && !wipe) {
    console.error(
      "Refusing to seed: an admin account already exists in this project.\n" +
        "Re-running would overwrite its password with the bootstrap value.\n" +
        "Use `npm run db:seed:firebase:wipe` if you really want to erase and start over.",
    );
    process.exit(1);
  }

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

  console.log(`\nDone. Wrote ${total} documents across ${collections.length} collections.`);
  console.log(`\nSign in at /login with:`);
  console.log(`  email:    ${BOOTSTRAP_EMAIL}`);
  console.log(`  password: ${BOOTSTRAP_PASSWORD}`);
  console.log(`You will be asked to choose a new password immediately.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    const msg = String(err?.message ?? err);

    // First-run failure for every new project. The raw gRPC error is 300
    // characters of stack around one actionable sentence, so surface the fix.
    if (msg.includes("has not been used in project") || msg.includes("SERVICE_DISABLED")) {
      console.error(
        [
          "",
          "Firestore is not enabled on this project yet, so there is nothing to seed.",
          "",
          "Create the database once, in the Firebase console:",
          `  https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore`,
          "  -> Create database -> pick a location -> Production mode",
          "",
          "The location is permanent; pick the region closest to your users",
          "(asia-south1 / Mumbai for India). Then re-run this command.",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }

    if (msg.includes("UNAUTHENTICATED") || msg.includes("invalid_grant")) {
      console.error(
        "\nCredentials rejected. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY" +
          " (the key must keep its \\n escapes).\n",
      );
      process.exit(1);
    }

    console.error("Seed failed:", err);
    process.exit(1);
  });
