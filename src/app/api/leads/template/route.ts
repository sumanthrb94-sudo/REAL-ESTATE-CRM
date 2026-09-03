// GET /api/leads/template — the one sheet every channel can be poured into.
//
// Served as CSV rather than .xlsx because every spreadsheet program opens it,
// the header text is exactly what the importer's auto-mapper recognises, and
// a file saved from it needs no mapping step at all.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { TEMPLATE_COLUMNS, templateCsv } from "@/lib/import-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!can(user.role, "lead.write")) {
    return NextResponse.json({ error: "You do not have permission to import leads." }, { status: 403 });
  }

  // ?guide=1 returns the same columns with their help text, for the docs panel.
  if (new URL(request.url).searchParams.get("guide") === "1") {
    return NextResponse.json({ columns: TEMPLATE_COLUMNS });
  }

  // A BOM keeps Excel from mangling the rupee sign and Indian names.
  return new NextResponse("﻿" + templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estatecrm-lead-template.csv"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
