import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an integer amount of INR into a compact crore/lakh string. */
export function formatINR(amount?: number | null): string {
  if (amount == null) return "—";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Renders a budget range in the form a salesperson would say it.
 *
 * Interpolating two formatINR calls produced "— – ₹90.00 L" for every lead
 * with only one bound — which is most imported leads, since a CSV usually
 * carries a single budget figure rather than a range.
 */
export function formatBudgetRange(min?: number | null, max?: number | null): string {
  if (min != null && max != null) {
    return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
  }
  if (max != null) return `Up to ${formatINR(max)}`;
  if (min != null) return `${formatINR(min)}+`;
  return "—";
}

export function formatNumber(n?: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN");
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Words the default title-casing gets wrong. Keyed by the lowercased token so
 * "SMS" doesn't come out as "Sms" and "WhatsApp" doesn't lose its capital A.
 */
const WORD_OVERRIDES: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  rera: "RERA",
  bhk: "BHK",
  kyc: "KYC",
  crm: "CRM",
  id: "ID",
  ads: "Ads",
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  emi: "EMI",
  roi: "ROI",
};

/**
 * Humanize an ENUM_LIKE token into "Enum Like", respecting the acronyms and
 * brand names in WORD_OVERRIDES.
 */
export function humanize(token?: string | null): string {
  if (!token) return "—";
  return token
    .toLowerCase()
    .split("_")
    .map((w) => WORD_OVERRIDES[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Turn a camelCase or snake_case field name into a label: `budgetMax` becomes
 * "Budget max", `lastContactAt` becomes "Last contact at".
 */
export function fieldLabel(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  const words = spaced.split(" ").filter(Boolean);
  if (words.length === 0) return field;
  return words
    .map((w, i) => WORD_OVERRIDES[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}
