// EstateCRM — lead import.
//
// Takes a CSV, maps its columns onto lead fields, validates every row, and
// reports exactly what would happen before anything is written. The same
// function runs the dry run and the real import, so the preview cannot
// disagree with the result.

import { db } from "@/server/db";
import { parseCsv, detectDelimiter } from "@/lib/csv";
import { readWorkbook, type Workbook } from "@/lib/spreadsheet";
import { autoAssignMany } from "@/server/modules/distribution";
import {
  CHANNEL_PRESETS,
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
  TEMPLATE_COLUMNS,
  CHANNEL_PRESETS,
  templateCsv,
  type ImportField,
  type ImportMapping,
} from "@/lib/import-fields";

/**
 * Header text we recognise automatically, so a typical export needs no manual
 * mapping. Matching is case- and punctuation-insensitive.
 */
const HEADER_HINTS: Record<ImportField, string[]> = {
  name: ["name", "fullname", "full name", "leadname", "customername", "contactname", "firstname", "full_name", "customer_name", "clientname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "whatsapp", "phone_number", "waid", "wa_id", "cell"],
  email: ["email", "emailaddress", "mail", "e-mail", "email_address"],
  source: ["source", "leadsource", "channel", "platform", "medium", "utmsource"],
  status: ["status", "stage", "leadstatus", "pipelinestage"],
  temperature: ["temperature", "temp", "priority", "quality"],
  budgetMin: ["budgetmin", "minbudget", "budgetfrom", "minimumbudget"],
  budgetMax: ["budgetmax", "maxbudget", "budgetto", "maximumbudget", "budget"],
  requirement: ["requirement", "requirements", "notes", "message", "comments", "enquiry", "remarks", "lastmessage", "query"],
  projectName: ["project", "projectname", "interestedproject", "property", "whichprojectareyouinterestedin"],
  tags: ["tags", "labels", "campaign", "adname", "adsetname", "campaignname", "formname"],
  createdAt: ["createdat", "created", "date", "createdtime", "submittedat", "timestamp", "postedon", "enquirydate"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Best-guess column → field mapping. Each field is claimed at most once.
 *
 * Exact header matches are resolved across the whole row before any fuzzy
 * match is considered. Column order would otherwise decide the outcome: a Meta
 * export puts `campaign_name` five columns ahead of `full_name`, and since
 * "campaignname" contains "name" the campaign column used to claim the Name
 * field and the actual name went unmapped — an import that looked fine and
 * filed every lead under its ad set.
 */
export function suggestMapping(headers: string[]): Record<number, ImportField | ""> {
  const mapping: Record<number, ImportField | ""> = {};
  const claimed = new Set<ImportField>();
  const normed = headers.map((h) => norm(h));

  headers.forEach((_, i) => (mapping[i] = ""));

  // Pass 1 — exact header text, anywhere in the row.
  normed.forEach((h, index) => {
    if (!h) return;
    const field = IMPORT_FIELDS.find(
      (f) => !claimed.has(f) && HEADER_HINTS[f].some((hint) => norm(hint) === h),
    );
    if (field) {
      claimed.add(field);
      mapping[index] = field;
    }
  });

  // Pass 2 — substring, longest hint first so "full_name" outranks "name".
  normed.forEach((h, index) => {
    if (!h || mapping[index]) return;
    let best: { field: ImportField; length: number } | null = null;
    for (const f of IMPORT_FIELDS) {
      if (claimed.has(f)) continue;
      for (const hint of HEADER_HINTS[f]) {
        const n = norm(hint);
        if (n && h.includes(n) && (!best || n.length > best.length)) best = { field: f, length: n.length };
      }
    }
    if (best) {
      claimed.add(best.field);
      mapping[index] = best.field;
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

/**
 * What to do when a row is already in the CRM.
 *
 * `merge` is the default because a repeat enquiry is information, not noise:
 * the same buyer coming back through a second channel is the strongest signal
 * the desk gets, and deleting it — which is what skipping quietly does — loses
 * the second source, the newer budget and the newer requirement.
 */
export type DuplicateStrategy = "merge" | "skip" | "create";

/** One planned merge, shown before it happens and applied unchanged after. */
export interface MergePlan {
  rowNumber: number;
  leadId: string;
  existingName: string;
  incomingName: string;
  phone: string;
  matchedOn: "phone" | "email";
  /** Human-readable summary of what this merge would change. */
  changes: string[];
  patch: Partial<Lead>;
  note: string;
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
  /** Every planned merge, so the user sees exactly what combining does. */
  merges: MergePlan[];
  errors: RowIssue[];
  /** Detected channel, when the headers identify one. */
  channel?: string;
  format?: string;
}

export interface ImportResult {
  created: number;
  merged: number;
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
  strategy: DuplicateStrategy,
  fileLabel = "an upload",
): Promise<{
  prepared: PreparedRow[];
  merges: MergePlan[];
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
  // Phone is the primary key; email is the fallback for the case where the
  // same buyer filled a form twice from two numbers, which portals produce
  // often enough to matter.
  const byPhone = new Map<string, Lead>();
  const byEmail = new Map<string, Lead>();
  for (const l of existingLeads) {
    const k = normalisePhone(l.phone);
    if (k) byPhone.set(k, l);
    if (l.email) byEmail.set(l.email.trim().toLowerCase(), l);
  }
  const projectByName = new Map(projects.map((p) => [p.name.toLowerCase().trim(), p.id]));

  const seenInFile = new Map<string, number>();
  const merges: MergePlan[] = [];
  // A file can name the same person twice; merge those into one patch rather
  // than applying two conflicting ones.
  const mergeByLeadId = new Map<string, MergePlan>();
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

    const email = cell("email");
    const projectName = cell("projectName").toLowerCase();
    const tagsRaw = cell("tags");
    const createdAt = parseDate(cell("createdAt")) ?? now;

    const incoming: Omit<Lead, "id"> = {
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
    };

    // Already seen in this same file?
    if (seenInFile.has(phoneKey)) {
      duplicatesInFile++;
      if (strategy !== "create") {
        const firstRow = seenInFile.get(phoneKey)!;
        const earlier = prepared.find((r) => r.rowNumber === firstRow);
        if (earlier) {
          // Fold the later row into the earlier one rather than dropping it.
          const folded = mergeLead(earlier.lead as Lead, incoming, fileLabel, rowNumber);
          Object.assign(earlier.lead, folded.patch);
        } else {
          // The earlier row merged into an existing lead; extend that plan.
          const existing = byPhone.get(phoneKey);
          const plan = existing ? mergeByLeadId.get(existing.id) : undefined;
          if (plan) extendPlan(plan, existing!, incoming, fileLabel, rowNumber);
        }
        return;
      }
    }

    // Already in the CRM?
    const match =
      byPhone.get(phoneKey) ?? (email ? byEmail.get(email.trim().toLowerCase()) : undefined);
    if (match) {
      duplicatesInDb++;
      if (strategy === "skip") return;
      if (strategy === "merge") {
        const existingPlan = mergeByLeadId.get(match.id);
        if (existingPlan) {
          extendPlan(existingPlan, match, incoming, fileLabel, rowNumber);
        } else {
          const matchedOn = byPhone.has(phoneKey) ? "phone" : "email";
          const plan = mergeLead(match, incoming, fileLabel, rowNumber, matchedOn);
          mergeByLeadId.set(match.id, plan);
          merges.push(plan);
        }
        seenInFile.set(phoneKey, rowNumber);
        return;
      }
    }

    seenInFile.set(phoneKey, rowNumber);
    prepared.push({ rowNumber, phoneKey, lead: incoming });
  });

  return { prepared, merges, errors, duplicatesInFile, duplicatesInDb };
}

// ─── Merging ────────────────────────────────────────────────────────────────

const TEMPERATURE_RANK: Record<LeadTemperature, number> = { COLD: 0, WARM: 1, HOT: 2 };

/**
 * Combine an incoming row into an existing lead without ever destroying what
 * is already known.
 *
 * Blank fields are filled, tags are unioned, the requirement is appended as a
 * new line, the budget widens to cover both figures and the temperature only
 * ever rises. Source and stage are left alone: the first touch keeps the
 * attribution, and an import must not drag a negotiating lead back to New.
 */
export function mergeLead(
  existing: Lead,
  incoming: Omit<Lead, "id">,
  fileLabel: string,
  rowNumber: number,
  matchedOn: "phone" | "email" = "phone",
): MergePlan {
  const patch: Partial<Lead> = {};
  const changes: string[] = [];

  // Matched by email on a number we have never seen: that second number is
  // the most useful thing in the row, and the lead carries only one phone
  // field, so it goes on the timeline where a caller will find it.
  const altPhone =
    normalisePhone(incoming.phone) &&
    normalisePhone(incoming.phone) !== normalisePhone(existing.phone)
      ? incoming.phone.trim()
      : "";
  if (altPhone) changes.push(`second number ${altPhone}`);

  if (!existing.email && incoming.email) {
    patch.email = incoming.email;
    changes.push(`email ${incoming.email}`);
  }
  if (!existing.projectId && incoming.projectId) {
    patch.projectId = incoming.projectId;
    changes.push("interested project");
  }

  const minA = existing.budgetMin, minB = incoming.budgetMin;
  const nextMin = minA != null && minB != null ? Math.min(minA, minB) : (minA ?? minB);
  if (nextMin != null && nextMin !== existing.budgetMin) {
    patch.budgetMin = nextMin;
    changes.push("budget floor");
  }
  const maxA = existing.budgetMax, maxB = incoming.budgetMax;
  const nextMax = maxA != null && maxB != null ? Math.max(maxA, maxB) : (maxA ?? maxB);
  if (nextMax != null && nextMax !== existing.budgetMax) {
    patch.budgetMax = nextMax;
    changes.push("budget ceiling");
  }

  if (TEMPERATURE_RANK[incoming.temperature] > TEMPERATURE_RANK[existing.temperature]) {
    patch.temperature = incoming.temperature;
    changes.push(`temperature ${existing.temperature} → ${incoming.temperature}`);
  }

  const newTags = incoming.tags.filter(
    (t) => !existing.tags.some((e) => e.toLowerCase() === t.toLowerCase()),
  );
  if (newTags.length) {
    patch.tags = [...existing.tags, ...newTags];
    changes.push(`${newTags.length} tag${newTags.length > 1 ? "s" : ""}`);
  }

  if (incoming.requirement && incoming.requirement !== existing.requirement) {
    patch.requirement = existing.requirement
      ? `${existing.requirement}\n${incoming.requirement}`
      : incoming.requirement;
    changes.push("requirement");
  }

  // The enquiry that came first is the one that dates the lead.
  if (incoming.createdAt < existing.createdAt) {
    patch.createdAt = incoming.createdAt;
    changes.push("earlier enquiry date");
  }

  // A second touch from a different channel is worth knowing about even when
  // no field changed, so it always counts as a change.
  const sourceIsNew = incoming.source !== existing.source;
  if (sourceIsNew) changes.push(`also via ${humanSource(incoming.source)}`);

  const nameDiffers = incoming.name.trim() && incoming.name.trim() !== existing.name.trim();
  const note =
    `Repeat enquiry via ${humanSource(incoming.source)} from ${fileLabel}, row ${rowNumber}` +
    (matchedOn === "email" ? ` (matched on email ${existing.email ?? incoming.email ?? ""})` : "") +
    "." +
    (nameDiffers ? ` Named "${incoming.name.trim()}" in that file.` : "") +
    (changes.length ? ` Combined: ${changes.join(", ")}.` : " Nothing new to combine.");

  return {
    rowNumber,
    leadId: existing.id,
    existingName: existing.name,
    incomingName: incoming.name,
    phone: existing.phone,
    matchedOn,
    changes,
    patch,
    note,
  };
}

/** Fold a further duplicate row into a plan that already exists for that lead. */
function extendPlan(
  plan: MergePlan,
  existing: Lead,
  incoming: Omit<Lead, "id">,
  fileLabel: string,
  rowNumber: number,
): void {
  const next = mergeLead({ ...existing, ...plan.patch } as Lead, incoming, fileLabel, rowNumber);
  Object.assign(plan.patch, next.patch);
  for (const c of next.changes) if (!plan.changes.includes(c)) plan.changes.push(c);
  plan.note += ` Also row ${rowNumber}.`;
}

function humanSource(s: LeadSource): string {
  return s.replace(/_/g, " ").toLowerCase();
}

export async function previewImport(
  csvText: string,
  mappingOverride?: Record<number, ImportField | "">,
  strategy: DuplicateStrategy = "merge",
  fileLabel = "an upload",
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
      merges: [],
      channel: detectChannel(headers),
      errors: [
        {
          row: 1,
          message: `Map a column to ${missing.map((f) => FIELD_LABELS[f]).join(" and ")} before importing.`,
        },
      ],
    };
  }

  const { prepared, merges, errors, duplicatesInFile, duplicatesInDb } = await prepare(
    headers,
    rows,
    mapping,
    strategy,
    fileLabel,
  );

  return {
    headers,
    sample: rows.slice(0, SAMPLE_SIZE),
    mapping,
    totalRows: rows.length,
    valid: prepared.length,
    duplicatesInFile,
    duplicatesInDb,
    merges,
    channel: detectChannel(headers),
    errors,
  };
}

/** Name the channel when the header row carries its fingerprint. */
export function detectChannel(headers: string[]): string | undefined {
  const set = new Set(headers.map((h) => norm(h)));
  for (const preset of CHANNEL_PRESETS) {
    if (!preset.signature.length) continue;
    const hits = preset.signature.filter((sig: string) => set.has(norm(sig))).length;
    if (hits >= 2) return preset.label;
  }
  return undefined;
}

/**
 * Commit the import. Every created lead runs through the distribution rules,
 * so imported leads get an owner the same way manually-created ones do.
 */
export async function commitImport(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  strategy: DuplicateStrategy = "merge",
  fileLabel = "an upload",
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

  const { prepared, merges, errors } = await prepare(headers, rows, mapping, strategy, fileLabel);

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

  // Apply the merges the preview promised, each with a note on the lead's
  // timeline so a repeat enquiry is visible to whoever calls them next.
  let merged = 0;
  for (const plan of merges) {
    try {
      const before = await db.leads.find(plan.leadId);
      if (!before) continue;
      const next = { ...before, ...plan.patch };
      await db.leads.update(plan.leadId, {
        ...plan.patch,
        score: scoreImported(next),
        updatedAt: new Date().toISOString(),
      });
      await db.activities.create({
        type: "NOTE",
        leadId: plan.leadId,
        subject: `Repeat enquiry combined from ${fileLabel}`,
        body: plan.note,
        completed: true,
        createdAt: new Date().toISOString(),
      });
      merged++;
    } catch (e) {
      errors.push({
        row: plan.rowNumber,
        message: `Could not combine with ${plan.existingName}: ${e instanceof Error ? e.message : "unknown error"}`,
      });
    }
  }

  return {
    created: saved.length,
    merged,
    skipped: Math.max(0, rows.length - saved.length - merged),
    errors,
  };
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
