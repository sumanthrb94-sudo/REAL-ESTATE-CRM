// EstateCRM — lead import.
//
// Takes a CSV, maps its columns onto lead fields, validates every row, and
// reports exactly what would happen before anything is written. The same
// function runs the dry run and the real import, so the preview cannot
// disagree with the result.

import { db } from "@/server/db";
import { parseCsv, detectDelimiter } from "@/lib/csv";
import { autoAssignMany } from "@/server/modules/distribution";
import {
  FIELD_LABELS,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  type ImportField,
} from "@/lib/import-fields";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type Lead,
  type LeadSource,
  type LeadStatus,
  type LeadTemperature,
} from "@/types/domain";

// Field definitions live in lib/import-fields so the client wizard can import
// them without pulling this module's server dependencies into the bundle.
export {
  IMPORT_FIELDS,
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type ImportField,
  type ImportMapping,
} from "@/lib/import-fields";

/**
 * Header text we recognise automatically, so a typical export needs no manual
 * mapping. Matching is case- and punctuation-insensitive.
 */
const HEADER_HINTS: Record<ImportField, string[]> = {
  name: ["name", "fullname", "full name", "leadname", "customername", "contactname", "firstname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "whatsapp"],
  email: ["email", "emailaddress", "mail", "e-mail"],
  source: ["source", "leadsource", "channel", "platform", "medium"],
  status: ["status", "stage", "leadstatus", "pipelinestage"],
  temperature: ["temperature", "temp", "priority", "quality"],
  budgetMin: ["budgetmin", "minbudget", "budgetfrom", "minimumbudget"],
  budgetMax: ["budgetmax", "maxbudget", "budgetto", "maximumbudget", "budget"],
  requirement: ["requirement", "requirements", "notes", "message", "comments", "enquiry", "remarks"],
  projectName: ["project", "projectname", "interestedproject", "property"],
  tags: ["tags", "labels", "campaign", "adname", "adsetname"],
  createdAt: ["createdat", "created", "date", "createdtime", "submittedat", "timestamp"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-guess column → field mapping. Each field is claimed at most once. */
export function suggestMapping(headers: string[]): Record<number, ImportField | ""> {
  const mapping: Record<number, ImportField | ""> = {};
  const claimed = new Set<ImportField>();

  headers.forEach((header, index) => {
    const h = norm(header);
    if (!h) {
      mapping[index] = "";
      return;
    }
    // Exact hint first, then a prefix/contains fallback.
    const exact = IMPORT_FIELDS.find(
      (f) => !claimed.has(f) && HEADER_HINTS[f].some((hint) => norm(hint) === h),
    );
    const fuzzy =
      exact ??
      IMPORT_FIELDS.find(
        (f) => !claimed.has(f) && HEADER_HINTS[f].some((hint) => h.includes(norm(hint))),
      );
    if (fuzzy) {
      claimed.add(fuzzy);
      mapping[index] = fuzzy;
    } else {
      mapping[index] = "";
    }
  });

  return mapping;
}

// ─── Value coercion ─────────────────────────────────────────────────────────

/**
 * Normalise an Indian mobile number for duplicate detection: keep digits,
 * drop a 91 country code or a leading 0, and compare the last 10.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function coerceSource(raw: string): LeadSource {
  const v = norm(raw);
  if (!v) return "OTHER";
  const exact = LEAD_SOURCES.find((s) => norm(s) === v);
  if (exact) return exact;
  // Common spellings from ad platforms and portals.
  if (v.includes("insta") || v === "ig") return "INSTAGRAM";
  if (v.includes("facebook") || v === "fb" || v.includes("meta")) return "FACEBOOK";
  if (v.includes("99")) return "PORTAL_99ACRES";
  if (v.includes("magic")) return "PORTAL_MAGICBRICKS";
  if (v.includes("housing")) return "PORTAL_HOUSING";
  if (v.includes("google") || v.includes("adwords")) return "GOOGLE_ADS";
  if (v.includes("walk")) return "WALK_IN";
  if (v.includes("refer")) return "REFERRAL";
  if (v.includes("partner") || v.includes("broker")) return "CHANNEL_PARTNER";
  if (v.includes("call")) return "CALL_CENTER";
  if (v.includes("web") || v.includes("site")) return "WEBSITE";
  return "OTHER";
}

function coerceStatus(raw: string): LeadStatus {
  const v = norm(raw);
  if (!v) return "NEW";
  return LEAD_STATUSES.find((s) => norm(s) === v) ?? "NEW";
}

function coerceTemperature(raw: string): LeadTemperature {
  const v = norm(raw);
  if (v.startsWith("hot") || v === "high") return "HOT";
  if (v.startsWith("cold") || v === "low") return "COLD";
  return "WARM";
}

/**
 * Parse a rupee amount written the way people actually write them:
 * "1,20,00,000", "₹85 L", "1.2 Cr", "9500000".
 */
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;

  const cleaned = s.replace(/[₹,\s]/g, "");
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)(cr|crore|crores|l|lac|lakh|lakhs|k)?$/);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;

  switch (match[2]) {
    case "cr":
    case "crore":
    case "crores":
      return Math.round(value * 10_000_000);
    case "l":
    case "lac":
    case "lakh":
    case "lakhs":
      return Math.round(value * 100_000);
    case "k":
      return Math.round(value * 1_000);
    default:
      return Math.round(value);
  }
}

function parseDate(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  // Refuse dates in the future — almost always a misparsed DD/MM vs MM/DD.
  if (d.getTime() > Date.now() + 86_400_000) return undefined;
  return d.toISOString();
}

// ─── Preview & import ───────────────────────────────────────────────────────

export interface RowIssue {
  /** 1-based row number as the user sees it in a spreadsheet (header is row 1). */
  row: number;
  message: string;
}

export interface ImportPreview {
  headers: string[];
  /** First few rows, for the mapping table. */
  sample: string[][];
  mapping: Record<number, ImportField | "">;
  totalRows: number;
  valid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  errors: RowIssue[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: RowIssue[];
}

interface PreparedRow {
  rowNumber: number;
  lead: Omit<Lead, "id">;
  phoneKey: string;
}

const SAMPLE_SIZE = 5;
const MAX_ROWS = 5_000;

/**
 * Turn parsed CSV plus a mapping into validated leads, collecting per-row
 * problems instead of failing the whole file. Shared by preview and commit.
 */
async function prepare(
  headers: string[],
  rows: string[][],
  mapping: Record<number, ImportField | "">,
  skipDuplicates: boolean,
): Promise<{
  prepared: PreparedRow[];
  errors: RowIssue[];
  duplicatesInFile: number;
  duplicatesInDb: number;
}> {
  const errors: RowIssue[] = [];
  const prepared: PreparedRow[] = [];

  const columnOf = (field: ImportField): number =>
    Number(Object.keys(mapping).find((k) => mapping[Number(k)] === field) ?? -1);

  const idx: Partial<Record<ImportField, number>> = {};
  for (const f of IMPORT_FIELDS) {
    const c = columnOf(f);
    if (c >= 0) idx[f] = c;
  }

  const [existingLeads, projects] = await Promise.all([db.leads.list(), db.projects.list()]);
  const existingPhones = new Set(existingLeads.map((l) => normalisePhone(l.phone)));
  const projectByName = new Map(projects.map((p) => [p.name.toLowerCase().trim(), p.id]));

  const seenInFile = new Set<string>();
  let duplicatesInFile = 0;
  let duplicatesInDb = 0;
  const now = new Date().toISOString();

  rows.forEach((row, i) => {
    // +2: one for the header row, one because spreadsheets are 1-based.
    const rowNumber = i + 2;
    const cell = (f: ImportField) => (idx[f] != null ? (row[idx[f]!] ?? "").trim() : "");

    const name = cell("name");
    const phoneRaw = cell("phone");
    const phoneKey = normalisePhone(phoneRaw);

    if (!name) {
      errors.push({ row: rowNumber, message: "Name is empty" });
      return;
    }
    if (!phoneKey) {
      errors.push({ row: rowNumber, message: "Phone is empty" });
      return;
    }
    if (phoneKey.length < 10) {
      errors.push({ row: rowNumber, message: `Phone “${phoneRaw}” has fewer than 10 digits` });
      return;
    }

    if (seenInFile.has(phoneKey)) {
      duplicatesInFile++;
      if (skipDuplicates) return;
    }
    if (existingPhones.has(phoneKey)) {
      duplicatesInDb++;
      if (skipDuplicates) return;
    }
    seenInFile.add(phoneKey);

    const email = cell("email");
    const projectName = cell("projectName").toLowerCase();
    const tagsRaw = cell("tags");
    const createdAt = parseDate(cell("createdAt")) ?? now;

    prepared.push({
      rowNumber,
      phoneKey,
      lead: {
        name,
        phone: phoneRaw,
        email: email || undefined,
        status: coerceStatus(cell("status")),
        source: coerceSource(cell("source")),
        temperature: coerceTemperature(cell("temperature")),
        score: 0, // recomputed by the leads service on write
        budgetMin: parseAmount(cell("budgetMin")),
        budgetMax: parseAmount(cell("budgetMax")),
        requirement: cell("requirement") || undefined,
        projectId: projectName ? projectByName.get(projectName) : undefined,
        tags: tagsRaw
          ? tagsRaw
              .split(/[;|]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        createdAt,
        updatedAt: now,
      },
    });
  });

  return { prepared, errors, duplicatesInFile, duplicatesInDb };
}

export async function previewImport(
  csvText: string,
  mappingOverride?: Record<number, ImportField | "">,
  skipDuplicates = true,
): Promise<ImportPreview> {
  const { headers, rows } = parseCsv(csvText, detectDelimiter(csvText));

  if (headers.length === 0) throw new Error("That file has no header row.");
  if (rows.length === 0) throw new Error("That file has a header but no data rows.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`That file has ${rows.length} rows; the limit is ${MAX_ROWS} per import.`);
  }

  const mapping = mappingOverride ?? suggestMapping(headers);
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const missing = REQUIRED_FIELDS.filter((f) => !mapped.has(f));

  if (missing.length > 0) {
    return {
      headers,
      sample: rows.slice(0, SAMPLE_SIZE),
      mapping,
      totalRows: rows.length,
      valid: 0,
      duplicatesInFile: 0,
      duplicatesInDb: 0,
      errors: [
        {
          row: 1,
          message: `Map a column to ${missing.map((f) => FIELD_LABELS[f]).join(" and ")} before importing.`,
        },
      ],
    };
  }

  const { prepared, errors, duplicatesInFile, duplicatesInDb } = await prepare(
    headers,
    rows,
    mapping,
    skipDuplicates,
  );

  return {
    headers,
    sample: rows.slice(0, SAMPLE_SIZE),
    mapping,
    totalRows: rows.length,
    valid: prepared.length,
    duplicatesInFile,
    duplicatesInDb,
    errors,
  };
}

/**
 * Commit the import. Every created lead runs through the distribution rules,
 * so imported leads get an owner the same way manually-created ones do.
 */
export async function commitImport(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  skipDuplicates = true,
): Promise<ImportResult> {
  const { headers, rows } = parseCsv(csvText, detectDelimiter(csvText));

  if (headers.length === 0) throw new Error("That file has no header row.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`That file has ${rows.length} rows; the limit is ${MAX_ROWS} per import.`);
  }

  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const missing = REQUIRED_FIELDS.filter((f) => !mapped.has(f));
  if (missing.length > 0) {
    throw new Error(`Map a column to ${missing.map((f) => FIELD_LABELS[f]).join(" and ")} first.`);
  }

  const { prepared, errors } = await prepare(headers, rows, mapping, skipDuplicates);

  // One batched write for the whole file, then one batched assignment pass —
  // autoAssignMany loads the rule set and workload snapshot once instead of
  // per lead. Row-level errors are reported without failing the import.
  let saved: Lead[] = [];
  try {
    saved = await db.leads.createMany(
      prepared.map((item) => ({ ...item.lead, score: scoreImported(item.lead) })),
    );
  } catch (e) {
    throw new Error(
      `Could not save the imported leads: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  }

  const assignments = await autoAssignMany(saved);
  for (const [leadId, ownerId] of assignments) {
    await db.leads.update(leadId, { ownerId });
  }

  return { created: saved.length, skipped: rows.length - saved.length, errors };
}

/**
 * Lightweight score for imported leads, mirroring the weighting the leads
 * service uses: contactability, stated budget, and a declared project interest.
 */
function scoreImported(lead: Omit<Lead, "id">): number {
  let score = 10;
  if (lead.email) score += 15;
  if (lead.budgetMax || lead.budgetMin) score += 20;
  if (lead.projectId) score += 15;
  if (lead.requirement) score += 10;
  if (lead.temperature === "HOT") score += 25;
  else if (lead.temperature === "WARM") score += 10;
  return Math.max(0, Math.min(100, score));
}
