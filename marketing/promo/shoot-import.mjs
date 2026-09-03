// The import screens, captured for real.
//
// The import reel narrates column mapping and a duplicate preview, and those
// only exist after a file is chosen — a screenshot of the empty upload form
// would be an ad for a screen the voiceover is not describing. So this drives
// the actual flow: upload a small file that deliberately repeats a lead the
// CRM already holds, and shoot the mapping and the preview it produces.
import { chromium } from "playwright";
import fs from "node:fs";

const S = process.env.S;
const out = `${S}/promo/project/assets/shots`;
const session = JSON.parse(fs.readFileSync(`${S}/admin-session.json`, "utf8"));

// A Meta lead-ads export, with the header names Meta actually writes.
const csv = [
  "created_time,full_name,phone_number,email,campaign_name,platform,city,budget",
  "2026-09-01T09:14:00+0530,Meera Iyer,+91 98765 43210,meera.iyer@example.com,Agartha 3BHK Launch,instagram,Hyderabad,1.4 Cr",
  "2026-09-01T10:02:00+0530,Arjun Das,+91 98765 43211,arjun.das@example.com,Agartha 3BHK Launch,facebook,Hyderabad,1.2 Cr",
  "2026-09-01T11:20:00+0530,Farida Sheikh,+91 98765 43212,farida@example.com,SYL Villas,instagram,Hyderabad,2.6 Cr",
  "2026-09-01T12:41:00+0530,Vikram Joshi,+91 98765 43213,vikram.joshi@example.com,SYL Villas,instagram,Secunderabad,1.9 Cr",
  // The same buyer enquiring twice, from a second campaign, with a bigger
  // budget. This is the case the reel is about: not a row to throw away, but
  // two halves of one buyer that should end up as one lead.
  "2026-09-02T18:05:00+0530,Meera Iyer,+91 98765 43210,meera.i@example.com,SYL Villas,instagram,Hyderabad,1.8 Cr",
].join("\n") + "\n";
const file = `${S}/promo/meta-leads-export.csv`;
fs.writeFileSync(file, csv);

const browser = await chromium.launch({ executablePath: process.env.EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
await ctx.addCookies(session.cookies.map(({ name, value, path }) => ({ name, value, domain: "localhost", path: path ?? "/" })));
const page = await ctx.newPage();

await page.goto("http://localhost:3000/leads/import", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/import.png` });
console.log("import.png");

await page.setInputFiles('input[type="file"]', file);
await page.locator('form button[type="submit"]').first().click();
// The mapping screen appears once the file is parsed; wait for it, do not guess.
await page.locator('text=/Column|Map|Preview/i').first().waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/import-mapping.png` });
console.log("import-mapping.png");

// The duplicate summary and the combine list sit below the mapping table on the
// same page, so the second shot is the same screen further down.
await page.locator("text=/will be combined|Will combine/i").first().scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/import-preview.png` });
console.log("import-preview.png");

await browser.close();
