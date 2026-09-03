# EstateCRM product promo

A 34-second product ad for EstateCRM itself, built from real screens of the
running app, a locally synthesised narrator, per-scene sound design and a music
bed. Everything is generated; nothing is hand-edited, so re-running the pipeline
after a UI change produces a fresh cut.

One composition, three Meta placements — chosen with `FORMAT`:

| `FORMAT` | Size | Placement |
| --- | --- | --- |
| `9x16` (default) | 1080×1920 | Reels, Stories |
| `4x5` | 1080×1350 | Feed, the tallest post accepted |
| `1x1` | 1080×1080 | Feed, square |

A Reel is not a square with the sides chopped off, so the formats are re-staged
rather than re-cropped: the safe area, the hero's size and position, the camera
push and the type scale all come from the format table at the top of
`build.mjs`. Only the feed puts real chrome over the video, so the square and
portrait cuts reclaim most of the reserved band and stage everything larger.

`SAFE_ZONES=1 node build.mjs` overlays Instagram's reserved bands so you can see
what the app will cover.

## Pipeline

1. **Capture screens** from a running instance (needs an admin session cookie JSON):
   `S=<dir with admin-session.json> EXE=/path/to/chromium node capture.mjs` → `shots/`
   Downscale into `assets/shots/` (1920 wide desktop, 780 wide mobile).
2. **Narration** with Kokoro-82M (Apache 2.0, runs on CPU, no API key):
   `pip install kokoro-onnx soundfile`, download `kokoro-v1.0.onnx` + `voices-v1.0.bin`
   from github.com/thewh1teagle/kokoro-onnx releases, then
   `python3 vo/voice.py <model dir> am_michael` → `vo/*.wav` + `vo/timings.json`.
   Copy the wavs to `assets/vo/` and `timings.json` beside `build.mjs`.
   The default is `am_michael` — a measured US male read, which is what the
   cuts in `out/` use. Other voices worth trying: `am_onyx` (deeper US),
   `bm_george` (British), `hm_psi` and `hm_omega` (Indian male), `hf_alpha` and
   `hf_beta` (Indian female). The `h*` voices are Hindi-trained and read English
   with an Indian accent.

   **ElevenLabs instead:** `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node vo/elevenlabs.mjs`
   writes the same wavs and `timings.json`, so `build.mjs` cannot tell the
   difference and scene timing follows the new read automatically. It defaults
   to `eleven_v3`, which reads per-scene direction tags (`[warmly]`,
   `[excited]`) rather than speaking them.

   To use a Voice Library voice such as Bunty, add it to your workspace in the
   ElevenLabs web app first — the library is not reachable from the API — then
   copy its id from Voices into `ELEVENLABS_VOICE_ID`.
3. **Sound design**: `sh make-sfx.sh` (twelve FFmpeg-synthesised effects) and
   `sh make-bed.sh <total seconds>` after the first build prints the total.
4. **Build + render**: `FORMAT=9x16 node build.mjs && npm run check && npm run render`,
   once per format.
   `assets/` also needs `gsap.min.js` and `fonts/IBMPlexSans-*.ttf` from `public/reel-kit`.

`assets/` is generated, not committed — steps 1–3 build it, and `.gitignore`
keeps it out of the repo so a clone does not carry ~50 MB of screenshots, speech
and sound effects.

## Carousel

`EXE=/path/to/chromium node carousel.mjs` renders five 1080×1350 slides from the same
screens (`SIZE=1080x1080` for the square feed variant) into `out/`. They share the
video's palette, type and device mockups, so a carousel and a Reel posted in the
same week read as one campaign.

## Script

Edit `vo/cues.json`. Scene timing follows the narration, so a longer line makes a
longer scene automatically. Six beats: behaviour-first hook, dashboard, leads and
assignment, pipeline on a phone, inventory/bookings/reports, end card with one CTA.
