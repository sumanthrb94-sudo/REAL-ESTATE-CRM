// A HyperFrames composition for a 12-second Instagram Reel, built from a brief.
//
// HyperFrames renders video from HTML: the DOM declares timing with data-*
// attributes and a single paused GSAP timeline registered on
// window.__timelines. Everything here follows that contract so the file
// passes `npx hyperframes check` unchanged:
//
//   - GSAP and the sound effects are LOCAL files under assets/, never a CDN.
//     A render must not fetch over the network, and the CDN is blocked in
//     some environments anyway.
//   - No CSS `transform` on anything GSAP also transforms (lint rejects the
//     conflict); initial states live in gsap.fromTo.
//   - Every <audio> has an id, or the mixer silently drops it.
//   - No clocks, no Math.random, no infinite repeats: a frame must be
//     reproducible from its time value alone.

import { BRAND } from "./brand";
import type { CreativeBrief } from "./brief";
import { formatArea } from "./market";
import { REEL_PRESET } from "./presets";

export interface ReelOptions {
  /** Adds a narration track expecting assets/vo.mp3 beside the composition. */
  voiceover?: boolean;
}

/** Files a composition expects beside it. Served from /reel-kit for download. */
export const REEL_KIT_FILES = [
  "gsap.min.js",
  "sfx/whoosh.wav",
  "sfx/pop.wav",
  "sfx/thud.wav",
  "fonts/IBMPlexSans-Regular.ttf",
  "fonts/IBMPlexSans-SemiBold.ttf",
  "fonts/IBMPlexSans-Bold.ttf",
] as const;

/** Audio lanes: one per sound so nothing overlaps on a track. */
const TRACK = { whoosh: 10, pop: 11, thud: 12, voice: 13 } as const;

export const REEL_DURATION_S = 12;

/** Scene boundaries in seconds; each scene is a clip with its own window. */
const SCENES = [
  { id: "hook", start: 0, duration: 3.2 },
  { id: "homes", start: 3.2, duration: 3.2 },
  { id: "amenities", start: 6.4, duration: 3.0 },
  { id: "cta", start: 9.4, duration: 2.6 },
] as const;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A composition ID that is a valid HTML id and unique per project. */
export function reelCompositionId(brief: CreativeBrief): string {
  return `reel-${brief.projectId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

export function buildReelComposition(brief: CreativeBrief, options: ReelOptions = {}): string {
  const id = reelCompositionId(brief);
  const { width, height } = REEL_PRESET;
  const [hook, homes, amenities, cta] = SCENES;

  const amenityItems = (brief.amenities.length ? brief.amenities : ["Details on request"])
    .slice(0, 5)
    .map((a, i) => `<li class="amenity" id="am-${i}">${esc(a)}</li>`)
    .join("\n            ");

  const homesLine = brief.unitTypes.length ? brief.unitTypes.join(" &amp; ") : "Homes";
  const priceLine = brief.priceFromLabel ? `from ${esc(brief.priceFromLabel)}` : "Pricing on request";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${esc(brief.name)} — Reel</title>
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "IBM Plex Sans"; font-weight: 400; src: url("assets/fonts/IBMPlexSans-Regular.ttf"); }
      @font-face { font-family: "IBM Plex Sans"; font-weight: 600; src: url("assets/fonts/IBMPlexSans-SemiBold.ttf"); }
      @font-face { font-family: "IBM Plex Sans"; font-weight: 700; src: url("assets/fonts/IBMPlexSans-Bold.ttf"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${BRAND.ground}; }
      #root {
        position: relative; width: ${width}px; height: ${height}px; overflow: hidden;
        font-family: "IBM Plex Sans", "DejaVu Sans", system-ui, sans-serif;
        color: ${BRAND.ink};
      }
      .clip { position: absolute; inset: 0; width: 100%; height: 100%; }
      /* The framework owns a clip's visibility; exits animate this inner box instead. */
      .inner {
        display: flex; flex-direction: column; justify-content: center;
        padding: 96px; width: 100%; height: 100%;
      }
      .eyebrow {
        display: block; font-size: 30px; letter-spacing: 6px; text-transform: uppercase;
        color: ${BRAND.accent}; font-weight: 600;
      }
      .display { display: block; font-size: 148px; font-weight: 700; line-height: 1.0; margin-top: 18px; max-width: 100%; }
      .h2 { display: block; font-size: 96px; font-weight: 700; line-height: 1.05; margin-top: 18px; }
      .body { display: block; font-size: 44px; color: ${BRAND.inkMuted}; margin-top: 28px; line-height: 1.35; }
      .rule { display: block; width: 220px; height: 10px; background: ${BRAND.accent}; margin-top: 40px; }
      .amenities { list-style: none; margin-top: 40px; }
      .amenity {
        display: flex; align-items: center; gap: 24px;
        font-size: 60px; font-weight: 600; line-height: 1.1; margin-top: 22px;
      }
      .amenity::before {
        content: ""; display: block; width: 18px; height: 18px; border-radius: 50%;
        background: ${BRAND.accent}; flex: 0 0 18px;
      }
      .pill {
        display: inline-block; margin-top: 56px; padding: 26px 40px; border-radius: 16px;
        background: ${BRAND.accent}; color: ${BRAND.ground}; font-size: 44px; font-weight: 700;
      }
      .footer {
        position: absolute; left: 96px; right: 96px; bottom: 80px;
        display: flex; justify-content: space-between; font-size: 30px; color: ${BRAND.inkFaint};
      }
      .glow {
        position: absolute; width: 1400px; height: 1400px; border-radius: 50%;
        background: radial-gradient(circle, ${BRAND.accentDeep} 0%, ${BRAND.ground} 62%);
        left: -500px; top: -420px; opacity: 0.55;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${id}" data-start="0" data-duration="${REEL_DURATION_S}" data-width="${width}" data-height="${height}">
      <div id="glow" class="glow"></div>

      <section id="scene-hook" class="clip" data-start="${hook.start}" data-duration="${hook.duration}" data-track-index="1">
        <div id="hook-inner" class="inner">
          <span id="hook-eyebrow" class="eyebrow">${esc(brief.developer)}</span>
          <span id="hook-title" class="display">${esc(brief.name)}</span>
          <span id="hook-rule" class="rule"></span>
          <span id="hook-body" class="body">${esc(brief.location)}</span>
        </div>
      </section>

      <section id="scene-homes" class="clip" data-start="${homes.start}" data-duration="${homes.duration}" data-track-index="1">
        <div id="homes-inner" class="inner">
          <span id="homes-eyebrow" class="eyebrow">${homesLine}</span>
          <span id="homes-title" class="display">${priceLine}</span>
          <span id="homes-body" class="body">${brief.carpetMax ? `Carpet area up to ${esc(formatArea(brief.carpetMax, brief.market))}` : esc(brief.location)}</span>
        </div>
      </section>

      <section id="scene-amenities" class="clip" data-start="${amenities.start}" data-duration="${amenities.duration}" data-track-index="1">
        <div id="amenities-inner" class="inner">
          <span id="am-eyebrow" class="eyebrow">Life at ${esc(brief.name)}</span>
          <ul class="amenities">
              ${amenityItems}
          </ul>
        </div>
      </section>

      <section id="scene-cta" class="clip" data-start="${cta.start}" data-duration="${cta.duration}" data-track-index="1">
        <div id="cta-inner" class="inner">
          <span id="cta-eyebrow" class="eyebrow">Visit ${esc(brief.name)}</span>
          <span id="cta-title" class="h2">${esc(BRAND.cta)}</span>
          <span id="cta-pill" class="pill">${esc(BRAND.handle)}</span>
        </div>
      </section>

      <div class="footer">
        <span>${esc(BRAND.handle)}</span>
        <span>${esc(brief.registrationLabel ?? brief.developer)}</span>
      </div>

      <audio id="sfx-whoosh-1" src="assets/sfx/whoosh.wav" data-start="${hook.start}" data-duration="0.7" data-track-index="${TRACK.whoosh}" data-volume="0.9"></audio>
      <audio id="sfx-pop-1" src="assets/sfx/pop.wav" data-start="${(hook.start + 0.55).toFixed(2)}" data-duration="0.18" data-track-index="${TRACK.pop}" data-volume="0.8"></audio>
      <audio id="sfx-whoosh-2" src="assets/sfx/whoosh.wav" data-start="${homes.start}" data-duration="0.7" data-track-index="${TRACK.whoosh}" data-volume="0.9"></audio>
      <audio id="sfx-thud-1" src="assets/sfx/thud.wav" data-start="${(homes.start + 0.45).toFixed(2)}" data-duration="0.5" data-track-index="${TRACK.thud}" data-volume="0.9"></audio>
      <audio id="sfx-whoosh-3" src="assets/sfx/whoosh.wav" data-start="${amenities.start}" data-duration="0.7" data-track-index="${TRACK.whoosh}" data-volume="0.9"></audio>
      <audio id="sfx-pop-2" src="assets/sfx/pop.wav" data-start="${(amenities.start + 0.5).toFixed(2)}" data-duration="0.18" data-track-index="${TRACK.pop}" data-volume="0.7"></audio>
      <audio id="sfx-whoosh-4" src="assets/sfx/whoosh.wav" data-start="${cta.start}" data-duration="0.7" data-track-index="${TRACK.whoosh}" data-volume="0.9"></audio>
      <audio id="sfx-thud-2" src="assets/sfx/thud.wav" data-start="${(cta.start + 0.6).toFixed(2)}" data-duration="0.5" data-track-index="${TRACK.thud}" data-volume="1"></audio>${
        options.voiceover
          ? `\n      <audio id="vo" src="assets/vo.mp3" data-start="0" data-duration="${REEL_DURATION_S}" data-track-index="${TRACK.voice}" data-volume="1"></audio>`
          : ""
      }
    </div>

    <script>
      // One paused timeline, keyed by the root's data-composition-id. Every
      // tween starts from a gsap.fromTo so no CSS transform can fight it.
      const tl = gsap.timeline({ paused: true });
      const up = { y: 70, opacity: 0 };
      const settle = { y: 0, opacity: 1, ease: "power3.out" };

      // Ambient glow drifts for the full length; a finite tween, never an infinite one.
      tl.fromTo("#glow", { x: 0, y: 0 }, { x: 380, y: 520, duration: ${REEL_DURATION_S}, ease: "sine.inOut" }, 0);

      // Scene 1 — hook
      tl.fromTo("#hook-eyebrow", up, { ...settle, duration: 0.5 }, ${hook.start + 0.1});
      tl.fromTo("#hook-title", { y: 110, opacity: 0 }, { ...settle, duration: 0.7 }, ${hook.start + 0.25});
      tl.fromTo("#hook-rule", { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, ${hook.start + 0.6});
      tl.fromTo("#hook-body", up, { ...settle, duration: 0.5 }, ${hook.start + 0.75});
      tl.to("#hook-inner", { opacity: 0, duration: 0.3, ease: "power1.in" }, ${hook.start + hook.duration - 0.3});
      tl.set("#hook-inner", { opacity: 0 }, ${hook.start + hook.duration});

      // Scene 2 — homes & price
      tl.fromTo("#homes-eyebrow", up, { ...settle, duration: 0.5 }, ${homes.start + 0.1});
      tl.fromTo("#homes-title", { scale: 0.86, opacity: 0, transformOrigin: "0 50%" }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.4)" }, ${homes.start + 0.4});
      tl.fromTo("#homes-body", up, { ...settle, duration: 0.5 }, ${homes.start + 0.85});
      tl.to("#homes-inner", { opacity: 0, duration: 0.3, ease: "power1.in" }, ${homes.start + homes.duration - 0.3});
      tl.set("#homes-inner", { opacity: 0 }, ${homes.start + homes.duration});

      // Scene 3 — amenities, staggered
      tl.fromTo("#am-eyebrow", up, { ...settle, duration: 0.5 }, ${amenities.start + 0.1});
      tl.fromTo(".amenity", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.16 }, ${amenities.start + 0.35});
      tl.to("#amenities-inner", { opacity: 0, duration: 0.3, ease: "power1.in" }, ${amenities.start + amenities.duration - 0.3});
      tl.set("#amenities-inner", { opacity: 0 }, ${amenities.start + amenities.duration});

      // Scene 4 — call to action
      tl.fromTo("#cta-eyebrow", up, { ...settle, duration: 0.5 }, ${cta.start + 0.1});
      tl.fromTo("#cta-title", { y: 90, opacity: 0 }, { ...settle, duration: 0.6 }, ${cta.start + 0.3});
      tl.fromTo("#cta-pill", { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.8)" }, ${cta.start + 0.75});

      window.__timelines["${id}"] = tl;
    </script>
  </body>
</html>
`;
}

/** Files to write beside index.html so `npx hyperframes render` works as-is. */
export function reelProjectFiles(brief: CreativeBrief, options: ReelOptions = {}): Record<string, string> {
  const id = reelCompositionId(brief);
  return {
    "index.html": buildReelComposition(brief, options),
    "package.json": JSON.stringify(
      {
        name: id,
        private: true,
        type: "module",
        scripts: {
          check: "npx --yes hyperframes@0.8.26 check",
          preview: "npx --yes hyperframes@0.8.26 preview --background",
          render: "npx --yes hyperframes@0.8.26 render --quality high --output reel.mp4",
        },
      },
      null,
      2,
    ),
    "hyperframes.json": JSON.stringify(
      {
        $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
        paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
        media: { autoProxy: true },
      },
      null,
      2,
    ),
    "meta.json": JSON.stringify({ id, name: `${brief.name} — Reel` }, null, 2),
    "README.md": [
      `# ${brief.name} — Instagram Reel`,
      "",
      "Generated by EstateCRM. Requires Node 22+ and FFmpeg.",
      "",
      "1. Download the reel kit from the studio so that `assets/gsap.min.js`, `assets/sfx/*.wav` and `assets/fonts/*.ttf` sit beside this file.",
      ...(options.voiceover
        ? ["   Also save the narration from the studio as `assets/vo.mp3` — the composition has a narration track that expects it."]
        : []),
      "2. `npm run check` — must report 0 findings.",
      "3. `npm run preview` — opens the Studio to scrub the timeline.",
      "4. `npm run render` — writes `reel.mp4` (1080×1920, H.264 + AAC, 30 fps).",
      "",
      "Fonts ship in the kit (IBM Plex Sans, OFL) and are declared with @font-face, so the render is identical on every machine.",
      "",
      "No ElevenLabs key? Kokoro (Apache 2.0) runs on a laptop CPU: `pip install kokoro soundfile` then",
      "`python -m kokoro --text \"$(cat narration.txt)\" --voice am_michael -o assets/vo.wav` and change the src in index.html.",
    ].join("\n"),
  };
}
