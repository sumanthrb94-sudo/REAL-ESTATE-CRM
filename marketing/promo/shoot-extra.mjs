// Screens the original promo never needed.
//
// Two of the campaign reels are about the working day and about lead
// distribution, and both of those have their own page in the app. Narrating
// them over a screenshot of the leads table would be describing one screen
// while showing another, so they get captured properly.
import { chromium } from "playwright";
import fs from "node:fs";

const S = process.env.S;
const out = `${S}/promo/project/assets/shots`;
const session = JSON.parse(fs.readFileSync(`${S}/admin-session.json`, "utf8"));
const browser = await chromium.launch({ executablePath: process.env.EXE });

for (const [name, route, viewport, dsf, mobile] of [
  ["my-day", "/my-day", { width: 1440, height: 900 }, 2, false],
  ["distribution", "/distribution", { width: 1440, height: 900 }, 2, false],
  ["m-my-day", "/my-day", { width: 390, height: 844 }, 3, true],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, colorScheme: "light", isMobile: mobile });
  await ctx.addCookies(session.cookies.map(({ name: n, value, path }) => ({ name: n, value, domain: "localhost", path: path ?? "/" })));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
  await ctx.close();
}
await browser.close();
