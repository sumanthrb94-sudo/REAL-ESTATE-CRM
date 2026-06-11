# EstateCRM

A production-grade **real estate sales CRM** in the class of [Sell.Do](https://sell.do) — built from scratch on Next.js. Lead-to-booking lifecycle, inventory & booking management, marketing automation, channel-partner network, and analytics, all in one workspace.

> **Runs with zero database setup.** EstateCRM ships with a swappable data layer that defaults to a richly-seeded in-memory store, so you can explore the entire product immediately. When you're ready, flip `DATA_DRIVER=firebase` to run on **Firestore** (durable) — no business logic changes.

---

## ✨ Modules

| Module | What it does |
| --- | --- |
| **Leads & Sales** | Omni-source lead capture (web, 99acres, MagicBricks, Housing, Facebook, Google Ads, walk-in, referral, call-center), auto lead distribution rules (round-robin / load-balanced / source- & project-based), lead scoring & temperature, activity timeline, tasks & follow-ups, Kanban pipeline, site-visit scheduling. |
| **Inventory & Booking** | Projects → towers → units hierarchy, real-time availability, unit pricing, bookings with status workflow (Token → Agreement → Registered), construction-linked payment milestones. |
| **Marketing Automation** | Email / SMS / WhatsApp campaigns, reusable templates, audience segments with stored filters, funnel metrics (sent → delivered → opened → clicked → converted). |
| **Channel Partners** | Broker onboarding & KYC status, RERA tracking, commission configuration, partner-sourced lead attribution. |
| **Insights** | Cross-module dashboard, source & stage breakdowns, agent leaderboard, monthly trend, conversion analytics. |

Access to every module is gated by **role-based access control** (Admin, Sales Head, Sales Manager, Sales Agent, Marketing, Channel Partner, Viewer).

---

## 🧱 Architecture

```
src/
├── app/
│   ├── (dashboard)/        # authenticated app shell + all module pages
│   └── (auth)/             # login / user switcher
├── components/
│   ├── ui/                 # design-system primitives (Button, Card, Table…)
│   ├── layout/             # sidebar, topbar
│   └── charts.tsx          # recharts wrappers
├── config/nav.ts           # RBAC-aware navigation registry
├── server/
│   ├── db/                 # DataStore contract + in-memory impl + seed
│   ├── auth/               # session + RBAC permission matrix
│   └── modules/            # business logic services per module
├── types/domain.ts         # shared domain types (mirror Prisma schema)
└── lib/utils.ts            # formatting & helpers
prisma/schema.prisma        # full data model (ready to migrate)
```

### Swappable data layer
Every module talks to the database **only** through the `DataStore` interface (`src/server/db/store.ts`). Pick a backend via `DATA_DRIVER`: `memory` (default, seeded) or `firebase` (Firestore, durable — see below). Postgres/Prisma can be added the same way. No business logic changes between backends.

---

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000> → redirects to the dashboard.

### Useful scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm run db:seed:firebase` | Seed the demo dataset into Firestore |
| `npm run db:seed:firebase:wipe` | Wipe each collection, then re-seed |
| `npm run db:generate` | Generate Prisma client (alternative backend) |
| `npm run db:migrate` | Run Prisma migrations (alternative backend) |

---

## ▲ Deploying to Vercel

The repo is Vercel-ready out of the box (`vercel.json` pins the Next.js framework preset and the `bom1` region; `.nvmrc` pins Node 20):

1. Import the repo at <https://vercel.com/new> (or `npx vercel`).
2. No environment variables are required for the demo — `DATA_DRIVER` defaults to `memory`.
3. Deploy. Done.

**Notes for the in-memory demo on serverless:**
- Each serverless instance seeds its own deterministic dataset, so reads are always consistent, but writes (new leads, bookings, …) live only for the lifetime of that instance. That's expected for the demo tier.
- For durable data, use **Firebase/Firestore** (below) — set `DATA_DRIVER=firebase` + the `FIREBASE_*` vars in the Vercel project's environment variables.
- Type errors fail the build; ESLint is reported via `npm run lint` but doesn't block deploys.

---

## 🔥 Connecting Firebase / Firestore (durable backend)

Firestore is a first-class backend implementing the same `DataStore` contract — no business-logic changes. The adapter lives in `src/server/db/firebase.ts` (Firebase **Admin SDK**, server-side only).

**1. Create the project & service account**
- Create a Firebase project and enable **Cloud Firestore** (Console → Build → Firestore Database → Create).
- Console → Project settings → **Service accounts** → **Generate new private key** (downloads a JSON file).

**2. Set environment variables** (`.env.local` locally, and the Vercel project settings for deploys):
```bash
DATA_DRIVER=firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
# Paste the full key on one line, keeping the literal \n escapes.
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```
(These map to the `project_id`, `client_email`, and `private_key` fields in the downloaded JSON.)

**3. Seed the demo data** (optional, one-off):
```bash
npm run db:seed:firebase          # writes ~900 demo docs across 15 collections
npm run db:seed:firebase:wipe     # clears each collection first, then re-seeds
```
Seeding is idempotent (documents are keyed by their seed id), so re-running overwrites rather than duplicating.

**4. Run.** With `DATA_DRIVER=firebase` set, the whole app reads and writes Firestore. Unlike the in-memory demo, writes now persist across serverless instances.

**Local development against the Firestore emulator** (no real project needed):
```bash
firebase emulators:start --only firestore --project demo-estate          # terminal 1
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-estate \
  DATA_DRIVER=firebase npm run db:seed:firebase                          # seed
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-estate \
  DATA_DRIVER=firebase npm run dev                                       # run
```
When `FIRESTORE_EMULATOR_HOST` is set, the adapter connects to the emulator and no service-account credentials are required.

> **Query design:** equality `where` filters are pushed to Firestore (equality-only, so no composite indexes are needed); ordering and pagination are applied in memory. This keeps behaviour identical to the in-memory store and avoids "this query requires an index" runtime errors.

---

## 🐘 Alternative: Postgres via Prisma

Prefer SQL? The `DataStore` contract is backend-agnostic. Set `DATABASE_URL`, run `npm run db:migrate`, implement a `PrismaStore` and return it from `src/server/db/index.ts` under a `prisma` driver case. The Prisma schema in `prisma/schema.prisma` already models every entity.

---

## 🔌 Integration points (stubbed, ready to wire)

`.env.example` documents the env vars for telephony/IVR, WhatsApp, SMS, email (SendGrid), and lead-source webhooks (Facebook Lead Ads, Google Ads). These are intentionally left as configuration seams.

---

## 🛠️ Tech

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · Prisma · Recharts · Zod · lucide-react.
