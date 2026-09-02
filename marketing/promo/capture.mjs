import { chromium } from "playwright";
import fs from "node:fs";
const S = process.env.S; const out = `${S}/promo/shots`;
const session = JSON.parse(fs.readFileSync(`${S}/admin-session.json`, "utf8"));
const browser = await chromium.launch({ executablePath: process.env.EXE });
async function shoot(viewport, dsf, name, path, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, colorScheme: "light", isMobile: !!opts.mobile });
  await ctx.addCookies(session.cookies.map(({ name, value, path }) => ({ name, value, domain: "localhost", path: path ?? "/" })));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (opts.click) { await page.click(opts.click); await page.waitForTimeout(600); }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  const url = page.url(); await ctx.close(); return url;
}
const desk = { width: 1440, height: 900 };
for (const [name, path] of [["dashboard","/dashboard"],["leads","/leads"],["pipeline","/pipeline"],["inventory","/inventory"],["site-visits","/site-visits"],["bookings","/bookings"],["reports","/reports"],["studio","/marketing/studio"],["marketing","/marketing"]]) {
  console.log(name, await shoot(desk, 2, name, path));
}
// a lead detail: follow the first lead link
{
  const ctx = await browser.newContext({ viewport: desk, deviceScaleFactor: 2 });
  await ctx.addCookies(session.cookies.map(({ name, value, path }) => ({ name, value, domain: "localhost", path: path ?? "/" })));
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/leads", { waitUntil: "networkidle" });
  const href = await page.locator('a[href^="/leads/lead"]').first().getAttribute("href");
  await page.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/lead-detail.png` }); console.log("lead-detail", href); await ctx.close();
}
const mob = { width: 390, height: 844 };
for (const [name, path] of [["m-leads","/leads"],["m-dashboard","/dashboard"],["m-pipeline","/pipeline"],["m-site-visits","/site-visits"]]) {
  console.log(name, await shoot(mob, 3, name, path, { mobile: true }));
}
await browser.close();
