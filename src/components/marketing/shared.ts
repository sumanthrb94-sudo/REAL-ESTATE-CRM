// EstateCRM Marketing — client-safe shared helpers and constants.
// Pure module (no "use client", no server imports) so it can be consumed by both
// the marketing service layer and client widgets without bundling the data layer.

import type { CampaignChannel, CampaignStatus, Lead } from "@/types/domain";
import { fieldLabel, humanize } from "@/lib/utils";

// ─── Merge tags ─────────────────────────────────────────────────────────────
export const MERGE_TAGS = ["name", "project", "date", "phone"] as const;
export type MergeTag = (typeof MERGE_TAGS)[number];

export type MergeVars = Partial<Record<MergeTag, string>>;

export const SAMPLE_MERGE_VARS: Record<MergeTag, string> = {
  name: "Rahul Agarwal",
  project: "Skyline Heights",
  date: "21 Jun 2026, 11:00 AM",
  phone: "+91 98200 10001",
};

/** Replace {{tag}} placeholders in a template body with the supplied values. */
export function renderPreview(body: string, vars: MergeVars = SAMPLE_MERGE_VARS): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, tag: string) => {
    const value = (vars as Record<string, string | undefined>)[tag];
    return value ?? match;
  });
}

/** Extract the distinct merge tags used in a template body. */
export function extractMergeTags(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const tag = m[1];
    if (tag) found.add(tag);
  }
  return [...found];
}

// ─── Channels & statuses ────────────────────────────────────────────────────
export const CAMPAIGN_CHANNELS: CampaignChannel[] = ["EMAIL", "SMS", "WHATSAPP", "MULTICHANNEL"];
export const TEMPLATE_CHANNELS: CampaignChannel[] = ["EMAIL", "SMS", "WHATSAPP"];
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "PAUSED"];

/** Allowed campaign status transitions (DRAFT→SCHEDULED→RUNNING→COMPLETED/PAUSED). */
export const STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["SCHEDULED", "RUNNING"],
  SCHEDULED: ["RUNNING", "DRAFT"],
  RUNNING: ["PAUSED", "COMPLETED"],
  PAUSED: ["RUNNING", "COMPLETED"],
  COMPLETED: [],
};

// ─── Segment builder fields & operators ─────────────────────────────────────
export const SEGMENT_OPS = ["eq", "in", "gte", "lte", "contains"] as const;
export type SegmentOp = (typeof SEGMENT_OPS)[number];

/** Lead fields that segments are allowed to filter on. */
export const FILTERABLE_LEAD_FIELDS = [
  "name", "email", "phone", "status", "source", "temperature", "score",
  "budgetMin", "budgetMax", "requirement", "projectId", "ownerId",
  "channelPartnerId", "campaignId", "tags",
] as const satisfies readonly (keyof Lead)[];
export type FilterableLeadField = (typeof FILTERABLE_LEAD_FIELDS)[number];

export function isFilterableLeadField(field: keyof Lead): field is FilterableLeadField {
  return (FILTERABLE_LEAD_FIELDS as readonly string[]).includes(field);
}

export interface SegmentFieldDef {
  field: FilterableLeadField;
  label: string;
  kind: "string" | "number" | "enum" | "array";
  /** Suggested values shown as a hint in the builder. */
  options?: string[];
}

export const SEGMENT_FIELDS: SegmentFieldDef[] = [
  { field: "status", label: "Status", kind: "enum", options: ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT_SCHEDULED", "SITE_VISIT_DONE", "NEGOTIATION", "BOOKED", "LOST"] },
  { field: "source", label: "Source", kind: "enum", options: ["INSTAGRAM", "WEBSITE", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING", "FACEBOOK", "GOOGLE_ADS", "WALK_IN", "REFERRAL", "CHANNEL_PARTNER", "CALL_CENTER", "OTHER"] },
  { field: "temperature", label: "Temperature", kind: "enum", options: ["HOT", "WARM", "COLD"] },
  { field: "score", label: "Score", kind: "number" },
  { field: "budgetMin", label: "Budget Min (₹)", kind: "number" },
  { field: "budgetMax", label: "Budget Max (₹)", kind: "number" },
  { field: "name", label: "Name", kind: "string" },
  { field: "email", label: "Email", kind: "string" },
  { field: "requirement", label: "Requirement", kind: "string" },
  { field: "projectId", label: "Project ID", kind: "string" },
  { field: "tags", label: "Tags", kind: "array" },
];

export const OP_LABELS: Record<SegmentOp, string> = {
  eq: "equals",
  in: "is one of",
  gte: "is at least",
  lte: "is at most",
  contains: "contains",
};

export type FilterValue = string | number | boolean | (string | number)[];

/**
 * Convert a raw builder input string into the typed value stored on a
 * SegmentFilter, based on the operator and the field's kind.
 */
export function parseFilterValue(field: FilterableLeadField, op: SegmentOp, raw: string): FilterValue {
  const def = SEGMENT_FIELDS.find((f) => f.field === field);
  if (op === "in") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (op === "gte" || op === "lte" || def?.kind === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

/** Human-readable rendering of a filter value (for chips & summaries). */
export function formatFilterValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value == null) return "—";
  return String(value);
}

/** Fields whose values are rupee amounts and should be formatted as such. */
const CURRENCY_FIELDS: ReadonlySet<string> = new Set(["budgetMin", "budgetMax"]);

/**
 * Render a whole filter as a sentence for the segment chips.
 *
 * These chips used to read "Budgetmax is at least 20000000" — the raw field
 * name run through title-casing, and an unformatted integer. Field labels now
 * come from SEGMENT_FIELDS, enum values are humanized, and rupee amounts go
 * through formatINR.
 */
export function describeFilter(
  filter: { field: string; op: SegmentOp; value: unknown },
  formatCurrency: (n: number) => string,
): string {
  const def = SEGMENT_FIELDS.find((f) => f.field === filter.field);
  const label = def?.label ?? fieldLabel(filter.field);

  const renderOne = (v: unknown): string => {
    if (CURRENCY_FIELDS.has(filter.field) && typeof v === "number") return formatCurrency(v);
    // Enum values are stored as SCREAMING_SNAKE; show them the way the rest of
    // the UI does.
    if (def?.kind === "enum" && typeof v === "string") return humanize(v);
    return String(v);
  };

  const value = Array.isArray(filter.value)
    ? filter.value.map(renderOne).join(", ")
    : filter.value == null
      ? "—"
      : renderOne(filter.value);

  return `${label} ${OP_LABELS[filter.op]} ${value}`;
}
