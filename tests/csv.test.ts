import { describe, expect, it } from "vitest";
import { parseCsv, detectDelimiter } from "@/lib/csv";
import { normalisePhone, parseAmount, suggestMapping } from "@/server/modules/import";

describe("parseCsv", () => {
  it("parses a simple file", () => {
    const { headers, rows } = parseCsv("name,phone\nAsha,9820011223\nRavi,9820044556");
    expect(headers).toEqual(["name", "phone"]);
    expect(rows).toEqual([
      ["Asha", "9820011223"],
      ["Ravi", "9820044556"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const { rows } = parseCsv('name,requirement\n"Kulkarni, Asha","3BHK, east facing"');
    expect(rows[0]).toEqual(["Kulkarni, Asha", "3BHK, east facing"]);
  });

  it("handles escaped quotes inside a quoted field", () => {
    const { rows } = parseCsv('name,note\nAsha,"She said ""call me later"""');
    expect(rows[0]?.[1]).toBe('She said "call me later"');
  });

  it("handles newlines inside a quoted field", () => {
    const { rows } = parseCsv('name,note\nAsha,"line one\nline two"');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.[1]).toBe("line one\nline two");
  });

  it("handles CRLF line endings", () => {
    const { headers, rows } = parseCsv("name,phone\r\nAsha,982001\r\nRavi,982002\r\n");
    expect(headers).toEqual(["name", "phone"]);
    expect(rows).toHaveLength(2);
  });

  it("strips a UTF-8 BOM so the first header is not corrupted", () => {
    const { headers } = parseCsv("﻿name,phone\nAsha,982001");
    expect(headers[0]).toBe("name");
  });

  it("pads short rows and truncates long ones", () => {
    const { rows } = parseCsv("a,b,c\n1\n1,2,3,4");
    expect(rows[0]).toEqual(["1", "", ""]);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("skips blank lines", () => {
    const { rows } = parseCsv("name,phone\n\nAsha,982001\n\n\n");
    expect(rows).toHaveLength(1);
  });

  it("returns empty structures for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("\n\n")).toEqual({ headers: [], rows: [] });
  });

  it("keeps the last row when the file has no trailing newline", () => {
    const { rows } = parseCsv("name,phone\nAsha,982001");
    expect(rows).toHaveLength(1);
  });
});

describe("detectDelimiter", () => {
  it("finds commas, semicolons and tabs", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("ignores delimiters inside quotes when counting", () => {
    // One real semicolon; the commas are inside a quoted header.
    expect(detectDelimiter('"a,b,c,d";e')).toBe(";");
  });

  it("defaults to a comma for a single-column file", () => {
    expect(detectDelimiter("name\nAsha")).toBe(",");
  });
});

describe("normalisePhone", () => {
  it("reduces the same number written different ways to one key", () => {
    const forms = ["+91 98200 11223", "919820011223", "09820011223", "9820011223", "98200-11223"];
    const keys = new Set(forms.map(normalisePhone));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("9820011223");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalisePhone("n/a")).toBe("");
    expect(normalisePhone("")).toBe("");
  });
});

describe("parseAmount", () => {
  it("parses plain numbers and Indian digit grouping", () => {
    expect(parseAmount("9500000")).toBe(9_500_000);
    expect(parseAmount("1,20,00,000")).toBe(12_000_000);
  });

  it("parses crore, lakh and thousand suffixes", () => {
    expect(parseAmount("1.2 Cr")).toBe(12_000_000);
    expect(parseAmount("85 L")).toBe(8_500_000);
    expect(parseAmount("85 lakh")).toBe(8_500_000);
    expect(parseAmount("500k")).toBe(500_000);
  });

  it("strips the rupee sign", () => {
    expect(parseAmount("₹85L")).toBe(8_500_000);
  });

  it("returns undefined for blanks and nonsense rather than NaN", () => {
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("   ")).toBeUndefined();
    expect(parseAmount("call me")).toBeUndefined();
    expect(parseAmount("1.2.3")).toBeUndefined();
  });
});

describe("suggestMapping", () => {
  it("maps a typical spreadsheet export", () => {
    const mapping = suggestMapping(["Full Name", "Mobile Number", "Email Address", "Budget"]);
    expect(mapping[0]).toBe("name");
    expect(mapping[1]).toBe("phone");
    expect(mapping[2]).toBe("email");
    expect(mapping[3]).toBe("budgetMax");
  });

  it("maps Meta lead-ads style headers", () => {
    const mapping = suggestMapping(["created_time", "full_name", "phone_number", "platform"]);
    expect(mapping[1]).toBe("name");
    expect(mapping[2]).toBe("phone");
    expect(mapping[3]).toBe("source");
  });

  it("claims each field at most once", () => {
    const mapping = suggestMapping(["name", "name", "phone", "phone"]);
    const claimed = Object.values(mapping).filter(Boolean);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("leaves unrecognised columns unmapped", () => {
    const mapping = suggestMapping(["name", "phone", "xyzzy_internal_ref"]);
    expect(mapping[2]).toBe("");
  });
});
