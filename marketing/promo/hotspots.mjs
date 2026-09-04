// Measure where things actually are on each captured screen.
//
// The promo used to place its highlight rings with hand-tuned percentages
// ("left: 63.5%"), which is guesswork dressed up as a number: the ring around
// the Pipeline Value tile sat 76px to its right and clipped 60px off the
// Available Units tile next door. Percentages cannot be reviewed, only
// re-eyeballed, and every new scene re-rolls the same dice.
//
// So ask the page instead. This walks the rendered DOM, keeps every element
// that is card-shaped or row-shaped, labels it with its own visible text, and
// writes the box as a fraction of the viewport. Screenshots are captured from
// the same viewport, so a fraction here is a fraction of the image, whatever
// resolution it was saved at.
//
//   S=<dir with admin-session.json> EXE=/path/to/chromium node hotspots.mjs
//     → assets/hotspots.json
//
// Boxes are keyed by page and by the element's own label, so a scene asks for
// "dashboard/Pipeline Value" and gets the tile, not a number someone typed.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const S = process.env.S;
const BASE = process.env.BASE ?? "http://localhost:3000";
const session = JSON.parse(fs.readFileSync(`${S}/admin-session.json`, "utf8"));

const DESK = { width: 1440, height: 900 };
const MOB = { width: 390, height: 844 };

const PAGES = [
  ["dashboard", "/dashboard", DESK],
  ["leads", "/leads", DESK],
  ["pipeline", "/pipeline", DESK],
  ["inventory", "/inventory", DESK],
  ["site-visits", "/site-visits", DESK],
  ["bookings", "/bookings", DESK],
  ["reports", "/reports", DESK],
  ["studio", "/marketing/studio", DESK],
  ["marketing", "/marketing", DESK],
  ["import", "/leads/import", DESK],
  // The mapping screen only exists after a file is chosen, so this one is
  // driven rather than visited. Same file shoot-import.mjs uploads.
  ["import-mapping", "/leads/import", DESK, async (page) => {
    await page.setInputFiles('input[type="file"]', `${S}/promo/meta-leads-export.csv`);
    await page.locator('form button[type="submit"]').first().click();
    await page.locator("text=/Column|Map|Preview/i").first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }],
  ["import-preview", "/leads/import", DESK, async (page) => {
    await page.setInputFiles('input[type="file"]', `${S}/promo/meta-leads-export.csv`);
    await page.locator('form button[type="submit"]').first().click();
    await page.locator("text=/What will happen/i").first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.locator("text=/What will happen/i").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(900);
  }],
  ["my-day", "/my-day", DESK],
  ["users", "/settings/users", DESK],
  ["channel-partners", "/channel-partners", DESK],
  ["distribution", "/distribution", DESK],
  ["m-my-day", "/my-day", MOB],
  ["m-leads", "/leads", MOB],
  ["m-dashboard", "/dashboard", MOB],
  ["m-pipeline", "/pipeline", MOB],
  ["m-site-visits", "/site-visits", MOB],
];

// Runs inside the page. Kept dependency-free and self-contained because it is
// serialised across the CDP boundary.
const collect = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = [];
  for (const el of document.querySelectorAll("div, section, article, tr, li, a, button, table")) {
    const r = el.getBoundingClientRect();
    // Card-shaped or row-shaped, on screen, and not the page shell itself.
    if (r.width < 110 || r.height < 40) continue;
    if (r.width > vw * 0.94 && r.height > vh * 0.8) continue;
    if (r.top < -4 || r.left < -4 || r.bottom > vh + 4 || r.right > vw + 4) continue;

    // The label is the element's own first meaningful line. A tile reading
    // "Pipeline Value / 7.23 Cr" is filed under "Pipeline Value"; a table row
    // is filed under the name in its first cell.
    const text = (el.innerText ?? "").trim();
    if (!text) continue;
    const label = text.split("\n").map((s) => s.trim()).filter(Boolean)[0];
    if (!label || label.length > 44) continue;

    out.push({
      label,
      tag: el.tagName.toLowerCase(),
      x: r.left / vw, y: r.top / vh, w: r.width / vw, h: r.height / vh,
      area: (r.width * r.height) / (vw * vh),
    });
  }
  return out;
};

const browser = await chromium.launch({ executablePath: process.env.EXE || undefined });
const result = {};

for (const [name, route, viewport, setup] of PAGES) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 1, colorScheme: "light", isMobile: name.startsWith("m-"),
  });
  await ctx.addCookies(session.cookies.map(({ name: n, value, path: p }) => ({
    name: n, value, domain: "localhost", path: p ?? "/",
  })));
  const page = await ctx.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (setup) await setup(page);

  const boxes = await page.evaluate(collect);
  // Two boxes per label, because "highlight the lead sources" can mean either.
  // The tight box is the smallest element carrying that text — the tile, the
  // heading, the row. The block box is the largest one under two thirds of the
  // screen, which for a titled panel is the whole panel rather than its title
  // bar. A ring around a chart wants the panel; a ring around a KPI tile wants
  // the tile, and for a tile the two boxes are the same.
  const tight = new Map(), block = new Map();
  for (const b of boxes) {
    const t = tight.get(b.label);
    if (!t || b.area < t.area) tight.set(b.label, b);
    if (b.area > 0.66) continue;
    const k = block.get(b.label);
    if (!k || b.area > k.area) block.set(b.label, b);
  }
  const box = (b) => [round(b.x), round(b.y), round(b.w), round(b.h)];
  result[name] = Object.fromEntries(
    [...tight.keys()].sort((a, b) => a.localeCompare(b)).map((label) => {
      const t = box(tight.get(label));
      const k = box(block.get(label) ?? tight.get(label));
      return [label, t.join() === k.join() ? { box: t } : { box: t, block: k }];
    }),
  );
  console.log(`${name.padEnd(14)} ${Object.keys(result[name]).length} boxes`);
  await ctx.close();
}

function round(n) { return Math.round(n * 10000) / 10000; }

fs.writeFileSync(path.join(here, "hotspots.json"), JSON.stringify(result, null, 1) + "\n");
console.log("→ hotspots.json");
await browser.close();
