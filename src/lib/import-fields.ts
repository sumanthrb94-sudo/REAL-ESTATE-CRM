// EstateCRM — importable lead fields.
//
// A pure module with no server imports, so the client-side import wizard can
// use these without dragging the data layer (and `next/headers`) into the
// browser bundle. The server-side importer re-exports them.

/** Lead fields an imported CSV column can be mapped onto. */
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
