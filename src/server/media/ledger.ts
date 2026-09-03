// The generation ledger: every model call, counted and capped.
//
// Free tiers have no bill to read back and paid tiers publish no balance
// endpoint, so the only running total that exists is the one the app keeps.
// A generation is recorded even when it fails or is refused, which is what
// makes the monthly count honest.

import { createHash } from "node:crypto";
import { db } from "@/server/db";
import type { MediaGeneration, MediaKind } from "@/types/domain";

export type EnvLike = Record<string, string | undefined>;

export function promptHash(prompt: string, extra: Record<string, unknown> = {}): string {
  return createHash("sha256").update(JSON.stringify({ prompt, ...extra })).digest("hex").slice(0, 24);
}

/** Per-kind monthly caps, counted in generations, not dollars. */
export function monthlyCap(kind: MediaKind, env: EnvLike = process.env): number {
  const key = `MEDIA_MONTHLY_${kind.toUpperCase()}_CAP`;
  const raw = env[key];
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return { image: 200, video: 20, narration: 500, music: 100, copy: 1000 }[kind];
}

function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Rows this calendar month, all statuses, so refusals count against the cap too. */
export async function monthlyUsage(kind?: MediaKind, now = new Date()): Promise<MediaGeneration[]> {
  const since = monthStart(now);
  const rows = await db.mediaGenerations.list();
  return rows.filter((r) => r.createdAt >= since && (!kind || r.kind === kind));
}

export interface UsageSummary {
  kind: MediaKind;
  used: number;
  cap: number;
  remaining: number;
  estimatedCostUsd: number;
}

export async function usageSummary(env: EnvLike = process.env, now = new Date()): Promise<UsageSummary[]> {
  const rows = await monthlyUsage(undefined, now);
  const kinds: MediaKind[] = ["image", "video", "narration", "music", "copy"];
  return kinds.map((kind) => {
    const mine = rows.filter((r) => r.kind === kind);
    const cap = monthlyCap(kind, env);
    return {
      kind,
      used: mine.length,
      cap,
      remaining: Math.max(0, cap - mine.length),
      estimatedCostUsd: mine.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0),
    };
  });
}

export class BudgetExceededError extends Error {
  constructor(kind: MediaKind, cap: number) {
    super(`Monthly ${kind} cap of ${cap} reached. Raise MEDIA_MONTHLY_${kind.toUpperCase()}_CAP or wait for next month.`);
    this.name = "BudgetExceededError";
  }
}

export interface RecordInput {
  kind: MediaKind;
  provider: string;
  model: string;
  prompt: string;
  projectId?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Run a generation under the cap. The row is written first as a refusal or a
 * failure placeholder and settled afterwards, so an interrupted call still
 * counts.
 */
export async function withLedger<T extends { estimatedCostUsd: number }>(
  input: RecordInput,
  run: () => Promise<T>,
  env: EnvLike = process.env,
): Promise<T> {
  const cap = monthlyCap(input.kind, env);
  const used = (await monthlyUsage(input.kind)).length;
  const base = {
    kind: input.kind,
    provider: input.provider,
    model: input.model,
    prompt: input.prompt.slice(0, 2000),
    promptHash: promptHash(input.prompt, input.extra),
    projectId: input.projectId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  };
  if (used >= cap) {
    await db.mediaGenerations.create({ ...base, status: "refused", estimatedCostUsd: 0, durationMs: 0, error: "cap" });
    throw new BudgetExceededError(input.kind, cap);
  }
  const started = Date.now();
  try {
    const result = await run();
    await db.mediaGenerations.create({ ...base, status: "done", estimatedCostUsd: result.estimatedCostUsd, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    await db.mediaGenerations.create({
      ...base,
      status: "failed",
      estimatedCostUsd: 0,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error),
    });
    throw error;
  }
}
