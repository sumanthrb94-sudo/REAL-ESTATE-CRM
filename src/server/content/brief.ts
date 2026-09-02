// A creative brief: the handful of facts every piece of marketing for a
// project is built from, derived once from CRM data.
//
// Templates never touch Project or Unit directly. They read this shape, so a
// change to how inventory is stored is absorbed here rather than in five
// slide layouts and a video composition.

import { db } from "@/server/db";
import { formatMoney, resolveMarket, type Market } from "./market";
import type { Project, Unit } from "@/types/domain";

export interface CreativeBrief {
  projectId: string;
  name: string;
  developer: string;
  /** "Gachibowli, Hyderabad" or just the city when there is no locality. */
  location: string;
  city: string;
  status: Project["status"];
  description?: string;
  reraId?: string;
  /** "RERA P02400001234" / "DLD 12345" — regulator named by the market. Absent without an id. */
  registrationLabel?: string;
  market: Market;
  /** Distinct configurations on offer, in a sensible order: 2BHK, 3BHK… */
  unitTypes: string[];
  /** Lowest base price among units still available, or undefined if sold out. */
  priceFrom?: number;
  /** Ready for a headline: "₹88.00 L" / "₹1.38 Cr". */
  priceFromLabel?: string;
  /** Largest carpet area on offer, for "up to 1,450 sq ft" lines. */
  carpetMax?: number;
  availableCount: number;
  totalUnits: number;
  /** Up to six, in the order the project lists them. */
  amenities: string[];
  hasInventory: boolean;
}

/** Orders "2BHK" before "3BHK" before "4BHK", with anything else after. */
function unitTypeRank(type: string): number {
  const m = /^(\d+)/.exec(type);
  return m ? Number(m[1]) : 99;
}

/**
 * "RERA P024…" — unless the stored id already starts with the regulator's
 * name ("RERA/TG/2026/AGR/001"), in which case it is shown as is.
 */
function registrationLabel(id: string | undefined, market: Market): string | undefined {
  if (!id) return undefined;
  const regulator = market.regulator ?? "Reg.";
  return id.toUpperCase().startsWith(regulator.toUpperCase()) ? id : `${regulator} ${id}`;
}

/**
 * Pure derivation, so it can be tested without a database.
 *
 * Price comes only from units still AVAILABLE — advertising a "from" price
 * that belongs to a sold unit is the kind of claim that draws a RERA
 * complaint.
 */
export function deriveBrief(project: Project, units: Unit[], market: Market = resolveMarket()): CreativeBrief {
  const available = units.filter((u) => u.status === "AVAILABLE");
  const priceFrom = available.length ? Math.min(...available.map((u) => u.basePrice)) : undefined;
  const carpetMax = units.length ? Math.max(...units.map((u) => u.carpetArea)) : undefined;

  const unitTypes = [...new Set(units.map((u) => u.type.trim()).filter(Boolean))].sort(
    (a, b) => unitTypeRank(a) - unitTypeRank(b) || a.localeCompare(b),
  );

  return {
    projectId: project.id,
    name: project.name,
    developer: project.developer ?? "Independent",
    location: project.locality ? `${project.locality}, ${project.city}` : project.city,
    city: project.city,
    status: project.status,
    description: project.description,
    reraId: project.reraId,
    registrationLabel: registrationLabel(project.reraId, market),
    market,
    unitTypes,
    priceFrom,
    priceFromLabel: priceFrom !== undefined ? formatMoney(priceFrom, market) : undefined,
    carpetMax,
    availableCount: available.length,
    totalUnits: units.length,
    amenities: project.amenities.slice(0, 6),
    hasInventory: units.length > 0,
  };
}

export async function buildCreativeBrief(projectId: string): Promise<CreativeBrief | null> {
  const project = await db.projects.find(projectId);
  if (!project) return null;
  const units = await db.units.list({ where: { projectId } });
  return deriveBrief(project, units);
}

/** Merge variables for message templates, so {{price_from}} etc. resolve. */
export function briefVariables(brief: CreativeBrief): Record<string, string> {
  return {
    project: brief.name,
    developer: brief.developer,
    location: brief.location,
    city: brief.city,
    price_from: brief.priceFromLabel ?? "",
    unit_types: brief.unitTypes.join(" & "),
    rera: brief.reraId ?? "",
    registration: brief.registrationLabel ?? "",
  };
}
