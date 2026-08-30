// EstateCRM — inventory service.
// Projects, towers and units: listing, availability rollups and status mutations.
// All inputs are validated with zod; pages and server actions consume this module.

import { z } from "zod";
import { db } from "@/server/db";
import {
  PROJECT_STATUSES,
  UNIT_STATUSES,
  type Project,
  type Tower,
  type Unit,
  type UnitStatus,
} from "@/types/domain";

// Re-exported from types/domain, which is a pure module — client components
// (the tower manager) need these without pulling firebase-admin into the bundle.
export { PROJECT_STATUSES, UNIT_STATUSES } from "@/types/domain";

// ─── Schemas ────────────────────────────────────────────────────────────────
export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  developer: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(2, "City is required"),
  locality: z.string().trim().min(1).max(120).optional(),
  status: z.enum(PROJECT_STATUSES),
  description: z.string().trim().min(1).max(2000).optional(),
  amenities: z.array(z.string().trim().min(1)).max(40).default([]),
  reraId: z.string().trim().min(1).max(60).optional(),
  coverImage: z.string().trim().url("Cover image must be a valid URL").optional(),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

const projectFilterSchema = z.object({
  city: z.string().trim().min(1).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  q: z.string().trim().min(1).optional(),
});
export type ProjectFilter = z.input<typeof projectFilterSchema>;

const unitFilterSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  towerId: z.string().trim().min(1).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  type: z.string().trim().min(1).optional(),
});
export type UnitFilter = z.input<typeof unitFilterSchema>;

const unitStatusSchema = z.enum(UNIT_STATUSES);

// ─── Result shapes ──────────────────────────────────────────────────────────
export interface ProjectSummary {
  project: Project;
  totalUnits: number;
  availableUnits: number;
  availableValue: number;
  totalValue: number;
}

export interface FloorGroup {
  floor: number;
  units: Unit[];
}

export interface TowerGroup {
  tower: Tower;
  floors: FloorGroup[];
  unitCount: number;
}

export interface StatusBreakdown {
  status: UnitStatus;
  count: number;
  value: number;
}

export interface ProjectDetail {
  project: Project;
  towers: TowerGroup[];
  /** Units not assigned to any tower (rare, but the schema allows it). */
  unassignedUnits: Unit[];
  breakdown: StatusBreakdown[];
  totalUnits: number;
  totalValue: number;
}

export interface ProjectInventoryStats {
  projectId: string;
  projectName: string;
  byStatus: Record<UnitStatus, { count: number; value: number }>;
  totalUnits: number;
  totalValue: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function emptyBreakdown(): Record<UnitStatus, { count: number; value: number }> {
  return {
    AVAILABLE: { count: 0, value: 0 },
    BLOCKED: { count: 0, value: 0 },
    BOOKED: { count: 0, value: 0 },
    SOLD: { count: 0, value: 0 },
  };
}

function groupUnitsByProject(units: Unit[]): Map<string, Unit[]> {
  const map = new Map<string, Unit[]>();
  for (const unit of units) {
    const bucket = map.get(unit.projectId);
    if (bucket) bucket.push(unit);
    else map.set(unit.projectId, [unit]);
  }
  return map;
}

// ─── Projects ───────────────────────────────────────────────────────────────
export async function listProjects(filter: ProjectFilter = {}): Promise<ProjectSummary[]> {
  const f = projectFilterSchema.parse(filter);
  const [projects, units] = await Promise.all([
    db.projects.list({ orderBy: { field: "createdAt", dir: "asc" } }),
    db.units.list(),
  ]);
  const unitsByProject = groupUnitsByProject(units);

  return projects
    .filter((p) => {
      if (f.city && p.city.toLowerCase() !== f.city.toLowerCase()) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        const haystack = `${p.name} ${p.developer ?? ""} ${p.locality ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .map((project) => {
      const projectUnits = unitsByProject.get(project.id) ?? [];
      const available = projectUnits.filter((u) => u.status === "AVAILABLE");
      return {
        project,
        totalUnits: projectUnits.length,
        availableUnits: available.length,
        availableValue: available.reduce((sum, u) => sum + u.basePrice, 0),
        totalValue: projectUnits.reduce((sum, u) => sum + u.basePrice, 0),
      };
    });
}

/** Distinct project cities, for filter dropdowns. */
export async function listProjectCities(): Promise<string[]> {
  const projects = await db.projects.list();
  return [...new Set(projects.map((p) => p.city))].sort();
}

export async function getProject(id: string): Promise<Project | null> {
  return db.projects.find(id);
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const project = await db.projects.find(id);
  if (!project) return null;

  const [towers, units] = await Promise.all([
    db.towers.list({ where: { projectId: id }, orderBy: { field: "name", dir: "asc" } }),
    db.units.list({ where: { projectId: id } }),
  ]);

  const unitsByTower = new Map<string, Unit[]>();
  const unassignedUnits: Unit[] = [];
  for (const unit of units) {
    if (!unit.towerId) {
      unassignedUnits.push(unit);
      continue;
    }
    const bucket = unitsByTower.get(unit.towerId);
    if (bucket) bucket.push(unit);
    else unitsByTower.set(unit.towerId, [unit]);
  }

  const towerGroups: TowerGroup[] = towers.map((tower) => {
    const towerUnits = unitsByTower.get(tower.id) ?? [];
    const floorMap = new Map<number, Unit[]>();
    for (const unit of towerUnits) {
      const bucket = floorMap.get(unit.floor);
      if (bucket) bucket.push(unit);
      else floorMap.set(unit.floor, [unit]);
    }
    const floors: FloorGroup[] = [...floorMap.entries()]
      .map(([floor, floorUnits]) => ({
        floor,
        units: [...floorUnits].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber)),
      }))
      .sort((a, b) => b.floor - a.floor);
    return { tower, floors, unitCount: towerUnits.length };
  });

  const byStatus = emptyBreakdown();
  for (const unit of units) {
    byStatus[unit.status].count += 1;
    byStatus[unit.status].value += unit.basePrice;
  }
  const breakdown: StatusBreakdown[] = UNIT_STATUSES.map((status) => ({
    status,
    count: byStatus[status].count,
    value: byStatus[status].value,
  }));

  return {
    project,
    towers: towerGroups,
    unassignedUnits,
    breakdown,
    totalUnits: units.length,
    totalValue: units.reduce((sum, u) => sum + u.basePrice, 0),
  };
}

export async function createProject(input: unknown): Promise<Project> {
  const data = projectInputSchema.parse(input);
  const now = new Date().toISOString();
  return db.projects.create({ ...data, createdAt: now, updatedAt: now });
}

export async function updateProject(id: string, patch: unknown): Promise<Project> {
  const data = projectInputSchema.partial().parse(patch);
  const updated = await db.projects.update(id, { ...data, updatedAt: new Date().toISOString() });
  if (!updated) throw new Error("Project not found");
  return updated;
}

// ─── Units ──────────────────────────────────────────────────────────────────
export async function listUnits(filter: UnitFilter = {}): Promise<Unit[]> {
  const f = unitFilterSchema.parse(filter);
  return db.units.list({
    where: {
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.towerId ? { towerId: f.towerId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.type ? { type: f.type } : {}),
    },
    orderBy: { field: "unitNumber", dir: "asc" },
  });
}

export async function updateUnitStatus(id: string, status: unknown): Promise<Unit> {
  const parsed = unitStatusSchema.parse(status);
  const unit = await db.units.find(id);
  if (!unit) throw new Error("Unit not found");
  const updated = await db.units.update(id, { status: parsed });
  if (!updated) throw new Error("Unit not found");
  return updated;
}

// ─── Towers ─────────────────────────────────────────────────────────────────
export const towerInputSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required"),
  name: z.string().trim().min(1, "Tower name is required").max(60),
  floors: z.coerce
    .number({ invalid_type_error: "Floors must be a number" })
    .int("Floors must be a whole number")
    .min(1, "A tower needs at least 1 floor")
    .max(200, "200 floors is the maximum"),
});
export type TowerInput = z.infer<typeof towerInputSchema>;

export async function createTower(input: unknown): Promise<Tower> {
  const data = towerInputSchema.parse(input);

  const project = await db.projects.find(data.projectId);
  if (!project) throw new Error("Project not found");

  const existing = await db.towers.list({ where: { projectId: data.projectId } });
  if (existing.some((t) => t.name.toLowerCase() === data.name.toLowerCase())) {
    throw new Error(`This project already has a tower called “${data.name}”.`);
  }

  return db.towers.create(data);
}

export async function updateTower(id: string, patch: unknown): Promise<Tower> {
  const data = towerInputSchema.partial().omit({ projectId: true }).parse(patch);
  const tower = await db.towers.find(id);
  if (!tower) throw new Error("Tower not found");

  if (data.name && data.name.toLowerCase() !== tower.name.toLowerCase()) {
    const siblings = await db.towers.list({ where: { projectId: tower.projectId } });
    if (siblings.some((t) => t.id !== id && t.name.toLowerCase() === data.name!.toLowerCase())) {
      throw new Error(`This project already has a tower called “${data.name}”.`);
    }
  }

  // Shrinking a tower below its occupied floors would orphan those units.
  if (data.floors != null) {
    const units = await db.units.list({ where: { towerId: id } });
    const highest = units.reduce((max, u) => Math.max(max, u.floor), 0);
    if (data.floors < highest) {
      throw new Error(
        `Cannot reduce to ${data.floors} floors — units exist up to floor ${highest}. Delete those units first.`,
      );
    }
  }

  const updated = await db.towers.update(id, data);
  if (!updated) throw new Error("Tower not found");
  return updated;
}

/** Delete a tower and every unit in it. Refuses when any unit is spoken for. */
export async function deleteTower(id: string): Promise<{ deletedUnits: number }> {
  const tower = await db.towers.find(id);
  if (!tower) throw new Error("Tower not found");

  const units = await db.units.list({ where: { towerId: id } });
  const committed = units.filter((u) => u.status === "BOOKED" || u.status === "SOLD");
  if (committed.length > 0) {
    throw new Error(
      `Cannot delete ${tower.name}: ${committed.length} unit(s) are booked or sold. Cancel those bookings first.`,
    );
  }

  for (const unit of units) await db.units.delete(unit.id);
  await db.towers.delete(id);
  return { deletedUnits: units.length };
}

// ─── Unit creation ──────────────────────────────────────────────────────────
export const unitInputSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required"),
  towerId: z.string().trim().min(1, "Tower is required"),
  unitNumber: z.string().trim().min(1, "Unit number is required").max(30),
  floor: z.coerce.number().int().min(0, "Floor cannot be negative").max(200),
  type: z.string().trim().min(1, "Unit type is required").max(30),
  carpetArea: z.coerce.number().min(1, "Carpet area must be greater than zero").max(100_000),
  builtUpArea: z.coerce.number().min(0).max(200_000).optional(),
  facing: z.string().trim().max(30).optional(),
  basePrice: z.coerce.number().min(0, "Price cannot be negative").max(100_000_000_000),
  status: z.enum(UNIT_STATUSES).default("AVAILABLE"),
});
export type UnitInput = z.infer<typeof unitInputSchema>;

async function assertUnitNumberFree(projectId: string, unitNumber: string, exceptId?: string) {
  const siblings = await db.units.list({ where: { projectId } });
  const clash = siblings.find(
    (u) => u.id !== exceptId && u.unitNumber.toLowerCase() === unitNumber.toLowerCase(),
  );
  if (clash) throw new Error(`Unit “${unitNumber}” already exists in this project.`);
}

export async function createUnit(input: unknown): Promise<Unit> {
  const data = unitInputSchema.parse(input);

  const tower = await db.towers.find(data.towerId);
  if (!tower) throw new Error("Tower not found");
  if (tower.projectId !== data.projectId) throw new Error("That tower belongs to a different project.");
  if (data.floor > tower.floors) {
    throw new Error(`${tower.name} has ${tower.floors} floors — floor ${data.floor} is out of range.`);
  }

  await assertUnitNumberFree(data.projectId, data.unitNumber);
  return db.units.create({ ...data, createdAt: new Date().toISOString() });
}

export async function updateUnit(id: string, patch: unknown): Promise<Unit> {
  const data = unitInputSchema.partial().omit({ projectId: true, towerId: true }).parse(patch);
  const unit = await db.units.find(id);
  if (!unit) throw new Error("Unit not found");

  if (data.unitNumber && data.unitNumber.toLowerCase() !== unit.unitNumber.toLowerCase()) {
    await assertUnitNumberFree(unit.projectId, data.unitNumber, id);
  }

  const updated = await db.units.update(id, data);
  if (!updated) throw new Error("Unit not found");
  return updated;
}

export async function deleteUnit(id: string): Promise<void> {
  const unit = await db.units.find(id);
  if (!unit) throw new Error("Unit not found");
  if (unit.status === "BOOKED" || unit.status === "SOLD") {
    throw new Error(`Unit ${unit.unitNumber} is ${unit.status.toLowerCase()} — cancel the booking first.`);
  }
  await db.units.delete(id);
}

// ─── Bulk generation ────────────────────────────────────────────────────────
export const bulkUnitsSchema = z
  .object({
    towerId: z.string().trim().min(1, "Tower is required"),
    fromFloor: z.coerce.number().int().min(0).max(200),
    toFloor: z.coerce.number().int().min(0).max(200),
    unitsPerFloor: z.coerce
      .number()
      .int()
      .min(1, "At least 1 unit per floor")
      .max(20, "20 units per floor is the maximum"),
    type: z.string().trim().min(1, "Unit type is required").max(30),
    carpetArea: z.coerce.number().min(1, "Carpet area must be greater than zero"),
    builtUpArea: z.coerce.number().min(0).optional(),
    facing: z.string().trim().max(30).optional(),
    /** Price per sq ft of carpet area; basePrice = rate x carpetArea. */
    ratePerSqFt: z.coerce.number().min(1, "Rate must be greater than zero"),
  })
  .refine((v) => v.toFloor >= v.fromFloor, {
    message: "The last floor must be the same as or above the first floor",
    path: ["toFloor"],
  });
export type BulkUnitsInput = z.infer<typeof bulkUnitsSchema>;

/**
 * Generate a floor grid in one go: the usual way a tower's inventory gets
 * entered. Unit numbers follow the local convention `<Tower><Floor><NN>` —
 * e.g. tower "A", floor 12, second unit becomes "A-1202".
 *
 * Refuses entirely if any generated number would collide, rather than
 * creating a partial grid the user then has to unpick.
 */
export async function bulkCreateUnits(input: unknown): Promise<{ created: number }> {
  const data = bulkUnitsSchema.parse(input);

  const tower = await db.towers.find(data.towerId);
  if (!tower) throw new Error("Tower not found");
  if (data.toFloor > tower.floors) {
    throw new Error(`${tower.name} has ${tower.floors} floors — floor ${data.toFloor} is out of range.`);
  }

  const prefix = tower.name.replace(/^tower\s+/i, "").trim() || tower.name;
  const existing = await db.units.list({ where: { projectId: tower.projectId } });
  const taken = new Set(existing.map((u) => u.unitNumber.toLowerCase()));

  const planned: Array<Omit<Unit, "id">> = [];
  const clashes: string[] = [];
  const now = new Date().toISOString();

  for (let floor = data.fromFloor; floor <= data.toFloor; floor++) {
    for (let n = 1; n <= data.unitsPerFloor; n++) {
      const unitNumber = `${prefix}-${floor}${String(n).padStart(2, "0")}`;
      if (taken.has(unitNumber.toLowerCase())) {
        clashes.push(unitNumber);
        continue;
      }
      taken.add(unitNumber.toLowerCase());
      planned.push({
        projectId: tower.projectId,
        towerId: tower.id,
        unitNumber,
        floor,
        type: data.type,
        carpetArea: data.carpetArea,
        builtUpArea: data.builtUpArea,
        facing: data.facing,
        basePrice: Math.round(data.carpetArea * data.ratePerSqFt),
        status: "AVAILABLE",
        createdAt: now,
      });
    }
  }

  if (clashes.length > 0) {
    const shown = clashes.slice(0, 5).join(", ");
    throw new Error(
      `${clashes.length} unit number(s) already exist (${shown}${clashes.length > 5 ? "…" : ""}). ` +
        "Nothing was created — pick a different floor range or rename the tower.",
    );
  }
  if (planned.length === 0) throw new Error("That range produced no units.");

  for (const unit of planned) await db.units.create(unit);
  return { created: planned.length };
}

// ─── Stats ──────────────────────────────────────────────────────────────────
/** Available / blocked / booked / sold counts & value, per project. */
export async function getInventoryStats(): Promise<ProjectInventoryStats[]> {
  const [projects, units] = await Promise.all([
    db.projects.list({ orderBy: { field: "name", dir: "asc" } }),
    db.units.list(),
  ]);
  const unitsByProject = groupUnitsByProject(units);

  return projects.map((project) => {
    const projectUnits = unitsByProject.get(project.id) ?? [];
    const byStatus = emptyBreakdown();
    for (const unit of projectUnits) {
      byStatus[unit.status].count += 1;
      byStatus[unit.status].value += unit.basePrice;
    }
    return {
      projectId: project.id,
      projectName: project.name,
      byStatus,
      totalUnits: projectUnits.length,
      totalValue: projectUnits.reduce((sum, u) => sum + u.basePrice, 0),
    };
  });
}
