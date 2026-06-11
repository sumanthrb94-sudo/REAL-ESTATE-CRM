// EstateCRM — inventory service.
// Projects, towers and units: listing, availability rollups and status mutations.
// All inputs are validated with zod; pages and server actions consume this module.

import { z } from "zod";
import { db } from "@/server/db";
import type { Project, ProjectStatus, Tower, Unit, UnitStatus } from "@/types/domain";

export const PROJECT_STATUSES = [
  "UPCOMING",
  "ONGOING",
  "READY_TO_MOVE",
  "SOLD_OUT",
] as const satisfies readonly ProjectStatus[];

export const UNIT_STATUSES = [
  "AVAILABLE",
  "BLOCKED",
  "BOOKED",
  "SOLD",
] as const satisfies readonly UnitStatus[];

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
