// EstateCRM — CSV parsing.
//
// A small RFC 4180 parser rather than a dependency: quoted fields, escaped
// quotes ("" inside a quoted field), embedded newlines and commas, and CRLF or
// LF line endings. Exports from Excel, Google Sheets and Meta's lead-ads
// download all fit inside that.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Strip a UTF-8 BOM, which Excel writes and which otherwise corrupts header 1. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse CSV text into a header row plus data rows.
 *
 * Rows shorter than the header are padded with empty strings and longer rows
 * are truncated, so callers can index by column position without guarding.
 */
export function parseCsv(text: string, delimiter = ","): ParsedCsv {
  const src = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Skip rows that are entirely empty (trailing newline, blank separators).
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const char = src[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      endField();
      i++;
      continue;
    }
    if (char === "\r") {
      // Handle CRLF and a lone CR.
      endRow();
      i += src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      i++;
      continue;
    }

    field += char;
    i++;
  }

  // Flush whatever is left when the file does not end with a newline.
  if (field !== "" || row.length > 0) endRow();

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0]!.map((h) => h.trim());
  const width = headers.length;
  const body = rows.slice(1).map((r) => {
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push("");
    return padded;
  });

  return { headers, rows: body };
}

/**
 * Guess the delimiter by counting candidates in the first line outside quotes.
 * Semicolons are common in European Excel exports, tabs in copy-paste.
 */
export function detectDelimiter(text: string): string {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;

  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}
