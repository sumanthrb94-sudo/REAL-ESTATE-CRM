# Master prompt: EstateCRM Movie Maker and Marketing Studio

Paste everything below the line into Claude Code at the root of this repository.
It is written to be executed in order, one phase per session if needed. Each
phase ends with a working, committed, deployable state.

---

## Goal

Build a complete marketing studio inside EstateCRM (Next.js 15 App Router,
React 19, TypeScript strict, Firestore via firebase-admin, Vercel) so a
marketing user can, without leaving the app:

1. Generate carousels, Reels and a product promo for any project or for the CRM
   itself from live CRM data.
2. Generate lifestyle images, b-roll video, narration and music with Google's
   generative media models using the company's own Gemini API key, with a
   spend ledger and a monthly budget shown on screen.
3. Assemble those assets into a HyperFrames composition with a timeline editor,
   preview it, and render an MP4 on a Cloud Run job (Vercel functions cannot run
   Chrome and FFmpeg).
4. Keep every asset in a library in Firebase Storage, attached to the project it
   was made for, ready for the Meta and Google Ads connectors later.

## What already exists (read these first, do not rebuild them)

- `src/server/content/` — brief derivation from inventory, market layer
  (currency, regulator, area unit), carousel slides via next/og, HyperFrames Reel
  builder, narration script and an ElevenLabs voice driver.
- `src/app/(dashboard)/marketing/studio/page.tsx` — the current Studio page.
- `src/app/api/content/**` — carousel PNG, reel files and voiceover routes,
  every one guarded by `getSessionUser()` and `can(role, "marketing.read")`.
- `marketing/promo/` — the product promo pipeline: Playwright screen capture,
  Kokoro narration, FFmpeg sound design and music bed, `build.mjs` that emits a
  HyperFrames composition timed to the narration, `carousel.mjs` for slides.
- `public/reel-kit/` — GSAP, fonts and SFX shipped with every composition.
- Tests: `tests/content.test.ts`, `tests/route-guards.test.ts` (every API route
  must authenticate), `tests/security.test.ts`.
- RBAC in `src/server/auth/rbac.ts` (`marketing.read`, `marketing.write`).

## Non-negotiable rules

- The Gemini key is read server-side from `GOOGLE_AI_API_KEY` only. It is never
  sent to the client, never logged, never committed. Before every commit run
  `git diff --cached | grep -icE "AIza|MIIEv|firebase-adminsdk"` and require 0.
- Generation models never produce facts. Price, unit types, RERA number,
  developer name and location are always rendered as HTML from the brief.
  Never generate the app's own UI; product screens are real captures.
- Every generation is written to the ledger before the API call and updated
  after, with model, estimated cost, actual cost where known, user, project,
  prompt hash and output path. A generation that would exceed the monthly
  budget is refused with a clear message, not silently downgraded.
- Every new API route and server action carries a permission guard.
  `marketing.read` to view, `marketing.write` to generate or render.
- Compositions follow the HyperFrames contract already used in
  `src/server/content/reel.ts`: one paused GSAP timeline registered on
  `window.__timelines`, every `<audio>` and `<video>` has an id, local assets
  only, no CSS transform on GSAP-animated elements, exit fades on inner
  wrappers with a hard `tl.set` at the clip boundary, one audio lane per family.
- Run `npx tsc --noEmit`, `npx vitest run` and `npm run build` before each
  commit. Extend the tests with each phase. Push to `main`.

## Models and list prices to hard-code in `src/server/media/pricing.ts`

Paid tier, Gemini API, USD. Refresh from https://ai.google.dev/gemini-api/docs/pricing when the file is created.

| Use | Model id | Price |
|---|---|---|
| Image, volume | `gemini-3.1-flash-image` (Nano Banana 2) | about $0.067 per 1K image |
| Image, hero | `gemini-3-pro-image` (Nano Banana Pro) | about $0.134 per image |
| Video, default | `gemini-omni-flash-preview` (Omni Flash, 720p, native audio, conversational edits) | video output $17.50 per 1M tokens at 5,792 tokens per second, about $0.10 per second |
| Video, cheap drafts | `veo-3.1-lite-generate-preview` | $0.05 per s 720p, $0.08 per s 1080p |
| Video, production | `veo-3.1-fast-generate-preview` | $0.10 per s 720p, $0.12 per s 1080p |
| Video, hero | `veo-3.1-generate-preview` | $0.40 per s, $0.60 per s 4K |
| Narration | `gemini-2.5-flash-preview-tts` (30 voices, multilingual, style by prompt) | output tokens, fractions of a cent per 30-second read |
| Music | `lyria-3-clip-preview` (30 s clip) | $0.04 per clip |
| Copy and prompts | `gemini-3.5-flash-lite` | $0.30 in, $2.50 out per 1M tokens |

Google exposes no "credits remaining" endpoint. The API bills pay-as-you-go
against the Cloud billing account attached to the key's project, with a
spend-based rate limit of $10 per rolling 10 minutes on Tier 1. The app's ledger
is the only place a running total exists, so it must be accurate.

## Phase 1: media providers and ledger

Create `src/server/media/`:

- `types.ts`: `MediaProvider` with `generateImage`, `generateVideo`,
  `synthesizeSpeech`, `generateMusic`, each returning `{ bytes, mimeType, model,
  estimatedCostUsd, tokens? }`. A `MediaRequest` carries `projectId`, `purpose`
  (`hero`, `broll`, `narration`, `bed`), `prompt`, `aspect` (`9:16`, `1:1`,
  `16:9`), `seconds`, `resolution`, `referenceImages?`.
- `google.ts`: driver over the Gemini API using `@google/genai` (Interactions
  API for Omni Flash with `delivery: "uri"` and polling; `generateContent` for
  Nano Banana, TTS and Veo; `predictLongRunning` where the SDK requires it).
  Every call has a timeout and retries 429 with backoff. Aspect 9:16 is passed
  through, never cropped afterwards.
- `vertex.ts`: the same models through Vertex AI using the existing Firebase
  service account, selected by `MEDIA_DRIVER=vertex`. Same interface.
- `log.ts`: default driver that writes the request to the ledger with
  `status: "skipped"` and returns nothing, so the app runs without a key.
- `pricing.ts`: the table above plus `estimateCost(request)`.
- `ledger.ts`: Firestore collection `mediaGenerations` with fields
  `id, createdAt, userId, projectId, purpose, model, prompt, promptHash,
  estimatedCostUsd, actualCostUsd?, status (queued|running|done|failed|refused),
  storagePath?, durationMs, error?`. `monthlySpend(orgMonth)` sums done and
  running rows. `MEDIA_MONTHLY_BUDGET_USD` (default 50) gates every call.
- `storage.ts`: Firebase Storage under `media/{projectId}/{purpose}/{hash}.{ext}`
  with signed URLs valid for one hour, and a cache lookup by prompt hash so an
  identical request never bills twice.

Server actions in `src/server/media/actions.ts`: `generateMedia(form)`,
`deleteMedia(id)`, both `requirePermission("marketing.write")`.

Tests: pricing estimates for each model, budget refusal, cache hit skips the
provider, ledger row written before the provider is called, `log` driver never
touches the network, every export in `actions.ts` references a guard.

Env additions to `.env.example`:
`MEDIA_DRIVER=log|google|vertex`, `GOOGLE_AI_API_KEY=`,
`MEDIA_MONTHLY_BUDGET_USD=50`, `MEDIA_MAX_VIDEO_SECONDS=8`,
`MEDIA_DEFAULT_VIDEO_MODEL=gemini-omni-flash-preview`.

## Phase 2: asset library and budget panel in the Studio

- `/marketing/studio/library`: grid of generated and uploaded assets filtered by
  project and purpose, with prompt, model, cost, date, and a delete action.
  Uploads (photos, logos, footage) go to the same storage layout with
  `model: "upload"` and cost 0.
- Budget panel on every Studio page: month-to-date spend, budget, remaining,
  count by model, and a red state when refusals have happened this month.
  This is the "credits" view the user asked for. Say explicitly on the panel that
  Google does not publish a balance and that this is the app's own ledger.
- Generate dialog: purpose, prompt (pre-filled from the brief:
  "{locality}, {city}, evening, residential towers, cinematic, 9:16"), model
  picker with the estimated cost shown before the button is enabled, aspect
  and seconds. Submits to `generateMedia`, shows progress, lands in the library.

## Phase 3: movie maker

- Data model `compositions` in Firestore: `id, projectId | "product", name,
  aspect, scenes[]`. A scene has `kind` (`kinetic`, `capture`, `image`, `video`,
  `endcard`), `assetId?`, `headline`, `caption`, `voiceLine`, `durationSec`,
  `motion` (a named preset from a small catalogue: punch-in, slide, cascade,
  phone-flip, Ken Burns), `sfx[]` (family plus offset) and `transition`.
- Server-side builder `src/server/content/movie.ts` turns a composition into a
  HyperFrames project: index.html plus an asset manifest. Reuse the CSS and
  GSAP patterns from `marketing/promo/build.mjs` and `src/server/content/reel.ts`.
  Narration timing drives scene starts exactly as `build.mjs` does today.
  Music bed from Lyria when available, else the FFmpeg pad. SFX from
  `public/reel-kit` with the lanes and families already defined.
- Editor page `/marketing/studio/movies/[id]`: scene list with drag reorder,
  per-scene form, asset picker from the library, "Write script" button that asks
  `gemini-3.5-flash-lite` for six lines in the house style (behaviour-first hook,
  product on screen by second four, one CTA) and fills `voiceLine`s, and a
  "Generate narration" button that synthesises every line, stores the wavs and
  the measured durations.
- Preview: HyperFrames preview bundle served from `/api/content/movie/[id]/preview`
  inside an iframe, with a scrubber bound to `window.__timelines`.

## Phase 4: render worker on Cloud Run

- `render/` directory with a Dockerfile: Node 22, FFmpeg, the HyperFrames
  Chrome from `npx hyperframes browser ensure`, and a small HTTP server that
  accepts `{ compositionId, quality }`, pulls the composition project and assets
  from Storage, runs `npx hyperframes check` then `render`, uploads the MP4 back
  to `media/{projectId}/renders/{compositionId}-{quality}.mp4`, and posts the
  result to `/api/content/renders/callback` signed with `RENDER_SHARED_SECRET`.
- Deploy as a Cloud Run job or service in the same GCP project. Document the
  `gcloud` commands in `render/README.md`. Add `RENDER_URL` and
  `RENDER_SHARED_SECRET` to the env.
- "Render" button in the editor enqueues a `renders` document, calls the worker,
  and the callback flips it to done with the download URL. Draft renders first,
  high only after a draft has been viewed.

## Phase 5: product promo and carousels inside the app

- Move `marketing/promo` into the movie maker as a seeded composition
  `product-promo` whose capture scenes are refreshed by a server action that runs
  the Playwright capture against the deployed app using a short-lived
  screenshot session.
- Carousel builder gains image backgrounds from the library and the
  "premium and understated" identity already chosen for the CRM.
- Export panel per composition: 9:16 MP4, 1:1 MP4, 16:9 MP4, carousel PNGs, and
  a cover image, each with the exact platform spec printed beside it.

## Phase 6: publishing hooks (design only in this pass)

- Define `PublishTarget` (`instagram`, `facebook`, `google_video`,
  `google_demand_gen`) and a `campaigns` collection with `assetIds`, copy,
  audience notes and status. Build the UI, but leave the platform calls behind a
  `PUBLISH_DRIVER=log` so nothing posts until the Meta and Google Ads
  connectors are wired.

## Acceptance

- With `MEDIA_DRIVER=log` the whole studio works and shows every action as
  "would have generated", with the estimated cost.
- With a real key, generating one Nano Banana 2 image, one 8-second Omni Flash
  clip, one Lyria clip and one narration for Agartha costs under $1.20 in the
  ledger and produces a rendered 9:16 MP4 through Cloud Run.
- A user without `marketing.write` can view the library and budget but every
  generate and render button is disabled and the server actions refuse.
- Tests stay green and the route-guard test still covers every new route.
