// One upload path for every channel: Excel or CSV in, deduped and combined
// leads out. The fixture is a genuine .xlsx written by openpyxl, so the reader
// is tested against a real ZIP and a real shared-string table rather than
// something this repo generated to its own assumptions.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { columnIndex, excelSerialToIso, looksLikeXlsx, readXlsx } from "@/lib/xlsx";
import { readWorkbook } from "@/lib/spreadsheet";
import { templateCsv, TEMPLATE_COLUMNS, CHANNEL_PRESETS } from "@/lib/import-fields";
import {
  commitImport,
  detectChannel,
  mergeLead,
  previewImport,
  suggestMapping,
  normalisePhone,
} from "@/server/modules/import";
import { db } from "@/server/db";
import type { Lead } from "@/types/domain";

const FIXTURE = join(process.cwd(), "tests/fixtures/meta-lead-ads.xlsx");

describe("xlsx reader", () => {
  const buf = readFileSync(FIXTURE);

  it("recognises a workbook by its bytes, not its name", () => {
    expect(looksLikeXlsx(buf)).toBe(true);
    expect(looksLikeXlsx(Buffer.from("name,phone\nA,1"))).toBe(false);
  });

  it("reads the sheet, its shared strings and its dates", () => {
    const sheet = readXlsx(buf, { dateColumns: new Set([0]) });
    expect(sheet.name).toBe("Leads");
    expect(sheet.rows).toHaveLength(4);
    expect(sheet.rows[0]?.[7]).toBe("full_name");
    expect(sheet.rows[1]?.[7]).toBe("Ravi  Menon");
    // Excel keeps the date as a serial; it must come back as an ISO instant.
    expect(sheet.rows[1]?.[0]).toMatch(/^2026-08-30T/);
    expect(sheet.rows[2]?.[8]).toBe("09848012345");
  });

  it("leaves numbers alone in columns that are not dates", () => {
    const sheet = readXlsx(buf);
    expect(sheet.rows[1]?.[0]).not.toMatch(/^2026-/);
  });

  it("names a missing sheet instead of silently reading the first", () => {
    expect(() => readXlsx(buf, { sheet: "Nope" })).toThrow(/no sheet named "Nope"/);
  });

  it("converts column references and rejects implausible date serials", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA1")).toBe(26);
    expect(columnIndex("BF12")).toBe(57);
    expect(excelSerialToIso(46000)).toMatch(/^2025-/);
    expect(excelSerialToIso(45)).toBeNull(); // a budget, not a date
    expect(excelSerialToIso(9_000_000)).toBeNull();
  });
});

describe("readWorkbook", () => {
  it("reads an .xlsx into headers and rows", () => {
    const wb = readWorkbook(readFileSync(FIXTURE), "meta.xlsx");
    expect(wb.format).toBe("xlsx");
    expect(wb.headers[7]).toBe("full_name");
    expect(wb.rows).toHaveLength(3);
    // created_time matches the date-header pattern, so it converts.
    expect(wb.rows[0]?.[0]).toMatch(/^2026-08-30T/);
  });

  it("reads CSV, TSV and a BOM-prefixed Excel CSV through the same door", () => {
    expect(readWorkbook(Buffer.from("Name,Phone\nRavi,9848044556")).headers).toEqual(["Name", "Phone"]);
    expect(readWorkbook(Buffer.from("Name\tPhone\nRavi\t9848044556")).format).toBe("tsv");
    const bom = readWorkbook(Buffer.from("﻿Name,Phone\nRavi,9848044556"));
    expect(bom.headers[0]).toBe("Name");
  });

  it("drops blank rows that trail a spreadsheet", () => {
    expect(readWorkbook(Buffer.from("Name,Phone\nRavi,9848044556\n,\n\n")).rows).toHaveLength(1);
  });
});

describe("the unified template", () => {
  it("uses header text the auto-mapper already recognises", () => {
    const headers = TEMPLATE_COLUMNS.map((c) => c.header);
    const mapping = suggestMapping(headers);
    const mapped = headers.map((_, i) => mapping[i]);
    expect(mapped).toEqual(TEMPLATE_COLUMNS.map((c) => c.field));
  });

  it("round-trips as a readable CSV with one example row", () => {
    const wb = readWorkbook(Buffer.from(templateCsv()));
    expect(wb.headers).toEqual(TEMPLATE_COLUMNS.map((c) => c.header));
    expect(wb.rows).toHaveLength(1);
    expect(wb.rows[0]?.[0]).toBe("Ravi Menon");
  });

  it("covers every channel the business actually uses", () => {
    const ids = CHANNEL_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["meta", "whatsapp", "website", "portal", "offline"]));
  });
});

describe("channel detection", () => {
  it("names a Meta export from its headers", () => {
    expect(detectChannel(["created_time", "full_name", "phone_number", "form_name"]))
      .toMatch(/Meta lead ads/);
  });

  it("says nothing when the headers are generic", () => {
    expect(detectChannel(["Name", "Phone", "Email"])).toBeUndefined();
  });
});

describe("mergeLead", () => {
  const existing: Lead = {
    id: "lead_1",
    name: "Ravi Menon",
    phone: "+91 98480 44556",
    status: "QUALIFIED",
    source: "WEBSITE",
    temperature: "WARM",
    score: 40,
    budgetMax: 9_500_000,
    requirement: "3BHK, east facing",
    tags: ["Website"],
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  } as Lead;

  const incoming = {
    name: "Ravi  Menon",
    phone: "9848044556",
    email: "ravi@example.com",
    status: "NEW",
    source: "FACEBOOK",
    temperature: "HOT",
    score: 0,
    budgetMin: 8_000_000,
    budgetMax: 12_000_000,
    requirement: "Ready to move, needs parking",
    tags: ["Agartha Launch", "website"],
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  } as Omit<Lead, "id">;

  const plan = mergeLead(existing, incoming, "meta.xlsx", 4);

  it("fills what is blank without touching what is known", () => {
    expect(plan.patch.email).toBe("ravi@example.com");
    expect(plan.patch.status).toBeUndefined(); // never drag QUALIFIED back to NEW
    expect(plan.patch.source).toBeUndefined(); // first touch keeps attribution
    expect(plan.patch.name).toBeUndefined(); // the CRM's spelling wins
  });

  it("widens the budget rather than replacing it", () => {
    expect(plan.patch.budgetMin).toBe(8_000_000);
    expect(plan.patch.budgetMax).toBe(12_000_000);
  });

  it("only ever raises the temperature", () => {
    expect(plan.patch.temperature).toBe("HOT");
    const cooler = mergeLead(existing, { ...incoming, temperature: "COLD" }, "f", 1);
    expect(cooler.patch.temperature).toBeUndefined();
  });

  it("unions tags case-insensitively and appends the requirement", () => {
    expect(plan.patch.tags).toEqual(["Website", "Agartha Launch"]);
    expect(plan.patch.requirement).toBe("3BHK, east facing\nReady to move, needs parking");
  });

  it("keeps the earlier enquiry date", () => {
    expect(plan.patch.createdAt).toBe("2026-08-25T00:00:00.000Z");
  });

  it("writes a note that names the file, the row and the second channel", () => {
    expect(plan.note).toContain("meta.xlsx");
    expect(plan.note).toContain("row 4");
    expect(plan.note).toContain("facebook");
    expect(plan.changes).toContain("also via facebook");
  });

  it("reports nothing to combine when the row adds nothing", () => {
    const same = mergeLead(existing, { ...incoming, phone: existing.phone, email: undefined, budgetMin: undefined, budgetMax: 9_500_000, temperature: "WARM", tags: ["Website"], requirement: "3BHK, east facing", createdAt: existing.createdAt, source: "WEBSITE" }, "f", 2);
    expect(same.changes).toEqual([]);
    expect(same.note).toContain("Nothing new to combine");
  });
});

describe("end to end: upload, dedupe, combine", () => {
  const csvOf = (headers: string[], rows: string[][]) =>
    [headers, ...rows].map((r) => r.join(",")).join("\n");

  beforeEach(async () => {
    for (const l of await db.leads.list()) await db.leads.delete(l.id);
    for (const a of await db.activities.list()) await db.activities.delete(a.id);
  });

  it("matches the same person across channels however the phone is written", () => {
    expect(normalisePhone("+91 98480 44556")).toBe("9848044556");
    expect(normalisePhone("09848044556")).toBe("9848044556");
    expect(normalisePhone("98480-44556")).toBe("9848044556");
  });

  it("adds new people and combines the ones already there", async () => {
    const headers = ["Name", "Phone", "Email", "Source", "Requirement", "Tags"];
    await commitImport(
      csvOf(headers, [["Ravi Menon", "9848044556", "", "Website", "3BHK east facing", "Website"]]),
      suggestMapping(headers),
      "merge",
      "website.csv",
    );
    expect(await db.leads.count()).toBe(1);

    // The same buyer comes back through Meta, written differently.
    const result = await commitImport(
      csvOf(headers, [
        ["Ravi  Menon", "+91 98480 44556", "ravi@example.com", "Facebook", "Ready to move", "Agartha Launch"],
        ["Nisha Verma", "9848012345", "nisha@example.com", "Instagram", "2BHK", "Agartha Launch"],
      ]),
      suggestMapping(headers),
      "merge",
      "meta.xlsx",
    );

    expect(result.created).toBe(1);
    expect(result.merged).toBe(1);
    expect(await db.leads.count()).toBe(2);

    const ravi = (await db.leads.list()).find((l) => l.phone.includes("44556"))!;
    expect(ravi.email).toBe("ravi@example.com");
    expect(ravi.tags).toEqual(["Website", "Agartha Launch"]);
    expect(ravi.requirement).toContain("3BHK east facing");
    expect(ravi.requirement).toContain("Ready to move");
    expect(ravi.source).toBe("WEBSITE"); // first touch keeps the attribution

    const notes = (await db.activities.list()).filter((a) => a.leadId === ravi.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toContain("meta.xlsx");
  });

  it("folds a file that names the same person twice into one lead", async () => {
    const headers = ["Name", "Phone", "Email", "Tags"];
    const result = await commitImport(
      csvOf(headers, [
        ["Ravi Menon", "9848044556", "", "Hoarding"],
        ["Ravi Menon", "098480 44556", "ravi@example.com", "Walk-in"],
      ]),
      suggestMapping(headers),
      "merge",
      "walkins.xlsx",
    );
    expect(result.created).toBe(1);
    expect(await db.leads.count()).toBe(1);
    const ravi = (await db.leads.list())[0]!;
    expect(ravi.email).toBe("ravi@example.com");
    expect(ravi.tags).toEqual(["Hoarding", "Walk-in"]);
  });

  it("matches on email when the phone is a new number", async () => {
    const headers = ["Name", "Phone", "Email"];
    await commitImport(
      csvOf(headers, [["Ravi Menon", "9848044556", "ravi@example.com"]]),
      suggestMapping(headers), "merge", "a.csv",
    );
    // A second enquiry from the same person on a different number.
    const result = await commitImport(
      csvOf(headers, [["Ravi Menon", "9000011111", "ravi@example.com"]]),
      suggestMapping(headers), "merge", "b.csv",
    );
    expect(result.merged).toBe(1);
    expect(await db.leads.count()).toBe(1);

    // The number we matched by email is new; it belongs on the timeline.
    const note = (await db.activities.list()).at(-1);
    expect(note?.body).toContain("second number 9000011111");
    expect(note?.body).toContain("matched on email");
  });

  it("honours skip and create as well as merge", async () => {
    const headers = ["Name", "Phone", "Email"];
    const seed = csvOf(headers, [["Ravi Menon", "9848044556", ""]]);
    const again = csvOf(headers, [["Ravi Menon", "9848044556", "ravi@example.com"]]);

    await commitImport(seed, suggestMapping(headers), "merge", "a.csv");
    const skipped = await commitImport(again, suggestMapping(headers), "skip", "b.csv");
    expect(skipped.created).toBe(0);
    expect(skipped.merged).toBe(0);
    expect((await db.leads.list())[0]?.email).toBeUndefined();

    const forced = await commitImport(again, suggestMapping(headers), "create", "c.csv");
    expect(forced.created).toBe(1);
    expect(await db.leads.count()).toBe(2);
  });

  it("previews exactly what the commit will do", async () => {
    const headers = ["Name", "Phone", "Email"];
    await commitImport(csvOf(headers, [["Ravi Menon", "9848044556", ""]]), suggestMapping(headers), "merge", "a.csv");

    const csv = csvOf(headers, [
      ["Ravi Menon", "9848044556", "ravi@example.com"],
      ["Nisha Verma", "9848012345", "nisha@example.com"],
    ]);
    const preview = await previewImport(csv, undefined, "merge", "b.csv");
    expect(preview.valid).toBe(1);
    expect(preview.merges).toHaveLength(1);
    expect(preview.merges[0]?.existingName).toBe("Ravi Menon");
    expect(preview.merges[0]?.changes).toContain("email ravi@example.com");

    const result = await commitImport(csv, suggestMapping(headers), "merge", "b.csv");
    expect(result.created).toBe(preview.valid);
    expect(result.merged).toBe(preview.merges.length);
  });

  it("imports a real Meta lead-ads workbook end to end", async () => {
    const wb = readWorkbook(readFileSync(FIXTURE), "meta-lead-ads.xlsx");
    const csv = [wb.headers, ...wb.rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const mapping = suggestMapping(wb.headers);
    const preview = await previewImport(csv, mapping, "merge", "meta-lead-ads.xlsx");

    expect(preview.channel).toMatch(/Meta lead ads/);
    expect(preview.errors).toEqual([]);
    expect(preview.valid).toBe(3);

    const result = await commitImport(csv, mapping, "merge", "meta-lead-ads.xlsx");
    expect(result.created).toBe(3);

    const leads = await db.leads.list();
    const ravi = leads.find((l) => l.name.includes("Ravi"))!;
    expect(normalisePhone(ravi.phone)).toBe("9848044556");
    expect(ravi.email).toBe("ravi@example.com");
    // "₹95 L" in the budget column becomes rupees.
    expect(ravi.budgetMax).toBe(9_500_000);
    // created_time survives as the enquiry date rather than becoming "now".
    expect(ravi.createdAt).toMatch(/^2026-08-30T/);
  });
});
