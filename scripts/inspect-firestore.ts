/**
 * EstateCRM — read-only Firestore inspector.
 *
 * Prints what is actually stored, so you can check a project before seeding it
 * and confirm afterwards that the app is writing where you think it is.
 * Writes nothing.
 *
 *   npm run db:inspect
 *
 * Reads FIREBASE_* from .env.local. Set FIRESTORE_EMULATOR_HOST to point at a
 * local emulator instead of the real project.
 */
import { getDb } from "../src/server/db/firebase";

const COLLECTIONS = [
  "users",
  "teams",
  "leads",
  "activities",
  "siteVisits",
  "assignmentRules",
  "projects",
  "towers",
  "units",
  "bookings",
  "payments",
  "channelPartners",
  "campaigns",
  "templates",
  "segments",
];

(async () => {
  const db = getDb();
  console.log("project :", process.env.FIREBASE_PROJECT_ID);
  console.log("target  :", process.env.FIRESTORE_EMULATOR_HOST ?? "REAL Firestore (googleapis.com)");
  console.log("");

  const counts: Record<string, number> = {};
  let total = 0;
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    counts[name] = snap.size;
    total += snap.size;
  }

  console.log("document counts:");
  for (const [name, n] of Object.entries(counts)) {
    if (n > 0) console.log(`  ${name}: ${n}`);
  }
  console.log(total === 0 ? "  (all collections empty)" : "");
  console.log("TOTAL DOCUMENTS:", total);

  if ((counts.users ?? 0) > 0) {
    const users = (await db.collection("users").get()).docs.map((d) => {
      const u = d.data();
      return { id: d.id, email: u.email, role: u.role };
    });
    console.log("existing users:", JSON.stringify(users));
  }

  // Also surface any collection we do not manage, so we never assume the
  // project is ours to overwrite.
  const all = await db.listCollections();
  const unknown = all.map((c) => c.id).filter((id) => !COLLECTIONS.includes(id));
  console.log("collections NOT part of EstateCRM:", unknown.length ? unknown.join(", ") : "none");
})().catch((e) => {
  const msg = String(e?.message ?? e);

  // The most common first-run failure, and the raw gRPC error buries the fix.
  if (msg.includes("has not been used in project") || msg.includes("SERVICE_DISABLED")) {
    console.error(
      [
        "",
        "Firestore is not enabled on this project yet.",
        "",
        "Create the database once, in the Firebase console:",
        `  https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore`,
        "  -> Create database -> pick a location -> Production mode",
        "",
        "The location is permanent, so choose the region closest to your users",
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

  console.error("INSPECT FAILED:", msg);
  if (e?.code) console.error("  code:", e.code);
  process.exit(1);
});
