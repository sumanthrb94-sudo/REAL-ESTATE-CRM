// A minimal .xlsx reader: enough to pull one sheet out as rows of strings.
//
// An xlsx file is a ZIP holding XML. We need three members of it — the sheet,
// the shared-string table, and the workbook index — so the whole reader is a
// ZIP central-directory walk plus two small XML passes. The published xlsx
// package would do this too, but every version on npm carries high-severity
// advisories that our own `npm audit` gate rejects, and ExcelJS pulls a
// megabyte of writer code we never call.
//
// Scope is deliberate: first (or named) worksheet, cell values as text, dates
// converted from Excel serials. Formulas are read as their cached result,
// which is what a lead export contains.

import { inflateRawSync } from "node:zlib";

// ─── ZIP ────────────────────────────────────────────────────────────────────

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * Index a ZIP by its central directory rather than by scanning local headers:
 * local headers may declare a zero size and defer it to a trailing data
 * descriptor, whereas the central directory is always authoritative.
 */
function readCentralDirectory(buf: Buffer): Map<string, ZipEntry> {
  // The end-of-central-directory record is last, but a trailing comment can
  // push it back by up to 64 KB, so scan backwards for its signature.
  let eocd = -1;
  const from = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file (no ZIP end-of-directory record).");

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CDH_SIG) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf: Buffer, entry: ZipEntry): string {
  const o = entry.localHeaderOffset;
  if (buf.readUInt32LE(o) !== LFH_SIG) throw new Error(`Corrupt entry "${entry.name}".`);
  // The local header repeats the name and extra fields, and its extra-field
  // length can differ from the central directory's, so read it from here.
  const nameLen = buf.readUInt16LE(o + 26);
  const extraLen = buf.readUInt16LE(o + 28);
  const start = o + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.toString("utf8");
  if (entry.method === 8) return inflateRawSync(data).toString("utf8");
  throw new Error(`Unsupported compression in "${entry.name}".`);
}

// ─── XML ────────────────────────────────────────────────────────────────────

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

/**
 * The shared-string table. A string can be split across several runs when it
 * carries mixed formatting, so join every <t> inside one <si>.
 */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<si\b[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []) {
    let text = "";
    for (const t of si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []) {
      text += decodeXml(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, ""));
    }
    out.push(text);
  }
  return out;
}

/** "BF12" → 57 (0-based column index). */
export function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref.toUpperCase())?.[1] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Excel keeps dates as days since 1899-12-30 (its leap-year bug included).
 * Only values inside a plausible window are treated as dates; a budget of
 * 45000 must stay a number.
 */
const SERIAL_MIN = 20_000; // ≈ 1954
const SERIAL_MAX = 60_000; // ≈ 2064

export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < SERIAL_MIN || serial > SERIAL_MAX) return null;
  const ms = Math.round((serial - 25_569) * 86_400_000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface Sheet {
  name: string;
  rows: string[][];
}

/**
 * Read one worksheet into a dense grid of strings.
 *
 * `dateColumns` names the 0-based columns whose numeric cells should be read
 * as dates; the caller knows which column is "created time" and we would
 * otherwise have to parse the style table to find out.
 */
export function readXlsx(input: Buffer | ArrayBuffer | Uint8Array, options: { sheet?: string; dateColumns?: Set<number> } = {}): Sheet {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  const zip = readCentralDirectory(buf);

  // Resolve which worksheet part to read. workbook.xml lists sheets in order
  // and points at them through relationship ids.
  let target = "xl/worksheets/sheet1.xml";
  let sheetName = "Sheet1";
  const workbookEntry = zip.get("xl/workbook.xml");
  const relsEntry = zip.get("xl/_rels/workbook.xml.rels");
  if (workbookEntry && relsEntry) {
    const workbook = readEntry(buf, workbookEntry);
    const rels = readEntry(buf, relsEntry);
    const sheets = [...workbook.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => m[0]);
    const wanted = options.sheet
      ? sheets.find((s) => decodeXml(/name="([^"]*)"/.exec(s)?.[1] ?? "") === options.sheet)
      : sheets[0];
    if (options.sheet && !wanted) {
      const names = sheets.map((s) => decodeXml(/name="([^"]*)"/.exec(s)?.[1] ?? "")).join(", ");
      throw new Error(`That workbook has no sheet named "${options.sheet}". It has: ${names}.`);
    }
    if (wanted) {
      sheetName = decodeXml(/name="([^"]*)"/.exec(wanted)?.[1] ?? sheetName);
      const rid = /r:id="([^"]*)"/.exec(wanted)?.[1];
      if (rid) {
        const rel = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`).exec(rels)?.[0];
        const t = rel ? /Target="([^"]*)"/.exec(rel)?.[1] : undefined;
        if (t) target = t.startsWith("/") ? t.slice(1) : t.startsWith("xl/") ? t : `xl/${t}`;
      }
    }
  }

  const sheetEntry = zip.get(target) ?? zip.get("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("That .xlsx file contains no worksheet.");

  const sharedEntry = zip.get("xl/sharedStrings.xml");
  const shared = sharedEntry ? parseSharedStrings(readEntry(buf, sharedEntry)) : [];
  const xml = readEntry(buf, sheetEntry);

  const rows: string[][] = [];
  const dateCols = options.dateColumns;

  for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) ?? []) {
    const cells: string[] = [];
    for (const cellXml of rowXml.match(/<c\b[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/.exec(cellXml)?.[1];
      const col = ref ? columnIndex(ref) : cells.length;
      const type = /\st="([^"]*)"/.exec(cellXml)?.[1] ?? "n";

      let value = "";
      if (type === "inlineStr") {
        value = (cellXml.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? [])
          .map((t) => decodeXml(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
          .join("");
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
        if (raw != null) {
          const decoded = decodeXml(raw);
          if (type === "s") {
            value = shared[Number(decoded)] ?? "";
          } else if (type === "b") {
            value = decoded === "1" ? "TRUE" : "FALSE";
          } else if (dateCols?.has(col)) {
            value = excelSerialToIso(Number(decoded)) ?? decoded;
          } else {
            value = decoded;
          }
        }
      }

      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    rows.push(cells);
  }

  // Pad every row to the widest, so callers can index by column safely.
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  for (const r of rows) while (r.length < width) r.push("");

  return { name: sheetName, rows };
}

/** The first four bytes of every ZIP, and so of every .xlsx. */
export function looksLikeXlsx(input: Buffer | Uint8Array): boolean {
  return input.length > 4 && input[0] === 0x50 && input[1] === 0x4b && (input[2] === 0x03 || input[2] === 0x05 || input[2] === 0x07);
}
