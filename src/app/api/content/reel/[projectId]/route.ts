// GET /api/content/reel/:projectId?file=index.html
//
// The HyperFrames project for a 12-second Reel, one file per request. The
// caller drops these beside the assets served from /reel-kit and runs
// `npx hyperframes render`; rendering itself needs Chrome and FFmpeg, which
// is why it happens on a workstation or CI runner and not inside a Vercel
// function.

import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/server/auth/rbac";
import { getSessionUser } from "@/server/auth/session";
import { buildCreativeBrief } from "@/server/content/brief";
import { reelProjectFiles } from "@/server/content/reel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!can(user.role, "marketing.read")) {
    return NextResponse.json({ error: "You do not have permission to view marketing creative." }, { status: 403 });
  }

  const { projectId } = await params;
  const brief = await buildCreativeBrief(projectId);
  if (!brief) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const voiceover = request.nextUrl.searchParams.get("vo") === "1";
  const files = reelProjectFiles(brief, { voiceover });
  const name = request.nextUrl.searchParams.get("file") ?? "index.html";
  const body = files[name];
  if (body === undefined) {
    return NextResponse.json(
      { error: `Unknown file "${name}".`, files: Object.keys(files) },
      { status: 404 },
    );
  }

  const ext = name.slice(name.lastIndexOf("."));
  const slug = brief.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(body, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8",
      // Download rather than render: a composition opened directly in a
      // browser tab is a paused timeline with nothing to seek it.
      "Content-Disposition": `attachment; filename="${slug}-reel-${name}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
