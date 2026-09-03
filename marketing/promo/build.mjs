// EstateCRM product promo — builds index.html for HyperFrames from the
// narration timings, so every scene starts exactly where its line does.
//
//   node build.mjs            → index.html (9:16, 1080×1920)
//
// Assets expected under assets/: gsap.min.js, fonts/, shots/, sfx/, vo/, bed.wav

import fs from "node:fs";

const W = 1080, H = 1920;

// ── Meta safe zones ─────────────────────────────────────────────────────────
//
// A Reel is not shown full-bleed: Instagram paints its own chrome over the
// frame. The header sits across the top, and the caption, handle, audio strip
// and Send row occupy a deep band along the bottom, with the like/comment/share
// rail down the right. Anything you place there is simply not read.
//
// Meta's own creative guidance for Reels asks for 254px clear at the top and
// 388px at the bottom on a 1080×1920 frame; these are rounded outward to leave
// a margin, because the chrome grows when a caption wraps to a second line.
// Set SAFE_ZONES=1 when building to draw the boundaries over the render and
// check by eye rather than by arithmetic.
const SAFE = { top: 260, bottom: 430, side: 60, rail: 200 };
const SAFE_BOTTOM_Y = H - SAFE.bottom; // 1490 — nothing readable below this
const SHOW_SAFE = process.env.SAFE_ZONES === "1";
const timings = JSON.parse(fs.readFileSync(new URL("./timings.json", import.meta.url), "utf8"));
const cues = timings.cues;

// --- timeline -----------------------------------------------------------
// Visual scene starts slightly before its line; the last scene holds.
const LEAD = 0.35, GAP = 0.55, FIRST_VO = 0.55, TAIL = 2.4;
let t = FIRST_VO;
const scenes = cues.map((c, i) => {
  const voStart = t;
  const voEnd = t + c.duration;
  t = voEnd + GAP;
  return { id: c.id, text: c.text, voStart, voEnd, start: i === 0 ? 0 : voStart - LEAD };
});
scenes.forEach((s, i) => {
  const next = scenes[i + 1];
  s.end = next ? next.start : s.voEnd + TAIL;
  s.duration = s.end - s.start;
});
const TOTAL = Math.round(scenes[scenes.length - 1].end * 100) / 100;
const f2 = (n) => n.toFixed(2);

// --- palette (matches the app) -------------------------------------------
const C = {
  bg: "#0a0f1c", bg2: "#111a2e", ink: "#f8fafc", muted: "#9aa7bd", faint: "#5b6779",
  blue: "#2f63ff", blueSoft: "#5b86ff", green: "#22c55e", amber: "#f59e0b", red: "#ef4444",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const audio = (id, src, start, dur, track, vol = 1) =>
  `<audio id="${id}" src="${src}" data-start="${f2(start)}" data-duration="${f2(dur)}" data-track-index="${track}" data-volume="${vol}"></audio>`;

// Audio lanes. One lane per sound family; nothing in a lane overlaps.
const L = { bed: 30, vo: 31, riser: 10, swoosh: 11, tick: 12, chime: 13, low: 14, sting: 15 };
const [hook, dash, leads, pipe, inv, cta] = scenes;

const audios = [
  audio("bed", "assets/bed.wav", 0, TOTAL, L.bed, 0.55),
  ...scenes.map((s, i) => audio(`vo-${s.id}`, `assets/vo/${cues[i].file}`, s.voStart, cues[i].duration, L.vo, 1)),
  // hook: three ticks on the three words, then a thud on the question mark
  audio("sfx-tick-1", "assets/sfx/tick.wav", hook.start + 0.20, 0.05, L.tick, 0.8),
  audio("sfx-tick-2", "assets/sfx/tick.wav", hook.start + 0.62, 0.05, L.tick, 0.8),
  audio("sfx-tick-3", "assets/sfx/tick.wav", hook.start + 1.04, 0.05, L.tick, 0.8),
  audio("sfx-thud-hook", "assets/sfx/thud.wav", hook.start + 1.5, 0.45, L.low, 0.9),
  audio("sfx-riser-1", "assets/sfx/riser-long.wav", dash.start - 1.2, 1.6, L.riser, 0.7),
  // dashboard: swoosh on the laptop arrival, chime on the KPI punch-in
  audio("sfx-swoosh-dash", "assets/sfx/swoosh-air.wav", dash.start, 0.55, L.swoosh, 0.9),
  audio("sfx-chime-dash", "assets/sfx/chime-mid.wav", dash.start + 1.25, 1.4, L.chime, 0.7),
  // leads: low swoosh in, clicks as rows light up, blip on the assignment chip
  audio("sfx-swoosh-leads", "assets/sfx/swoosh-low.wav", leads.start, 0.45, L.swoosh, 0.9),
  audio("sfx-click-1", "assets/sfx/click.wav", leads.start + 1.05, 0.09, L.tick, 0.9),
  audio("sfx-click-2", "assets/sfx/click.wav", leads.start + 1.25, 0.09, L.tick, 0.9),
  audio("sfx-click-3", "assets/sfx/click.wav", leads.start + 1.45, 0.09, L.tick, 0.9),
  audio("sfx-blip-leads", "assets/sfx/blip.wav", leads.start + 2.35, 0.18, L.chime, 0.9),
  // pipeline: short riser into the phone flip, blip on the notification
  audio("sfx-riser-2", "assets/sfx/riser-short.wav", pipe.start - 0.6, 0.8, L.riser, 0.7),
  audio("sfx-swoosh-pipe", "assets/sfx/swoosh-air.wav", pipe.start + 0.1, 0.55, L.swoosh, 0.8),
  audio("sfx-blip-pipe", "assets/sfx/blip.wav", pipe.start + 2.1, 0.18, L.chime, 0.9),
  // inventory: three card lands, then a high chime
  audio("sfx-thud-inv-1", "assets/sfx/thud.wav", inv.start + 0.35, 0.45, L.low, 0.6),
  audio("sfx-thud-inv-2", "assets/sfx/thud.wav", inv.start + 0.85, 0.45, L.low, 0.6),
  audio("sfx-thud-inv-3", "assets/sfx/thud.wav", inv.start + 1.35, 0.45, L.low, 0.6),
  audio("sfx-chime-inv", "assets/sfx/chime-high.wav", inv.start + 1.9, 1.4, L.chime, 0.6),
  // cta: sub drop under the wordmark, sting on the button
  audio("sfx-drop-cta", "assets/sfx/drop.wav", cta.start, 1.1, L.low, 0.9),
  audio("sfx-sting-cta", "assets/sfx/sting.wav", cta.start + 1.3, 1.0, L.sting, 0.8),
].join("\n      ");

const caption = (s) => `<div class="caption" id="cap-${s.id}"><span>${esc(s.text)}</span></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EstateCRM — promo</title>
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
      background: radial-gradient(circle, rgba(47,99,255,0.42) 0%, rgba(47,99,255,0) 60%); }
    .clip { position: absolute; inset: 0; width: 100%; height: 100%; }
    .inner { position: absolute; inset: 0; width: 100%; height: 100%; }
    .brand { position: absolute; top: ${SAFE.top}px; left: ${SAFE.side + 24}px; display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 700; }
    .brand .mark { display: block; width: 56px; height: 56px; border-radius: 14px; background: ${C.blue}; }
    .brand .mark::after { content: ""; position: absolute; width: 24px; height: 30px; margin: 13px 16px; border: 4px solid #fff; border-radius: 4px; }
    /* Anchored to the bottom of the safe area and growing upward, so a
       two-line caption stays readable instead of sliding under the chrome. */
    .caption { position: absolute; left: ${SAFE.side + 24}px; right: ${SAFE.side + 24}px;
      bottom: ${SAFE.bottom + 40}px; font-size: 46px; font-weight: 600; line-height: 1.25; color: ${C.ink};
      opacity: 0; }
    /* A backing plate, not a text-shadow: these captions pass over a white
       laptop screen mid-video, where white-on-white measured 1.5:1. The plate
       holds contrast over any scene, and is what a Reel caption looks like
       anyway. */
    .caption span { display: inline; box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      background: rgba(6,10,20,0.82); padding: 10px 18px; border-radius: 10px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.45); }
    .caption b { color: ${C.blueSoft}; font-weight: 600; }

    /* hook */
    .kinetic { position: absolute; left: ${SAFE.side + 24}px; right: ${SAFE.side + 24}px; top: 560px; display: flex; flex-direction: column; gap: 22px; }
    .kinetic .line { display: block; font-size: 112px; font-weight: 700; line-height: 1.0; letter-spacing: -2px; }
    .kinetic .line.dim { color: ${C.muted}; }
    .kinetic .q { display: block; margin-top: 44px; font-size: 64px; font-weight: 600; color: ${C.blueSoft}; }
    .strike { position: absolute; left: 84px; width: 700px; height: 10px; background: ${C.red}; transform-origin: 0 50%; border-radius: 6px; }

    /* devices */
    .laptop { position: absolute; left: 60px; top: 520px; width: 960px; }
    .laptop .lid { display: block; padding: 16px; border-radius: 26px; background: #1f2937; box-shadow: 0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 2px #374151; }
    .laptop .screen { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: #fff; position: relative; }
    .laptop .screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; }
    .laptop .base { display: block; margin: 0 auto; width: 92%; height: 22px; border-radius: 0 0 22px 22px; background: linear-gradient(#374151, #111827); }
    .world { position: absolute; inset: 0; }

    .phone { position: absolute; left: 300px; top: 480px; width: 480px; }
    .phone .body { display: block; padding: 18px; border-radius: 72px; background: #0f172a; box-shadow: 0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 3px #334155; }
    .phone .screen { display: block; width: 100%; aspect-ratio: 390 / 844; border-radius: 54px; overflow: hidden; background: #fff; position: relative; }
    .phone .screen img { display: block; width: 100%; }
    .phone .notch { position: absolute; top: 34px; left: 50%; margin-left: -70px; width: 140px; height: 40px; border-radius: 22px; background: #0f172a; }

    .chip { position: absolute; display: flex; align-items: center; gap: 14px; padding: 18px 26px; border-radius: 18px; background: #fff; color: #0f172a;
      font-size: 30px; font-weight: 600; box-shadow: 0 20px 60px rgba(0,0,0,0.45); }
    .chip .dot { display: block; width: 16px; height: 16px; border-radius: 50%; background: ${C.green}; }
    .chip small { display: block; font-weight: 400; color: #334155; font-size: 24px; }
    .ring { position: absolute; border: 6px solid ${C.blue}; border-radius: 18px; box-shadow: 0 0 0 8px rgba(47,99,255,0.25); }
    .rowlight { position: absolute; background: rgba(47,99,255,0.16); border-left: 8px solid ${C.blue}; }
    .notif { position: absolute; left: 96px; right: 96px; top: 300px; display: flex; gap: 20px; align-items: center; padding: 24px 28px; border-radius: 26px; background: #fff; color: #0f172a; box-shadow: 0 24px 70px rgba(0,0,0,0.5); }
    .notif .icon { display: block; width: 64px; height: 64px; border-radius: 16px; background: ${C.blue}; flex: 0 0 64px; }
    .notif .t { display: block; font-size: 30px; font-weight: 700; }
    .notif .s { display: block; font-size: 26px; color: #334155; margin-top: 4px; }

    /* inventory cards */
    .stack { position: absolute; left: 0; top: 440px; width: ${W}px; height: 1000px; }
    .card { position: absolute; left: 90px; width: 900px; border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 30px 90px rgba(0,0,0,0.55); }
    .card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top left; }
    .card .label { position: absolute; left: 22px; top: 22px; padding: 12px 20px; border-radius: 12px; background: #0f172a; color: #fff; font-size: 28px; font-weight: 600; }
    #card-inv { top: 0; } #card-book { top: 200px; } #card-rep { top: 400px; }

    /* cta */
    .end { position: absolute; left: ${SAFE.side + 24}px; right: ${SAFE.side + 24}px; top: 560px; display: flex; flex-direction: column; align-items: flex-start; }
    .end .wordmark { display: flex; align-items: center; gap: 26px; font-size: 104px; font-weight: 700; letter-spacing: -2px; }
    .end .wordmark .mark { display: block; width: 110px; height: 110px; border-radius: 28px; background: ${C.blue}; position: relative; }
    .end .wordmark .mark::after { content: ""; position: absolute; width: 46px; height: 58px; left: 32px; top: 26px; border: 7px solid #fff; border-radius: 8px; }
    .end .tag { display: block; margin-top: 30px; font-size: 52px; color: ${C.muted}; }
    .end .for { display: block; margin-top: 90px; font-size: 34px; letter-spacing: 5px; text-transform: uppercase; color: ${C.blueSoft}; font-weight: 600; }
    .end .btn { display: inline-block; margin-top: 26px; padding: 30px 52px; border-radius: 22px; background: ${C.blue}; color: #fff; font-size: 52px; font-weight: 700; }
    .end .note { display: block; margin-top: 24px; font-size: 32px; color: ${C.muted}; }
    /* Build-time overlay: the boundaries Instagram's chrome will cover. */
    .safe-guide { position: absolute; inset: 0; pointer-events: none; z-index: 999; }
    .safe-guide i { position: absolute; left: 0; right: 0; background: rgba(239,68,68,0.28); }
    .safe-guide i.top { top: 0; height: ${SAFE.top}px; }
    .safe-guide i.bottom { bottom: 0; height: ${SAFE.bottom}px; }
    .safe-guide b { position: absolute; top: 0; bottom: 0; right: 0; width: ${SAFE.rail}px; background: rgba(245,158,11,0.22); }
  </style>
</head>
<body>
  <div id="root" data-composition-id="estatecrm-promo" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
    <div class="bg"></div>
    <div class="grid" id="grid"></div>
    <div class="glow" id="glow"></div>
    ${SHOW_SAFE ? '<div class="safe-guide"><i class="top"></i><i class="bottom"></i><b></b></div>' : ""}
    <div class="brand" id="brand"><span class="mark"></span><span>EstateCRM</span></div>

    <!-- 1 · hook -->
    <section id="s-hook" class="clip" data-start="${f2(hook.start)}" data-duration="${f2(hook.duration)}" data-track-index="1">
      <div id="hook-inner" class="inner">
        <div class="kinetic">
          <span class="line dim" id="k1">WhatsApp forwards.</span>
          <span class="line dim" id="k2">One spreadsheet.</span>
          <span class="line" id="k3">Missed follow-ups.</span>
          <span class="q" id="k4">Still running sales like this?</span>
        </div>
        <span class="strike" id="strike" style="top: 880px;"></span>
      </div>
    </section>

    <!-- 2 · dashboard -->
    <section id="s-dash" class="clip" data-start="${f2(dash.start)}" data-duration="${f2(dash.duration)}" data-track-index="1">
      <div id="dash-inner" class="inner">
        <div class="world" id="dash-world">
          <div class="laptop" id="dash-laptop">
            <span class="lid"><span class="screen"><img src="assets/shots/dashboard.png" alt="" /><span class="ring" id="dash-ring" style="left: 63.5%; top: 18.5%; width: 12.5%; height: 14%;"></span></span></span>
            <span class="base"></span>
          </div>
        </div>
        <div class="chip" id="dash-chip" style="left: 540px; top: 1120px;"><span class="dot"></span><span>Pipeline ₹7.23 Cr<small>live, right now</small></span></div>
      </div>
    </section>

    <!-- 3 · leads -->
    <section id="s-leads" class="clip" data-start="${f2(leads.start)}" data-duration="${f2(leads.duration)}" data-track-index="1">
      <div id="leads-inner" class="inner">
        <div class="world" id="leads-world">
          <div class="laptop" id="leads-laptop">
            <span class="lid"><span class="screen"><img src="assets/shots/leads.png" alt="" />
              <span class="rowlight" id="row-1" style="left: 21%; top: 53.5%; width: 76%; height: 6.6%;"></span>
              <span class="rowlight" id="row-2" style="left: 21%; top: 60.2%; width: 76%; height: 6.6%;"></span>
              <span class="rowlight" id="row-3" style="left: 21%; top: 67%; width: 76%; height: 6.6%;"></span>
            </span></span>
            <span class="base"></span>
          </div>
        </div>
        <div class="chip" id="leads-chip" style="left: 470px; top: 1090px;"><span class="dot"></span><span>Assigned to Rohan Kapoor<small>Instagram lead · 4 seconds</small></span></div>
      </div>
    </section>

    <!-- 4 · pipeline on a phone -->
    <section id="s-pipe" class="clip" data-start="${f2(pipe.start)}" data-duration="${f2(pipe.duration)}" data-track-index="1">
      <div id="pipe-inner" class="inner">
        <div class="phone" id="phone">
          <span class="body"><span class="screen"><img src="assets/shots/m-pipeline.png" alt="" id="phone-img" /><span class="notch"></span></span></span>
        </div>
        <div class="notif" id="notif"><span class="icon"></span><span><span class="t">Follow-up due · Vikram Rao</span><span class="s">Site visit tomorrow 10:30 · SYL</span></span></div>
      </div>
    </section>

    <!-- 5 · inventory, bookings, reports -->
    <section id="s-inv" class="clip" data-start="${f2(inv.start)}" data-duration="${f2(inv.duration)}" data-track-index="1">
      <div id="inv-inner" class="inner">
        <div class="stack">
          <div class="card" id="card-inv"><img src="assets/shots/inventory.png" alt="" /><span class="label">Inventory</span></div>
          <div class="card" id="card-book"><img src="assets/shots/bookings.png" alt="" /><span class="label">Bookings</span></div>
          <div class="card" id="card-rep"><img src="assets/shots/reports.png" alt="" /><span class="label">Reports</span></div>
        </div>
      </div>
    </section>

    <!-- 6 · end card -->
    <section id="s-cta" class="clip" data-start="${f2(cta.start)}" data-duration="${f2(cta.duration)}" data-track-index="1">
      <div id="cta-inner" class="inner">
        <div class="end">
          <div class="wordmark" id="wm"><span class="mark"></span><span>EstateCRM</span></div>
          <span class="tag" id="tag">Built for Indian real estate.</span>
          <span class="for" id="for">For developers &amp; channel partners</span>
          <span class="btn" id="btn">Book a demo</span>
          <span class="note" id="note">Link in bio · 20 minutes · your own data</span>
        </div>
      </div>
    </section>

    <!-- captions (silent viewers) -->
    ${scenes.map(caption).join("\n    ")}

    ${audios}
  </div>

  <script>
    const tl = gsap.timeline({ paused: true });
    const T = ${JSON.stringify(Object.fromEntries(scenes.map((s) => [s.id, { start: +f2(s.start), end: +f2(s.end), vo: +f2(s.voStart), voEnd: +f2(s.voEnd) }])))};
    T.dash = T.dashboard; T.pipe = T.pipeline; T.inv = T.inventory;
    const up = { y: 60, opacity: 0 }, settle = { y: 0, opacity: 1, ease: "power3.out" };
    const exit = (sel, at) => { tl.to(sel, { opacity: 0, duration: 0.28, ease: "power1.in" }, at - 0.28); tl.set(sel, { opacity: 0 }, at); };

    // ambient: glow drifts once across the whole piece; brand mark fades in after the hook
    tl.fromTo("#glow", { x: 0, y: 0 }, { x: 260, y: 420, duration: ${TOTAL}, ease: "sine.inOut" }, 0);
    tl.fromTo("#brand", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, T.dash.start + 0.1);
    tl.to("#brand", { opacity: 0, duration: 0.3 }, T.cta.start);

    // captions: each shows for its line
    for (const id of Object.keys(T)) {
      tl.fromTo("#cap-" + id, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, T[id].vo - 0.1);
      tl.to("#cap-" + id, { opacity: 0, duration: 0.25 }, T[id].voEnd + 0.35);
    }

    // 1 · hook — three slams, a strike-through, the question
    tl.fromTo("#k1", { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: "power4.out" }, T.hook.start + 0.20);
    tl.fromTo("#k2", { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: "power4.out" }, T.hook.start + 0.62);
    tl.fromTo("#k3", { scale: 1.25, opacity: 0, transformOrigin: "0 50%" }, { scale: 1, opacity: 1, duration: 0.36, ease: "power4.out" }, T.hook.start + 1.04);
    tl.fromTo("#strike", { scaleX: 0 }, { scaleX: 1, duration: 0.34, ease: "power3.inOut" }, T.hook.start + 1.5);
    tl.fromTo("#k4", up, { ...settle, duration: 0.5 }, T.hook.start + 1.9);
    exit("#hook-inner", T.hook.end);

    // 2 · dashboard — laptop rises, camera pushes into the KPI row, ring + chip
    tl.fromTo("#dash-laptop", { y: 220, opacity: 0, scale: 0.94, transformOrigin: "50% 50%" }, { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, T.dash.start + 0.05);
    tl.fromTo("#dash-world", { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" }, { scale: 1.32, x: -40, y: 250, duration: 1.1, ease: "power2.inOut" }, T.dash.start + 1.1);
    tl.fromTo("#dash-ring", { opacity: 0, scale: 1.3, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, T.dash.start + 1.9);
    tl.fromTo("#dash-chip", { y: 40, opacity: 0, scale: 0.9, transformOrigin: "0 50%" }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, T.dash.start + 2.2);
    exit("#dash-inner", T.dash.end);

    // 3 · leads — slide in from the right, rows light up in sequence, assignment chip
    tl.fromTo("#leads-laptop", { x: 320, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, T.leads.start + 0.05);
    tl.fromTo("#leads-world", { scale: 1, x: 0, y: 0, transformOrigin: "50% 50%" }, { scale: 1.45, x: -120, y: -260, duration: 1.0, ease: "power2.inOut" }, T.leads.start + 0.55);
    tl.fromTo("#row-1", { opacity: 0 }, { opacity: 1, duration: 0.12 }, T.leads.start + 1.05);
    tl.fromTo("#row-2", { opacity: 0 }, { opacity: 1, duration: 0.12 }, T.leads.start + 1.25);
    tl.fromTo("#row-3", { opacity: 0 }, { opacity: 1, duration: 0.12 }, T.leads.start + 1.45);
    tl.fromTo("#leads-chip", { y: 40, opacity: 0, scale: 0.9, transformOrigin: "0 50%" }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, T.leads.start + 2.3);
    exit("#leads-inner", T.leads.end);

    // 4 · pipeline — phone flips in with perspective, content scrolls, notification drops
    tl.fromTo("#phone", { rotationY: -38, x: 160, opacity: 0, transformPerspective: 1600, transformOrigin: "50% 50%" }, { rotationY: -8, x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, T.pipe.start + 0.1);
    tl.fromTo("#phone", { rotationY: -8 }, { rotationY: 6, duration: ${f2(pipe.duration - 1.0)}, ease: "sine.inOut", immediateRender: false }, T.pipe.start + 0.9);
    tl.fromTo("#phone-img", { y: 0 }, { y: -520, duration: ${f2(pipe.duration - 1.4)}, ease: "power1.inOut" }, T.pipe.start + 1.0);
    tl.fromTo("#notif", { y: -180, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.4)" }, T.pipe.start + 2.05);
    exit("#pipe-inner", T.pipe.end);

    // 5 · inventory — three cards land in a cascade, the stack settles back
    tl.fromTo("#card-inv", { y: 260, opacity: 0, rotation: -3, transformOrigin: "50% 100%" }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, ease: "power3.out" }, T.inv.start + 0.3);
    tl.fromTo("#card-book", { y: 260, opacity: 0, rotation: 3, transformOrigin: "50% 100%" }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, ease: "power3.out" }, T.inv.start + 0.8);
    tl.fromTo("#card-rep", { y: 260, opacity: 0, rotation: -2, transformOrigin: "50% 100%" }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, ease: "power3.out" }, T.inv.start + 1.3);
    tl.fromTo(".stack", { y: 0 }, { y: -90, duration: 1.4, ease: "sine.inOut" }, T.inv.start + 1.9);
    exit("#inv-inner", T.inv.end);

    // 6 · end card — wordmark drops with the sub, button springs on the sting
    tl.fromTo("#wm", { y: -60, opacity: 0, scale: 1.08, transformOrigin: "0 50%" }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "power4.out" }, T.cta.start + 0.05);
    tl.fromTo("#tag", up, { ...settle, duration: 0.5 }, T.cta.start + 0.45);
    tl.fromTo("#for", up, { ...settle, duration: 0.45 }, T.cta.start + 0.95);
    tl.fromTo("#btn", { scale: 0.7, opacity: 0, transformOrigin: "0 50%" }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }, T.cta.start + 1.3);
    tl.fromTo("#note", up, { ...settle, duration: 0.45 }, T.cta.start + 1.7);

    window.__timelines["estatecrm-promo"] = tl;
  </script>
</body>
</html>
`;

fs.writeFileSync(new URL("./index.html", import.meta.url), html);
console.log(`index.html · ${TOTAL}s · scenes:`, scenes.map((s) => `${s.id}@${f2(s.start)}`).join(" "));
console.log(`safe area: y ${SAFE.top}–${SAFE_BOTTOM_Y} of ${H}${SHOW_SAFE ? " · guides ON" : ""}`);
