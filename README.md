# EstateCRM

A production-grade **real estate sales CRM** in the class of [Sell.Do](https://sell.do) — built from scratch on Next.js. Lead-to-booking lifecycle, inventory & booking management, marketing automation, channel-partner network, and analytics, all in one workspace.

> **Runs with zero database setup.** EstateCRM ships with a swappable data layer that defaults to a richly-seeded in-memory store, so you can explore the entire product immediately. When you're ready, point it at Postgres via Prisma without touching business logic.

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
Every module talks to the database **only** through the `DataStore` interface (`src/server/db/store.ts`). Today it's backed by `InMemoryRepository`; tomorrow, implement a `PrismaStore` against the same interface and flip `DATA_DRIVER=prisma`. No business logic changes.

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
| `npm run db:generate` | Generate Prisma client (when wiring the DB) |
| `npm run db:migrate` | Run migrations (after setting `DATABASE_URL`) |

---

## ▲ Deploying to Vercel

The repo is Vercel-ready out of the box (`vercel.json` pins the Next.js framework preset and the `bom1` region; `.nvmrc` pins Node 20):

1. Import the repo at <https://vercel.com/new> (or `npx vercel`).
2. No environment variables are required for the demo — `DATA_DRIVER` defaults to `memory`.
3. Deploy. Done.

**Notes for the in-memory demo on serverless:**
- Each serverless instance seeds its own deterministic dataset, so reads are always consistent, but writes (new leads, bookings, …) live only for the lifetime of that instance. That's expected for the demo tier.
- For durable data, wire up Postgres (below) — Vercel Postgres / Neon / Supabase all work — and set `DATA_DRIVER=prisma` + `DATABASE_URL` in the Vercel project's environment variables.
- Type errors fail the build; ESLint is reported via `npm run lint` but doesn't block deploys.

---

## 🗄️ Wiring up a real database (later)

1. Set `DATABASE_URL` in `.env.local` to your Postgres instance.
2. `npm run db:migrate` to create the schema.
3. Implement `PrismaStore` (implements `DataStore`) and return it from `src/server/db/index.ts` when `DATA_DRIVER=prisma`.
4. Set `DATA_DRIVER=prisma`.

The Prisma schema in `prisma/schema.prisma` already models every entity used by the app.

---

## 🔌 Integration points (stubbed, ready to wire)

`.env.example` documents the env vars for telephony/IVR, WhatsApp, SMS, email (SendGrid), and lead-source webhooks (Facebook Lead Ads, Google Ads). These are intentionally left as configuration seams.

---

## 🛠️ Tech

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · Prisma · Recharts · Zod · lucide-react.
