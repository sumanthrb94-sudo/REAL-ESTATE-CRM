// POST|GET /api/cron/distribute — the morning distribution run.
//
// Point a Vercel Cron at this once each working morning and every lead that
// arrived overnight has an owner before the team signs in. The route is not
// session-authenticated because a scheduler has no session; it is guarded by a
// shared secret instead, and refuses outright when that secret is unset so a
// misconfigured deployment fails closed rather than exposing a write endpoint.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { distributeUnassigned } from "@/server/modules/distribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time compare so the secret cannot be guessed a character at a time. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set; the scheduled distribution is disabled." },
      { status: 503 },
    );
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const result = await distributeUnassigned();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
