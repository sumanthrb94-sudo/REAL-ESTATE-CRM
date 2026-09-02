// EstateCRM product carousel — five 1080×1350 slides built from the same
// screenshots as the promo video, rendered with headless Chromium so the
// device mockups and typography match the Reel frame for frame.
//
//   EXE=/path/to/chromium node carousel.mjs            → out/carousel-{1..5}.png
//   SIZE=1080x1080 node carousel.mjs                   → square variant

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [W, H] = (process.env.SIZE ?? "1080x1350").split("x").map(Number);
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });

const C = { bg: "#0a0f1c", bg2: "#111a2e", ink: "#f8fafc", muted: "#9aa7bd", blue: "#2f63ff", blueSoft: "#5b86ff", green: "#22c55e", red: "#ef4444" };
// Slides are written to disk and opened as file:// pages so relative asset URLs resolve;
// setContent() runs on about:blank, which cannot load local files.
const shot = (name) => `assets/shots/${name}`;
const font = (w) => `assets/fonts/IBMPlexSans-${w}.ttf`;

const css = `
  @font-face { font-family: "IBM Plex Sans"; font-weight: 400; src: url("${font("Regular")}"); }
  @font-face { font-family: "IBM Plex Sans"; font-weight: 600; src: url("${font("SemiBold")}"); }
  @font-face { font-family: "IBM Plex Sans"; font-weight: 700; src: url("${font("Bold")}"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.bg}; }
  body { position: relative; color: ${C.ink}; font-family: "IBM Plex Sans", system-ui, sans-serif; }
  .bg { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, ${C.bg2} 0%, ${C.bg} 60%); }
  .grid { position: absolute; inset: 0; opacity: 0.35; background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 90px 90px; }
  .glow { position: absolute; width: 1300px; height: 1300px; border-radius: 50%; left: -160px; top: 120px; background: radial-gradient(circle, rgba(47,99,255,0.40) 0%, rgba(47,99,255,0) 60%); }
  .brand { position: absolute; top: 72px; left: 80px; display: flex; align-items: center; gap: 16px; font-size: 36px; font-weight: 700; }
  .brand .mark { position: relative; width: 50px; height: 50px; border-radius: 12px; background: ${C.blue}; }
  .brand .mark::after { content: ""; position: absolute; width: 20px; height: 26px; left: 15px; top: 12px; border: 4px solid #fff; border-radius: 4px; }
  .foot { position: absolute; left: 80px; right: 80px; bottom: 64px; display: flex; justify-content: space-between; align-items: center; font-size: 26px; color: ${C.muted}; }
  .dots { display: flex; gap: 10px; } .dots i { display: block; width: 12px; height: 12px; border-radius: 6px; background: #3b4657; } .dots i.on { width: 34px; background: ${C.blue}; }
  h1 { font-size: 92px; font-weight: 700; line-height: 1.0; letter-spacing: -2px; }
  h1 .dim { color: ${C.muted}; }
  h2 { font-size: 64px; font-weight: 700; line-height: 1.08; letter-spacing: -1px; }
  p.lead { font-size: 36px; line-height: 1.35; color: ${C.muted}; margin-top: 26px; }
  .eyebrow { display: inline-block; font-size: 26px; letter-spacing: 5px; text-transform: uppercase; color: ${C.blueSoft}; font-weight: 600; margin-bottom: 22px; }
  .copy { position: absolute; left: 80px; right: 80px; }
  .laptop { position: absolute; width: 920px; left: 80px; }
  .laptop .lid { padding: 14px; border-radius: 24px; background: #1f2937; box-shadow: 0 40px 100px rgba(0,0,0,0.6), inset 0 0 0 2px #374151; }
  .laptop .screen { position: relative; width: 100%; aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden; background: #fff; }
  .laptop .screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; }
  .laptop .base { margin: 0 auto; width: 92%; height: 20px; border-radius: 0 0 20px 20px; background: linear-gradient(#374151, #111827); }
  .zoom { position: absolute; inset: 0; transform-origin: 0 0; }
  .phone { position: absolute; width: 400px; }
  .phone .body { padding: 16px; border-radius: 62px; background: #0f172a; box-shadow: 0 40px 100px rgba(0,0,0,0.6), inset 0 0 0 3px #334155; }
  .phone .screen { position: relative; width: 100%; aspect-ratio: 390 / 844; border-radius: 46px; overflow: hidden; background: #fff; }
  .phone .screen img { display: block; width: 100%; }
  .chip { position: absolute; display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-radius: 16px; background: #fff; color: #0f172a; font-size: 26px; font-weight: 600; box-shadow: 0 20px 60px rgba(0,0,0,0.45); white-space: nowrap; }
  .chip .dot { width: 14px; height: 14px; border-radius: 50%; background: ${C.green}; }
  .chip small { display: block; font-weight: 400; color: #334155; font-size: 21px; }
  .ring { position: absolute; border: 5px solid ${C.blue}; border-radius: 14px; box-shadow: 0 0 0 7px rgba(47,99,255,0.25); }
  .strike { position: absolute; height: 9px; background: ${C.red}; border-radius: 5px; }
  .btn { display: inline-block; margin-top: 34px; padding: 26px 44px; border-radius: 20px; background: ${C.blue}; color: #fff; font-size: 44px; font-weight: 700; }
  ul.feat { list-style: none; margin-top: 36px; display: flex; flex-direction: column; gap: 18px; font-size: 34px; }
  ul.feat li { display: flex; gap: 18px; align-items: center; } ul.feat li::before { content: ""; width: 14px; height: 14px; border-radius: 50%; background: ${C.blue}; flex: 0 0 14px; }
  ${H > W ? "" : ".laptop { width: 700px; left: 190px; } .phone { width: 280px !important; } h2 { font-size: 56px; } .chip { font-size: 22px; } .chip small { font-size: 18px; }"}
`;

const frame = (i, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="bg"></div><div class="grid"></div><div class="glow"></div>
  <div class="brand"><span class="mark"></span><span>EstateCRM</span></div>
  ${body}
  <div class="foot"><span>Built for Indian real estate</span><span class="dots">${[0, 1, 2, 3, 4].map((k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</span><span>Book a demo · link in bio</span></div>
</body></html>`;

const tall = H > W;
const slides = [
  frame(0, `<div class="copy" style="top: ${tall ? 300 : 230}px;">
      <h1><span class="dim">WhatsApp forwards.</span><br><span class="dim" style="position:relative; display:inline-block;">One spreadsheet.<span class="strike" style="left:0; right:0; top:52%;"></span></span><br>Missed follow-ups.</h1>
      <p class="lead" style="margin-top:44px; color:${C.blueSoft}; font-size: 44px; font-weight:600;">Still running sales like this?</p>
      <p class="lead">Swipe to see how a developer's sales desk runs on EstateCRM.</p>
    </div>`),
  frame(1, `<div class="copy" style="top: 190px;"><span class="eyebrow">01 · One screen</span><h2>Every lead, site visit and booking, live.</h2></div>
    <div class="laptop" style="top: ${tall ? 560 : 470}px;"><div class="lid"><div class="screen"><img src="${shot("dashboard.png")}"><span class="ring" style="left: 63.5%; top: 18.5%; width: 12.5%; height: 14%;"></span></div></div><div class="base"></div></div>
    <div class="chip" style="left: 560px; top: ${tall ? 1040 : 800}px;"><span class="dot"></span><span>Pipeline ₹7.23 Cr<small>updates as your team works</small></span></div>`),
  frame(2, `<div class="copy" style="top: 190px;"><span class="eyebrow">02 · Leads</span><h2>Website, portals and ads land here. Assigned in seconds.</h2></div>
    <div class="laptop" style="top: ${tall ? 600 : 500}px;"><div class="lid"><div class="screen"><img src="${shot("leads.png")}" style="width: 150%; height: auto; margin-left: -18%; margin-top: -44%;">
      <span style="position:absolute; left: 14%; top: 34%; width: 86%; height: 10%; background: rgba(47,99,255,0.16); border-left: 7px solid ${C.blue};"></span></div></div><div class="base"></div></div>
    <div class="chip" style="left: 470px; top: ${tall ? 1010 : 790}px;"><span class="dot"></span><span>Assigned to Rohan Kapoor<small>Instagram lead · 4 seconds · round-robin</small></span></div>`),
  frame(3, `<div class="copy" style="top: 190px;"><span class="eyebrow">03 · On the move</span><h2>The pipeline on any phone, with follow-ups that never slip.</h2></div>
    <div class="phone" style="left: ${tall ? 640 : 700}px; top: ${tall ? 470 : 380}px; width: 340px;"><div class="body"><div class="screen"><img src="${shot("m-pipeline.png")}"></div></div></div>
    <ul class="feat" style="position:absolute; left: 80px; top: ${tall ? 620 : 500}px; width: 480px;"><li>Stages by drag</li><li>Site visits and feedback</li><li>Follow-up reminders</li><li>Call, WhatsApp, email logged</li></ul>`),
  frame(4, `<div class="copy" style="top: ${tall ? 300 : 220}px;"><span class="eyebrow">04 · From the same data</span><h2>Inventory, bookings, reports and marketing creative.</h2>
      <p class="lead">Towers and units with live availability. Bookings with cost sheets. Reports by agent, source and project. Carousels and Reels generated from inventory.</p>
      <span class="btn">Book a 20-minute demo</span></div>`),
];

const browser = await chromium.launch({ executablePath: process.env.EXE || undefined });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (const [i, html] of slides.entries()) {
  const tmp = path.join(here, `.slide-${i + 1}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto(`file://${tmp}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(out, `carousel-${W}x${H}-${i + 1}.png`);
  await page.screenshot({ path: file });
  fs.unlinkSync(tmp);
  console.log(file);
}
await browser.close();
