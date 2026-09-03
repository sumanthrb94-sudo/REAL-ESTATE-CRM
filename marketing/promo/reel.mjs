// Build one Reel from a spec in reels/.
//
//   REEL=speed-to-lead node reel.mjs     → index.html (1080×1920)
//
// build.mjs is the flagship product ad, hand-composed scene by scene. This is
// the engine behind the campaign around it: a reel is a JSON spec — a hook,
// five scenes, a call to action — and everything else is derived. Narration
// length sets scene length, the palette sets the colour, and the highlight is
// placed from a measured box rather than a typed percentage.
//
// Why measured: the flagship's ring sat at "left: 63.5%", which put it 76px
// right of the tile it meant to circle and 60px into the tile next door, so it
// covered a number it was supposed to be drawing attention to. Percentages
// cannot be reviewed, only re-eyeballed. hotspots.mjs asks the running app
// where its elements actually are; this file looks them up by name and then
// ASSERTS that the ring lands inside its own element and touches nothing else.
// A collision fails the build instead of shipping.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REEL = process.env.REEL;
if (!REEL) throw new Error("Set REEL=<id>. Specs live in reels/.");

const spec = JSON.parse(fs.readFileSync(path.join(here, `reels/${REEL}.json`), "utf8"));
const timings = JSON.parse(fs.readFileSync(path.join(here, `reels/${REEL}.timings.json`), "utf8"));
const hotspots = JSON.parse(fs.readFileSync(path.join(here, "hotspots.json"), "utf8"));

// ── Subtitle timing (mirrors src/server/content/subtitles.ts) ───────────────
const syllables = (word) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  const groups = (w.match(/[aeiouy]+/g) ?? ["x"]).length;
  const silentE = /[^aeiouy]e$/.test(w) && groups > 1 ? 1 : 0;
  return Math.max(1, groups - silentE);
};
const pause = (w) => (/[.!?]$/.test(w) ? 1.6 : /[,;:]$/.test(w) ? 0.9 : 0);

function planSubtitles(text, start, duration, maxWords = 4, maxChars = 26) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || duration <= 0) return [];
  const weights = words.map((w) => syllables(w) + pause(w));
  const total = weights.reduce((a, b) => a + b, 0);
  const timed = [];
  let cursor = start;
  words.forEach((word, i) => {
    const end = i === words.length - 1 ? start + duration : cursor + (weights[i] / total) * duration;
    timed.push({ text: word, start: cursor, end });
    cursor = end;
  });
  const chunks = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    chunks.push({ words: current, start: current[0].start, end: current[current.length - 1].end });
    current = [];
  };
  for (const w of timed) {
    const would = [...current, w];
    if (current.length && (would.length > maxWords || would.map((x) => x.text).join(" ").length > maxChars)) flush();
    current.push(w);
    if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  return chunks;
}

// ── Frame and safe area ─────────────────────────────────────────────────────
// Reels only. Instagram paints its header over the top of the frame and its
// caption, handle, audio strip and Send row over a deep band at the bottom,
// with the like/share rail down the right. Anything placed there is not read.
const W = 1080, H = 1920;
const SAFE = { top: 260, bottom: 430, side: 60, rail: 200 };
const SAFE_BOTTOM_Y = H - SAFE.bottom;
const SHOW_SAFE = process.env.SAFE_ZONES === "1";

// ── Palette ─────────────────────────────────────────────────────────────────
// Five reels running in one campaign should not look like five copies of the
// same file. Only the accent and the ground move; the type, spacing and device
// treatment stay fixed, so the set reads as a family rather than a jumble.
const PALETTES = {
  cobalt: { bg: "#0a0f1c", bg2: "#111a2e", key: "#2f63ff", soft: "#5b86ff", glow: "47,99,255" },
  ink:    { bg: "#0b1020", bg2: "#16203a", key: "#4f46e5", soft: "#8b8bf5", glow: "79,70,229" },
  ember:  { bg: "#140d0a", bg2: "#2a1710", key: "#f97316", soft: "#fdba74", glow: "249,115,22" },
  teal:   { bg: "#04141a", bg2: "#0b2b33", key: "#14b8a6", soft: "#5eead4", glow: "20,184,166" },
  violet: { bg: "#0d0a1a", bg2: "#1e1633", key: "#8b5cf6", soft: "#c4b5fd", glow: "139,92,246" },
};
// The hook is set to fit on one line each, not to a fixed size. The strike-
// through is centred on the line it crosses out, so a line that wraps puts the
// strike in the gap between its two halves rather than through any words — the
// copy changes per reel, so the type has to follow it rather than the other
// way round.
const HOOK_WIDTH = 1080 - (60 + 24) * 2;
const HOOK_EM = 0.5;                 // widest average glyph in IBM Plex Bold
function hookSize(lines) {
  const longest = Math.max(...lines.map((l) => l.length));
  const fit = Math.floor(HOOK_WIDTH / (longest * HOOK_EM));
  if (fit < 68) console.warn(`  ! hook line of ${longest} chars needs ${fit}px type; shorten it.`);
  return Math.min(104, fit);
}

const P = PALETTES[spec.palette] ?? PALETTES.cobalt;

// White on the accent is only legible for the dark accents. Teal at #14b8a6
// gives white 2.49:1, well under the 3:1 a button needs, so the label colour is
// computed from the accent's own luminance rather than assumed — otherwise
// adding a lighter palette later silently ships an unreadable call to action.
function readableOn(hex) {
  const ch = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
  const onWhite = 1.05 / (lum + 0.05);
  const onBlack = (lum + 0.05) / 0.05;
  return onWhite >= onBlack ? "#ffffff" : "#0b0f18";
}
const C = { ...P, onKey: readableOn(P.key), ink: "#f8fafc", muted: "#9aa7bd", faint: "#5b6779", green: "#22c55e", red: "#ef4444" };

// ── Timeline ────────────────────────────────────────────────────────────────
// Scene length follows the read: the visual starts a beat before its line and
// runs until the next one begins, so a longer sentence makes a longer scene
// rather than being crammed into a slot someone guessed at.
const cues = timings.cues;
const LEAD = 0.35, GAP = 0.55, FIRST_VO = 0.55, TAIL = 2.4;
let t = FIRST_VO;
const beats = cues.map((c, i) => {
  const voStart = t, voEnd = t + c.duration;
  t = voEnd + GAP;
  return { id: c.id, text: c.text, voStart, voEnd, start: i === 0 ? 0 : voStart - LEAD, cue: c };
});
beats.forEach((b, i) => {
  b.end = beats[i + 1] ? beats[i + 1].start : b.voEnd + TAIL;
  b.duration = b.end - b.start;
});
const TOTAL = Math.round(beats[beats.length - 1].end * 100) / 100;
const f2 = (n) => n.toFixed(2);
const [hookBeat, ...rest] = beats;
const ctaBeat = rest.pop();
const sceneBeats = rest;
if (sceneBeats.length !== spec.scenes.length) {
  throw new Error(`${REEL}: ${spec.scenes.length} scenes in the spec but ${sceneBeats.length} narrated.`);
}

// ── Hotspots ────────────────────────────────────────────────────────────────
//
// A spec names its highlight in English ("the Pipeline Value KPI card"). Match
// that against the labels measured on that screen: the best-scoring label wins,
// and if nothing scores well enough the scene simply runs without a ring. A
// missing highlight is a small loss; a ring around the wrong thing is the bug
// this whole file exists to prevent, so the tie is broken toward drawing none.
const STOP = new Set(["the", "a", "an", "of", "on", "in", "at", "for", "and", "to", "with", "its",
  "card", "tile", "column", "button", "table", "chart", "row", "list", "kpi", "stat", "panel",
  "where", "every", "each", "that", "this", "top", "first", "above", "against", "sits", "already"]);
const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

// A label that is really a row of data — a name from the lead table, a funnel
// row, anything carrying its own numbers — moves the moment the data does, so a
// ring pinned to one is correct for exactly as long as nobody adds a lead. Only
// structural furniture is allowed to hold a highlight.
const isDataRow = (label) => /\t/.test(label) || /\d{4,}$/.test(label) || /\d+%/.test(label);

function findHotspot(shot, focus, exact) {
  const page = hotspots[shot];
  if (!page) return null;

  // A spec may name the measured label outright. That is the reviewable form:
  // it either exists on that screen or the build stops, with no scoring in
  // between deciding what the author probably meant.
  if (exact) {
    const entry = page[exact];
    if (!entry) {
      throw new Error(`${REEL}: "${exact}" is not a measured element on ${shot}. ` +
        `Measured: ${Object.keys(page).filter((l) => !isDataRow(l)).join(", ")}`);
    }
    return { label: exact, box: entry.block ?? entry.box, score: 1, exact: true };
  }

  if (!focus) return null;
  const want = words(focus);
  if (!want.length) return null;

  let best = null;
  for (const [label, entry] of Object.entries(page)) {
    if (isDataRow(label)) continue;
    const have = words(label);
    if (!have.length) continue;
    const hit = have.filter((w) => want.includes(w)).length;
    if (!hit) continue;
    // Reward covering the label fully; a one-word brush against a long label is
    // usually a coincidence, not a match.
    const score = hit / have.length + hit / want.length;
    if (!best || score > best.score) best = { label, entry, score };
  }
  // Both halves of the score must be strong: the label has to be mostly covered
  // by the request AND the request mostly satisfied by the label. "the New
  // Booking button" once matched "Booking Value" on one shared word, which is
  // exactly the confidently-wrong ring this file exists to stop.
  if (!best || best.score < 1.4) return null;
  // A ring around a titled panel should enclose the panel, not its heading.
  const box = /chart|table|graph|panel|list|leaderboard|funnel|queue/i.test(focus)
    ? best.entry.block ?? best.entry.box
    : best.entry.box;
  return { label: best.label, box, score: best.score, all: page };
}

// Does this ring, glow included, stay off every other measured element?
//
// Measured as the share of the OTHER element that the ring covers, because that
// is the actual complaint: the shipped ring hid 26% of the Available Units tile,
// so the number it was drawing attention to could not be read. A few per cent is
// the glow feathering onto a sibling inside the same card and reads as design;
// a sixth of an element is covering it up.
const RING_INSET = 0.006;   // fraction of the shot, per side
const RING_BLEED = 0.005;   // border plus outer glow, in shot fractions
const MAX_COVER = 0.15;     // of a neighbour's own area

function ringGeometry(spot, shot) {
  const [x, y, w, h] = spot.box;
  const box = [x + w * RING_INSET, y + h * RING_INSET, w * (1 - RING_INSET * 2), h * (1 - RING_INSET * 2)];
  const bled = [box[0] - RING_BLEED, box[1] - RING_BLEED, box[2] + RING_BLEED * 2, box[3] + RING_BLEED * 2];

  const hits = [];
  for (const [label, entry] of Object.entries(hotspots[shot])) {
    if (label === spot.label) continue;
    const o = entry.box;
    // Ignore anything that contains the target (a wrapper) or sits inside it.
    const inside = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 &&
      a[0] + a[2] <= b[0] + b[2] + 1e-6 && a[1] + a[3] <= b[1] + b[3] + 1e-6;
    if (inside(spot.box, o) || inside(o, spot.box)) continue;
    const ox = Math.max(0, Math.min(bled[0] + bled[2], o[0] + o[2]) - Math.max(bled[0], o[0]));
    const oy = Math.max(0, Math.min(bled[1] + bled[3], o[1] + o[3]) - Math.max(bled[1], o[1]));
    const cover = (ox * oy) / (o[2] * o[3]);
    if (cover > MAX_COVER) hits.push(`${(cover * 100).toFixed(0)}% of "${label}"`);
  }
  return { box, hits };
}

// ── Resolve every scene before writing a byte ───────────────────────────────
const MOBILE = (shot) => shot.startsWith("m-");
const report = [];
const scenes = spec.scenes.map((s, i) => {
  const beat = sceneBeats[i];
  const spot = findHotspot(s.shot, s.focus, s.hotspot);
  let ring = null;
  if (spot) {
    const { box, hits } = ringGeometry(spot, s.shot);
    if (hits.length) {
      throw new Error(
        `${REEL}/${s.id}: a ring on "${spot.label}" would cover ${hits.join(" and ")} ` +
        `on ${s.shot}. Pin a different element, or re-measure with hotspots.mjs.`);
    }
    ring = box;
  }
  report.push(`  ${s.id.padEnd(18)} ${s.shot.padEnd(15)} ${
    ring ? `ring → ${spot.label}${spot.exact ? "" : `  (matched from "${s.focus}")`}`
         : s.focus ? `NO RING — nothing on ${s.shot} matches "${s.focus}"` : "no ring"}`);
  return { ...s, beat, ring, mobile: MOBILE(s.shot), n: i };
});

// ── Stage geometry ──────────────────────────────────────────────────────────
// The device sits between the two safe bands, and the subtitle band sits under
// it. Everything below is derived from those two numbers, so nothing can be
// nudged into the chrome by hand later.
const SUB_BOTTOM = SAFE.bottom + Math.round(H * 0.02);   // 468 — clear of the caption
const SUB_TOP = H - SUB_BOTTOM - 190;                    // room for two lines
const STAGE_TOP = SAFE.top + 130;                        // under the brand mark

// Both devices are sized to finish above the subtitles rather than to a round
// number. A 480-wide phone is 1075px tall, which put its lower third and its
// callout underneath the caption band — visible in the preview only if you
// happened to scrub to that second.
const DEV = {
  laptop: { w: 960, left: 60, top: 470, pad: 16, base: 22, ratio: 10 / 16 },
  phone: { w: 390, left: Math.round((W - 390) / 2), top: 345, pad: 18, base: 0, ratio: 844 / 390 },
};
const screenRect = (mobile) => {
  const d = mobile ? DEV.phone : DEV.laptop;
  const w = d.w - d.pad * 2;
  return { top: d.top + d.pad, left: d.left + d.pad, w, h: Math.round(w * d.ratio) };
};
const deviceBottom = (mobile) => {
  const d = mobile ? DEV.phone : DEV.laptop;
  const r = screenRect(mobile);
  return r.top + r.h + d.pad + d.base;
};

// A chip is a floating callout, and it has two things it must never sit on: the
// subtitles, which is text over text, and the ring, which is the whole point of
// the shot. So it takes the low position by default — tucked just above the
// caption band — and moves above the device when the highlight is down in that
// half. Both are computed from the ring's real position, not chosen by eye.
const CHIP_H = 150;
function chipTop(mobile, ring) {
  const low = SUB_TOP - CHIP_H - 40;
  if (!ring) return low;
  const r = screenRect(mobile);
  const ringTop = r.top + ring[1] * r.h;
  const ringBottom = r.top + (ring[1] + ring[3]) * r.h;
  const clash = ringBottom > low - 30 && ringTop < low + CHIP_H + 30;
  if (!clash) return low;
  // Above the device, still under the brand mark.
  const high = Math.max(STAGE_TOP, Math.round(ringTop - CHIP_H - 60));
  return Math.min(high, low);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Sound ───────────────────────────────────────────────────────────────────
// Each spec names its own per-scene effect, so two reels in the same campaign
// do not land on the same hit in the same place.
const SFX = {
  whoosh: ["swoosh-air.wav", 0.55, 0.9], tick: ["tick.wav", 0.09, 0.9],
  pop: ["blip.wav", 0.18, 0.9], chime: ["chime-high.wav", 1.2, 0.7],
  thud: ["thud.wav", 0.45, 0.9], riser: ["riser-short.wav", 0.8, 0.7],
  click: ["click.wav", 0.09, 0.9], swell: ["riser-long.wav", 1.6, 0.6],
};
const L = { bed: 30, vo: 31, hit: 10, accent: 11, low: 12 };
const audio = (id, src, start, dur, track, vol = 1) =>
  `<audio id="${id}" src="${src}" data-start="${f2(Math.max(0, start))}" data-duration="${f2(dur)}" data-track-index="${track}" data-volume="${vol}"></audio>`;

const audios = [
  audio("bed", `assets/bed-${REEL}.wav`, 0, TOTAL, L.bed, 0.55),
  ...beats.map((b) => audio(`vo-${b.id}`, `assets/vo/${REEL}/${b.cue.file}`, b.voStart, b.cue.duration, L.vo, 1)),
  audio("sfx-hook-1", "assets/sfx/tick.wav", hookBeat.start + 0.20, 0.05, L.hit, 0.8),
  audio("sfx-hook-2", "assets/sfx/tick.wav", hookBeat.start + 0.62, 0.05, L.hit, 0.8),
  audio("sfx-hook-3", "assets/sfx/tick.wav", hookBeat.start + 1.04, 0.05, L.hit, 0.8),
  audio("sfx-hook-strike", "assets/sfx/thud.wav", hookBeat.start + 1.5, 0.45, L.low, 0.9),
  ...scenes.flatMap((s) => {
    const [file, dur, vol] = SFX[s.sfx] ?? SFX.tick;
    return [
      audio(`sfx-in-${s.id}`, `assets/sfx/${file}`, s.beat.start + 0.1, dur, L.hit, vol),
      s.ring ? audio(`sfx-ring-${s.id}`, "assets/sfx/blip.wav", s.beat.start + 1.9, 0.18, L.accent, 0.85) : "",
    ].filter(Boolean);
  }),
  audio("sfx-cta-drop", "assets/sfx/drop.wav", ctaBeat.start, 1.1, L.low, 0.9),
  audio("sfx-cta-sting", "assets/sfx/sting.wav", ctaBeat.start + 1.3, 1.0, L.accent, 0.8),
].join("\n      ");

// ── Subtitles ───────────────────────────────────────────────────────────────
// Every chunk is written up front and revealed on its own window: a frame has
// to be a pure function of time, so nothing may be created while it runs.
const subtitles = beats.flatMap((b) =>
  planSubtitles(b.text, b.voStart, b.cue.duration).map((chunk, ci) => ({
    ...chunk, id: `sub-${b.id}-${ci}`,
    words: chunk.words.map((w, wi) => ({ ...w, id: `sub-${b.id}-${ci}-${wi}` })),
  })));

const subtitleHtml = subtitles
  .map((c) => `<div class="sub" id="${c.id}"><b>${c.words
    .map((w) => `<span id="${w.id}">${esc(w.text)}</span>`).join(" ")}</b></div>`)
  .join("\n      ");

// ── Markup ──────────────────────────────────────────────────────────────────
const device = (s) => s.mobile
  ? `<div class="phone" id="dev-${s.id}"><span class="body"><span class="screen">
        <img src="assets/shots/${s.shot}.png" alt="" />
        ${s.ring ? `<span class="ring" id="ring-${s.id}" style="left:${(s.ring[0] * 100).toFixed(2)}%; top:${(s.ring[1] * 100).toFixed(2)}%; width:${(s.ring[2] * 100).toFixed(2)}%; height:${(s.ring[3] * 100).toFixed(2)}%;"></span>` : ""}
      </span></span></div>`
  : `<div class="laptop" id="dev-${s.id}"><span class="lid"><span class="screen">
        <img src="assets/shots/${s.shot}.png" alt="" />
        ${s.ring ? `<span class="ring" id="ring-${s.id}" style="left:${(s.ring[0] * 100).toFixed(2)}%; top:${(s.ring[1] * 100).toFixed(2)}%; width:${(s.ring[2] * 100).toFixed(2)}%; height:${(s.ring[3] * 100).toFixed(2)}%;"></span>` : ""}
      </span></span><span class="base"></span></div>`;

const sceneHtml = scenes.map((s) => `
    <section id="s-${s.id}" class="clip" data-start="${f2(s.beat.start)}" data-duration="${f2(s.beat.duration)}" data-track-index="1">
      <div id="in-${s.id}" class="inner">
        <div class="world" id="world-${s.id}" data-layout-allow-overflow>
          ${device(s)}
        </div>
        <div class="chip" id="chip-${s.id}" style="top:${chipTop(s.mobile, s.ring)}px;">
          <span class="dot"></span><span>${esc(s.chip.title)}<small>${esc(s.chip.sub)}</small></span>
        </div>
      </div>
    </section>`).join("");

const hookLines = spec.hook.lines.map((line, i) => `
          <span class="line${i === spec.hook.lines.length - 1 ? "" : " dim"}" id="k${i}">${esc(line)}${
            i === spec.hook.strikeLine ? `<span class="strike" id="strike"></span>` : ""}</span>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EstateCRM — ${esc(spec.id)}</title>
  <script src="assets/gsap.min.js"></script>
  <style>
    @font-face { font-family: "IBM Plex Sans"; font-weight: 400; src: url("assets/fonts/IBMPlexSans-Regular.ttf"); }
    @font-face { font-family: "IBM Plex Sans"; font-weight: 600; src: url("assets/fonts/IBMPlexSans-SemiBold.ttf"); }
    @font-face { font-family: "IBM Plex Sans"; font-weight: 700; src: url("assets/fonts/IBMPlexSans-Bold.ttf"); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.bg}; }
    #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; color: ${C.ink}; font-family: "IBM Plex Sans", system-ui, sans-serif; }
    .bg { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, ${C.bg2} 0%, ${C.bg} 60%); }
    .grid { position: absolute; inset: 0; opacity: 0.35;
      background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 90px 90px; }
    .glow { position: absolute; width: 1500px; height: 1500px; border-radius: 50%; left: -210px; top: 200px;
      background: radial-gradient(circle, rgba(${C.glow},0.42) 0%, rgba(${C.glow},0) 60%); }
    .clip { position: absolute; inset: 0; width: 100%; height: 100%; }
    .inner, .world { position: absolute; inset: 0; width: 100%; height: 100%; }
    .brand { position: absolute; top: ${SAFE.top}px; left: ${SAFE.side + 24}px; display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 700; }
    .brand .mark { position: relative; display: block; width: 56px; height: 56px; border-radius: 14px; background: ${C.key}; }
    .brand .mark::after { content: ""; position: absolute; width: 22px; height: 28px; left: 17px; top: 14px; border: 4px solid #fff; border-radius: 4px; }

    /* hook */
    .kinetic { position: absolute; left: ${SAFE.side + 24}px; right: ${SAFE.side + 24}px; top: ${Math.round(H * 0.29)}px;
      display: flex; flex-direction: column; align-items: flex-start; gap: 22px; }
    .kinetic .line { position: relative; display: block; font-size: ${hookSize(spec.hook.lines)}px; font-weight: 700; line-height: 1.0; letter-spacing: -2px; white-space: nowrap; }
    .kinetic .line.dim { color: ${C.muted}; }
    .kinetic .q { display: block; margin-top: 44px; font-size: 60px; font-weight: 600; color: ${C.soft}; }
    /* Centred on the line it crosses out rather than a tuned offset, so it
       cannot drift onto the wrong line when the copy changes length. */
    .strike { position: absolute; left: 0; right: 0; top: calc(50% - 5px); height: 10px; background: ${C.red};
      transform-origin: 0 50%; border-radius: 6px; }

    /* devices */
    .laptop { position: absolute; left: ${DEV.laptop.left}px; top: ${DEV.laptop.top}px; width: ${DEV.laptop.w}px; }
    .laptop .lid { display: block; padding: 16px; border-radius: 26px; background: #1f2937; box-shadow: 0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 2px #374151; }
    .laptop .screen { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: #fff; position: relative; }
    .laptop .base { display: block; margin: 0 auto; width: 92%; height: 22px; border-radius: 0 0 22px 22px; background: linear-gradient(#374151, #111827); }
    .phone { position: absolute; left: ${DEV.phone.left}px; top: ${DEV.phone.top}px; width: ${DEV.phone.w}px; }
    .phone .body { display: block; padding: 18px; border-radius: 74px; background: #0f172a; box-shadow: 0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 3px #334155; }
    .phone .screen { display: block; position: relative; width: 100%; aspect-ratio: 390 / 844; border-radius: 56px; overflow: hidden; background: #fff; }
    .screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; }

    /* The highlight. Inset inside the element it marks, so the border and its
       glow live within that element's own box and cannot reach the next one. */
    .ring { position: absolute; border: 6px solid ${C.key}; border-radius: 16px; box-shadow: 0 0 0 8px rgba(${C.glow},0.28); }

    .chip { position: absolute; left: ${SAFE.side + 40}px; max-width: ${W - SAFE.side * 2 - 80 - SAFE.rail}px;
      display: flex; align-items: center; gap: 20px; padding: 26px 34px; border-radius: 22px; background: #fff; color: #0f172a;
      font-size: 38px; font-weight: 700; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
    .chip .dot { flex: 0 0 20px; width: 20px; height: 20px; border-radius: 50%; background: ${C.green}; }
    .chip small { display: block; margin-top: 6px; font-weight: 400; color: #334155; font-size: 28px; }

    /* subtitles */
    .sub { position: absolute; left: ${SAFE.side}px; right: ${SAFE.side}px; bottom: ${SUB_BOTTOM}px; text-align: center; }
    .sub b { display: inline-block; padding: 14px 26px; border-radius: 18px; background: rgba(6,10,20,0.82);
      font-size: 62px; font-weight: 700; line-height: 1.2; letter-spacing: -0.5px; }
    .sub span.on { color: ${C.soft}; }

    /* end card */
    .end { position: absolute; left: ${SAFE.side + 24}px; right: ${SAFE.side + 24}px; top: ${Math.round(H * 0.29)}px; display: flex; flex-direction: column; align-items: flex-start; }
    .end .wordmark { display: flex; align-items: center; gap: 26px; font-size: 104px; font-weight: 700; letter-spacing: -2px; }
    .end .wordmark .mark { position: relative; display: block; width: 96px; height: 96px; border-radius: 24px; background: ${C.key}; }
    .end .wordmark .mark::after { content: ""; position: absolute; width: 38px; height: 48px; left: 29px; top: 24px; border: 7px solid #fff; border-radius: 6px; }
    .end .tag { display: block; margin-top: 30px; font-size: 50px; color: ${C.muted}; }
    .end .for { display: block; margin-top: 90px; font-size: 32px; letter-spacing: 5px; text-transform: uppercase; color: ${C.soft}; font-weight: 600; }
    .end .btn { display: inline-block; margin-top: 26px; padding: 30px 52px; border-radius: 22px; background: ${C.key}; color: ${C.onKey}; font-size: 50px; font-weight: 700; }
    .end .note { display: block; margin-top: 24px; font-size: 30px; color: ${C.muted}; }
    ${SHOW_SAFE ? `.safe-guide i { position: absolute; left: 0; right: 0; background: rgba(239,68,68,0.18); }
    .safe-guide i.top { top: 0; height: ${SAFE.top}px; } .safe-guide i.bottom { bottom: 0; height: ${SAFE.bottom}px; }
    .safe-guide b { position: absolute; right: 0; top: 0; bottom: 0; width: ${SAFE.rail}px; background: rgba(239,68,68,0.12); }` : ""}
  </style>
</head>
<body>
  <div id="root" data-composition-id="reel-${esc(spec.id)}" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
    <div class="bg"></div>
    <div class="grid" id="grid"></div>
    <div class="glow" id="glow"></div>
    ${SHOW_SAFE ? '<div class="safe-guide"><i class="top"></i><i class="bottom"></i><b></b></div>' : ""}
    <div class="brand" id="brand"><span class="mark"></span><span>EstateCRM</span></div>

    <section id="s-hook" class="clip" data-start="${f2(hookBeat.start)}" data-duration="${f2(hookBeat.duration)}" data-track-index="1">
      <div id="in-hook" class="inner">
        <div class="kinetic">${hookLines}
          <span class="q" id="kq">${esc(spec.hook.question)}</span>
        </div>
      </div>
    </section>
${sceneHtml}

    <section id="s-cta" class="clip" data-start="${f2(ctaBeat.start)}" data-duration="${f2(ctaBeat.duration)}" data-track-index="1">
      <div id="in-cta" class="inner">
        <div class="end">
          <span class="wordmark" id="cta-word"><span class="mark"></span><span>EstateCRM</span></span>
          <span class="tag" id="cta-tag">${esc(spec.cta.tag)}</span>
          <span class="for" id="cta-for">${esc(spec.cta.eyebrow)}</span>
          <span class="btn" id="cta-btn">${esc(spec.cta.button)}</span>
          <span class="note" id="cta-note">${esc(spec.cta.note)}</span>
        </div>
      </div>
    </section>

    <div id="subs">
      ${subtitleHtml}
    </div>

    <div id="audio">
      ${audios}
    </div>
  </div>

  <script>
    const tl = gsap.timeline({ paused: true });
    const T = ${JSON.stringify(Object.fromEntries(beats.map((b) => [b.id, { start: +f2(b.start), end: +f2(b.end), vo: +f2(b.voStart) }])))};
    const SCENES = ${JSON.stringify(scenes.map((s) => ({ id: s.id, ring: !!s.ring, mobile: s.mobile, n: s.n })))};
    const SUBS = ${JSON.stringify(subtitles.map((c) => ({
      id: c.id, start: +c.start.toFixed(3), end: +c.end.toFixed(3),
      words: c.words.map((w) => ({ id: w.id, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })),
    })))};

    const up = { y: 44, opacity: 0 };
    const settle = { y: 0, opacity: 1, ease: "power3.out" };
    const exit = (sel, at) => tl.to(sel, { opacity: 0, duration: 0.28, ease: "power2.in" }, at - 0.28);

    // Slow ambient drift, so a still screenshot never sits perfectly still.
    tl.fromTo("#glow", { x: -60, y: 0 }, { x: 80, y: -120, duration: ${TOTAL}, ease: "none" }, 0);
    tl.fromTo("#grid", { y: 0 }, { y: -140, duration: ${TOTAL}, ease: "none" }, 0);

    // Subtitles: the chunk holds its window, the spoken word takes the accent.
    for (const c of SUBS) {
      tl.set("#" + c.id, { opacity: 0 }, 0);
      tl.fromTo("#" + c.id, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, c.start);
      tl.to("#" + c.id, { opacity: 0, duration: 0.1 }, Math.max(c.start + 0.16, c.end - 0.05));
      for (const w of c.words) {
        tl.set("#" + w.id, { color: "${C.soft}" }, w.start);
        tl.set("#" + w.id, { color: "${C.ink}" }, w.end);
      }
    }

    // Hook: the lines slam in, the strike lands, the question settles.
    ${spec.hook.lines.map((_, i) => `tl.fromTo("#k${i}", ${i === spec.hook.lines.length - 1
        ? `{ scale: 1.22, opacity: 0, transformOrigin: "0 50%" }, { scale: 1, opacity: 1, duration: 0.36, ease: "power4.out" }`
        : `{ x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: "power4.out" }`}, T.hook.start + ${(0.20 + i * 0.42).toFixed(2)});`).join("\n    ")}
    tl.fromTo("#strike", { scaleX: 0 }, { scaleX: 1, duration: 0.34, ease: "power3.inOut" }, T.hook.start + 1.5);
    tl.fromTo("#kq", up, { ...settle, duration: 0.5 }, T.hook.start + 1.9);
    exit("#in-hook", T.hook.end);

    // Scenes. The device arrives, the camera eases toward the highlight, the
    // ring lands on it, and the callout follows a beat later. Alternating the
    // arrival direction stops five scenes reading as one repeated move.
    for (const s of SCENES) {
      const t0 = T[s.id].start;
      const dir = s.n % 2 === 0 ? 1 : -1;
      tl.fromTo("#dev-" + s.id,
        { y: 200 * (s.n % 2 === 0 ? 1 : 0.6), x: 60 * dir, opacity: 0, scale: 0.94, transformOrigin: "50% 50%" },
        { y: 0, x: 0, opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, t0 + 0.05);
      tl.fromTo("#world-" + s.id,
        { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" },
        { scale: s.mobile ? 1.18 : 1.3, x: -30 * dir, y: s.mobile ? -120 : 180, duration: 1.15, ease: "power2.inOut" }, t0 + 1.05);
      if (s.ring) {
        tl.fromTo("#ring-" + s.id, { opacity: 0, scale: 1.3, transformOrigin: "50% 50%" },
          { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, t0 + 1.9);
      }
      tl.fromTo("#chip-" + s.id, { y: 40, opacity: 0, scale: 0.94, transformOrigin: "0 50%" },
        { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: "back.out(1.7)" }, t0 + 2.15);
      exit("#in-" + s.id, T[s.id].end);
    }

    // The brand mark holds through the hook and then steps aside: the camera
    // push lifts a phone up into that corner, and a wordmark half-hidden behind
    // a device reads as a mistake. The end card carries it instead.
    tl.to("#brand", { opacity: 0, duration: 0.3 }, T.hook.end - 0.4);
    // The fade lands on a clip boundary, so pin the state after it: a render
    // seeks to each frame independently rather than playing through, and a seek
    // that lands past the tween must not inherit whatever came before it.
    tl.set("#brand", { opacity: 0 }, T.hook.end - 0.1);

    // End card.
    tl.fromTo("#cta-word", { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, T.cta.start + 0.1);
    tl.fromTo("#cta-tag", up, { ...settle, duration: 0.4 }, T.cta.start + 0.45);
    tl.fromTo("#cta-for", up, { ...settle, duration: 0.4 }, T.cta.start + 0.75);
    tl.fromTo("#cta-btn", { scale: 0.7, opacity: 0, transformOrigin: "0 50%" }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.2)" }, T.cta.start + 1.3);
    tl.fromTo("#cta-note", up, { ...settle, duration: 0.4 }, T.cta.start + 1.7);

    window.__timelines["reel-${esc(spec.id)}"] = tl;
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(here, "index.html"), html);
console.log(`${REEL} · ${TOTAL}s · palette ${spec.palette}`);
console.log(report.join("\n"));
