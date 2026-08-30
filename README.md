# EstateCRM

A real estate sales CRM: lead-to-booking lifecycle, inventory and booking management, marketing automation, channel-partner network, and analytics — in one workspace.

The repo ships with **two projects (Agartha and SYL) and one administrator account**. There is no demo data: no leads, no units, no bookings. You add inventory through the app and bring leads in by CSV import.

---

## Getting started

```bash
npm install
cp .env.example .env.local
```

Set at least a session secret in `.env.local`:

```bash
# Signs the session cookie. Required — the app refuses to boot in production without it.
SESSION_SECRET="$(openssl rand -base64 48)"
```

Then:

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with the bootstrap account:

| | |
| --- | --- |
| Email | `admin@estatecrm.local` (override with `BOOTSTRAP_EMAIL`) |
| Password | `changeme-on-first-login` (override with `BOOTSTRAP_PASSWORD`) |

You are sent straight to a change-password screen — the bootstrap credential cannot be used for anything else.

### First fifteen minutes

1. **Add your team** — Settings → Users. Create a Sales Agent or two. Until at least one exists, imported leads have nobody to be assigned to and stay unassigned.
2. **Enter inventory** — Inventory → Agartha → *Add tower*, then *Generate floors* to create a grid of units in one step. Repeat for SYL.
3. **Bring in leads** — Leads → *Import CSV*. Columns are auto-detected; you confirm the mapping before anything is written.

---

## Modules

| Module | What it does |
| --- | --- |
| **Leads & Sales** | Lead capture (CSV import + manual entry) across eleven sources including Instagram, auto-distribution rules (round-robin / load-balanced / source- & project-based), lead scoring & temperature, activity timeline, tasks & follow-ups, Kanban pipeline, site-visit scheduling. |
| **Inventory & Booking** | Projects → towers → units, entered through the app. Real-time availability, unit pricing, bookings with a Token → Agreement → Registered workflow, construction-linked payment milestones. |
| **Marketing** | Email / SMS / WhatsApp campaign records, reusable templates with merge tags, audience segments evaluated live against the lead base, funnel metrics. *Nothing is actually sent — no provider is wired.* |
| **Channel Partners** | Broker onboarding & KYC status, RERA tracking, commission configuration, partner-sourced lead attribution. |
| **Insights** | Cross-module dashboard, source & stage breakdowns, agent leaderboard, monthly trend, conversion analytics. |

---

## Access control

Seven roles (Admin, Sales Head, Sales Manager, Sales Agent, Marketing, Channel Partner, Viewer) against a 14-permission matrix in `src/server/auth/rbac.ts`. Enforcement happens at three layers:

1. **Navigation** — the sidebar only shows what your role can reach.
2. **Routes** — every page in the `(dashboard)` group calls `requirePermission()` and renders a 403 otherwise. `npm test` fails the build if a page is added without one.
3. **Rows** — a Sales Agent sees only leads they own; a Sales Manager sees their team's. The scope is imposed server-side and cannot be widened with a query parameter.

Write actions re-check permission independently, since a server action is a POST endpoint that can be called directly.

### Authentication

Email and password. Passwords are hashed with scrypt (`src/server/auth/password.ts`); the session cookie is an HMAC-signed token with a 7-day expiry (`src/server/auth/token.ts`). Admin-set passwords force a change on first sign-in.

---

## Data layer

Every module talks to the database **only** through the `DataStore` interface (`src/server/db/store.ts`). Pick a backend with `DATA_DRIVER`:

| Driver | Durable? | Use it for |
| --- | --- | --- |
| `memory` (default) | **No** | Local UI work. The store is rebuilt on every boot — all writes are lost on restart, and separate serverless instances each hold their own copy. |
| `firebase` | Yes | Anything real. Firestore via the Admin SDK. |

Switching backends changes no business logic.

### Running on Firestore

**1. Create the database.** This is a one-time step in the Firebase console and
cannot be done from a service account:

> Firebase Console → your project → Firestore Database → **Create database** →
> pick a location → Production mode

The location is **permanent** — pick the region closest to your users
(`asia-south1` / Mumbai for India, which also matches the `bom1` region pinned
in `vercel.json`). Skipping this step produces a `PERMISSION_DENIED … has not
been used in project` error on the first query; the seeder and inspector both
translate that into these instructions.

**2. Get a service-account key.** Firebase Console → Project settings →
Service accounts → *Generate new private key*. Treat the downloaded JSON as a
password: it bypasses all Firestore security rules.

**3. Configure `.env.local`** (gitignored):

```bash
DATA_DRIVER="firebase"
FIREBASE_PROJECT_ID="your-project"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
SESSION_SECRET="…"
```

Keep the literal `\n` escapes in the key — the app converts them back to real
newlines, and Vercel stores multi-line secrets the same way.

**4. Seed and verify:**

```bash
npm run db:seed:firebase   # two projects + the admin account
npm run db:inspect         # read-only: shows exactly what is stored
```

The seeder refuses to run against a project that already has an admin, so it
cannot silently reset a live password. Use `npm run db:seed:firebase:wipe` to
erase and start over.

### Running against the Firestore emulator

No credentials needed — only a project id:

```bash
npx firebase-tools setup:emulators:firestore
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host=127.0.0.1 --port=8085

FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm run db:seed:firebase
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm run dev
```

> `prisma/schema.prisma` models the full domain but no store implements it. `DATA_DRIVER=prisma` throws rather than silently falling back to memory.

---

## Architecture

```
src/
├── app/
│   ├── (dashboard)/        # authenticated app shell + all module pages
│   └── (auth)/             # login, forced password change
├── components/
│   ├── ui/                 # design-system primitives (Button, Card, Table…)
│   ├── layout/             # sidebar, topbar, search, notifications
│   └── charts.tsx          # recharts wrappers
├── config/nav.ts           # RBAC-aware navigation registry — also the source
│                           #   of truth for which permission a route needs
├── server/
│   ├── db/                 # DataStore contract + memory & Firestore impls
│   ├── auth/               # session, password, token, RBAC, guards
│   └── modules/            # business logic per module
├── types/domain.ts         # shared domain types
└── lib/                    # formatting, CSV parsing, status colours
tests/                      # vitest: auth, CSV, route guards, domain rules
```

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm run db:seed:firebase` | Seed projects + admin into Firestore |
| `npm run db:inspect` | Read-only dump of what Firestore actually holds |
| `npm run db:seed:firebase:wipe` | Wipe each collection, then re-seed |

---

## Not built yet

Named so the scope is clear:

- **Outbound messaging.** Campaigns and templates are modelled and measured, but no email/SMS/WhatsApp provider sends them.
- **Automatic lead capture.** Leads arrive by CSV import or manual entry. There is no webhook endpoint for Meta Lead Ads or portal integrations.
- **Password reset by email.** An administrator resets passwords from Settings → Users; there is no self-service email flow.

---

## Deploying to Vercel

1. Import the repo at <https://vercel.com/new>.
2. Set `SESSION_SECRET`, `DATA_DRIVER=firebase` and the three `FIREBASE_*` variables.
3. Deploy.

Do not run a deployment with `DATA_DRIVER=memory` — each serverless instance would hold a different copy of the data.
