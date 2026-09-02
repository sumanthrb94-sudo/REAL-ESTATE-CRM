# EstateCRM product promo

A 34-second vertical (1080×1920) product ad for EstateCRM itself, built from real
screens of the running app, a locally synthesised narrator, per-scene sound design
and a music bed. Everything is generated; nothing is hand-edited, so re-running the
pipeline after a UI change produces a fresh cut.

## Pipeline

1. **Capture screens** from a running instance (needs an admin session cookie JSON):
   `S=<dir with admin-session.json> EXE=/path/to/chromium node capture.mjs` → `shots/`
   Downscale into `assets/shots/` (1920 wide desktop, 780 wide mobile).
2. **Narration** with Kokoro-82M (Apache 2.0, runs on CPU, no API key):
   `pip install kokoro-onnx soundfile`, download `kokoro-v1.0.onnx` + `voices-v1.0.bin`
   from github.com/thewh1teagle/kokoro-onnx releases, then
   `python3 vo/voice.py <model dir> am_michael` → `vo/*.wav` + `vo/timings.json`.
   Copy the wavs to `assets/vo/` and `timings.json` beside `build.mjs`.
   Voices worth trying: `am_michael` (deep US), `bm_george` (British), `am_adam`.
   With an ElevenLabs key, `npx hyperframes tts` gives the same files from a premium voice.
3. **Sound design**: `sh make-sfx.sh` (twelve FFmpeg-synthesised effects) and
   `sh make-bed.sh <total seconds>` after the first build prints the total.
4. **Build + render**: `node build.mjs && npm run check && npm run render`.
   `assets/` also needs `gsap.min.js` and `fonts/IBMPlexSans-*.ttf` from `public/reel-kit`.

## Script

Edit `vo/cues.json`. Scene timing follows the narration, so a longer line makes a
longer scene automatically. Six beats: behaviour-first hook, dashboard, leads and
assignment, pipeline on a phone, inventory/bookings/reports, end card with one CTA.
