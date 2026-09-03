// One door for every lead file the business receives.
//
// Meta hands you .xlsx or .csv, portals send .csv, a website form export is
// usually .csv, and an offline walk-in register is whatever the sales desk
// typed into Excel. The importer should not care: it asks for headers and
// rows, and this module works out the rest from the bytes.

import { parseCsv, detectDelimiter } from "./csv";
import { looksLikeXlsx, readXlsx } from "./xlsx";

export type SheetFormat = "xlsx" | "csv" | "tsv";

export interface Workbook {
  format: SheetFormat;
  /** Worksheet name for .xlsx; the file name otherwise. */
  sheetName: string;
  headers: string[];
  rows: string[][];
}

/** Columns whose numeric cells are Excel date serials rather than amounts. */
const DATE_HEADER = /(date|time|created|submitted|timestamp|enquir)/i;

function isBlankRow(row: string[]): boolean {
  return row.every((c) => c.trim() === "");
}

/**
 * Read any supported file into headers plus rows.
 *
 * The bytes decide the format, not the extension: a file named .xls that is
 * really a CSV is common from portal exports, and a .csv that is really a
 * zipped workbook happens whenever someone renames a download.
 */
export function readWorkbook(input: Buffer | Uint8Array, fileName = "", options: { sheet?: string } = {}): Workbook {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (looksLikeXlsx(buf)) {
    // Two passes: the first finds the header row so date columns can be named,
    // the second re-reads with those columns converted from Excel serials.
    const probe = readXlsx(buf, { sheet: options.sheet });
    const headerRow = probe.rows.find((r) => !isBlankRow(r)) ?? [];
    const dateColumns = new Set(
      headerRow.map((h, i) => (DATE_HEADER.test(h) ? i : -1)).filter((i) => i >= 0),
    );
    const sheet = dateColumns.size ? readXlsx(buf, { sheet: options.sheet, dateColumns }) : probe;
    const rows = sheet.rows.filter((r) => !isBlankRow(r));
    const [headers = [], ...body] = rows;
    return { format: "xlsx", sheetName: sheet.name, headers: headers.map((h) => h.trim()), rows: body };
  }

  // Strip a UTF-8 BOM; Excel writes one on every CSV it saves and it would
  // otherwise become part of the first header's name.
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const delimiter = detectDelimiter(text);
  const { headers, rows } = parseCsv(text, delimiter);
  return {
    format: delimiter === "\t" ? "tsv" : "csv",
    sheetName: fileName || "Sheet1",
    headers: headers.map((h) => h.trim()),
    rows: rows.filter((r) => !isBlankRow(r)),
  };
}

/** True when the byte signature or the name says spreadsheet rather than text. */
export function isSpreadsheet(input: Buffer | Uint8Array, fileName = ""): boolean {
  return looksLikeXlsx(input) || /\.xlsx$/i.test(fileName);
}
