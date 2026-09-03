// EstateCRM — importable lead fields and the one template that feeds them.
//
// A pure module with no server imports, so the client-side import wizard can
// use these without dragging the data layer (and `next/headers`) into the
// browser bundle. The server-side importer re-exports them.

/** Lead fields an imported column can be mapped onto. */
export const IMPORT_FIELDS = [
  "name",
  "phone",
  "email",
  "source",
  "status",
  "temperature",
  "budgetMin",
  "budgetMax",
  "requirement",
  "projectName",
  "tags",
  "createdAt",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  source: "Source",
  status: "Stage",
  temperature: "Temperature",
  budgetMin: "Budget min (₹)",
  budgetMax: "Budget max (₹)",
  requirement: "Requirement",
  projectName: "Interested project",
  tags: "Tags (semicolon-separated)",
  createdAt: "Created date",
};

/** Only these two are required; everything else can be blank. */
export const REQUIRED_FIELDS: ImportField[] = ["name", "phone"];

/** A column index → lead field mapping, as produced by the import wizard. */
export type ImportMapping = Record<number, ImportField | "">;

// ─── The unified template ───────────────────────────────────────────────────

/**
 * One sheet that every channel can be poured into. The column order is the
 * order a salesperson thinks in, and the header text is exactly what the
 * auto-mapper recognises, so a file saved from this template needs no mapping
 * step at all.
 */
export const TEMPLATE_COLUMNS: { field: ImportField; header: string; help: string; example: string }[] = [
  { field: "name", header: "Name", help: "Required. Full name as given.", example: "Ravi Menon" },
  { field: "phone", header: "Phone", help: "Required. Any format; +91, spaces and dashes are fine.", example: "+91 98480 44556" },
  { field: "email", header: "Email", help: "Used as a second duplicate key when the phone differs.", example: "ravi@example.com" },
  { field: "source", header: "Source", help: "Meta, Instagram, WhatsApp, Website, 99acres, Walk-in, Referral, Channel partner, Hoarding…", example: "Instagram" },
  { field: "projectName", header: "Project", help: "Must match a project name in Inventory to link the lead.", example: "Agartha" },
  { field: "budgetMin", header: "Budget Min", help: "₹ figure. 85 L, 1.2 Cr and 8500000 all work.", example: "90 L" },
  { field: "budgetMax", header: "Budget Max", help: "Leave blank if only one figure is known.", example: "1.2 Cr" },
  { field: "requirement", header: "Requirement", help: "What they asked for. Merged as a new note on a repeat enquiry.", example: "3BHK, east facing, ready to move" },
  { field: "temperature", header: "Temperature", help: "Hot, Warm or Cold. Defaults to Warm.", example: "Hot" },
  { field: "status", header: "Stage", help: "Leave blank for New.", example: "New" },
  { field: "tags", header: "Tags", help: "Semicolon-separated. Campaign and ad names belong here.", example: "Agartha Launch; Carousel A" },
  { field: "createdAt", header: "Enquiry Date", help: "When they enquired. Blank means now.", example: "2026-08-30" },
];

/** The template as CSV text, header row plus one example row. */
export function templateCsv(): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    TEMPLATE_COLUMNS.map((c) => esc(c.header)).join(","),
    TEMPLATE_COLUMNS.map((c) => esc(c.example)).join(","),
  ].join("\r\n") + "\r\n";
}

// ─── Channel presets ────────────────────────────────────────────────────────

/**
 * What each channel's own export looks like, so the wizard can say "this is a
 * Meta lead-ads file" instead of leaving the user to recognise it. These are
 * hints for the operator, not parsing rules: mapping is always by header text.
 */
export interface ChannelPreset {
  id: string;
  label: string;
  /** Header names that identify the file as coming from this channel. */
  signature: string[];
  /** Source value applied to rows that carry no source column of their own. */
  defaultSource: string;
  note: string;
}

export const CHANNEL_PRESETS: ChannelPreset[] = [
  {
    id: "meta",
    label: "Meta lead ads (Facebook & Instagram)",
    signature: ["full_name", "phone_number", "created_time", "form_name"],
    defaultSource: "FACEBOOK",
    note: "Download from Meta Business Suite → Instant Forms → Download. Both .csv and .xlsx work as they come; the platform column decides Facebook or Instagram per row.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    signature: ["wa_id", "customer_name", "phone", "last_message"],
    defaultSource: "WHATSAPP",
    note: "Export contacts or a broadcast list from WhatsApp Business, or paste chat enquiries into the template's Name, Phone and Requirement columns.",
  },
  {
    id: "website",
    label: "Website form",
    signature: ["message", "submitted", "form", "page"],
    defaultSource: "WEBSITE",
    note: "Any form plugin export works. Map the message field to Requirement so the enquiry text is kept.",
  },
  {
    id: "portal",
    label: "Property portal (99acres, MagicBricks, Housing)",
    signature: ["lead_id", "posted_on", "listing", "property"],
    defaultSource: "PORTAL_99ACRES",
    note: "Portal exports vary; the auto-mapper handles the common column names and the source is read per row when the file names its portal.",
  },
  {
    id: "offline",
    label: "Offline: walk-in, hoarding, print, events",
    signature: [],
    defaultSource: "WALK_IN",
    note: "Use the template as-is. Put the campaign in Tags (\"Hoarding: ORR Exit 14\") so offline spend can be measured against bookings in Reports.",
  },
];
