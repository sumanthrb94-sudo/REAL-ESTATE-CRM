// GET /api/content/carousel/:projectId/:slide?preset=IG_PORTRAIT
//
// One carousel slide as a PNG, rendered on demand from live CRM data. The
// same URL is what an Instagram or Google Ads connector would hand to the
// platform later — both require a publicly fetchable image URL rather than
// an upload — so these are stable, cacheable, and carry no session state in
// the path.

import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/server/auth/rbac";
import { getSessionUser } from "@/server/auth/session";
import { buildCreativeBrief } from "@/server/content/brief";
import { renderSlide, SLIDE_COUNT } from "@/server/content/carousel";
import { DEFAULT_IMAGE_PRESET, isImagePresetId } from "@/server/content/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; slide: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!can(user.role, "marketing.read")) {
    return NextResponse.json({ error: "You do not have permission to view marketing creative." }, { status: 403 });
  }

  const { projectId, slide } = await params;
  const index = Number(slide);
  if (!Number.isInteger(index) || index < 0 || index >= SLIDE_COUNT) {
    return NextResponse.json({ error: `Slide must be 0–${SLIDE_COUNT - 1}.` }, { status: 400 });
  }

  const presetParam = request.nextUrl.searchParams.get("preset") ?? DEFAULT_IMAGE_PRESET;
  if (!isImagePresetId(presetParam)) {
    return NextResponse.json({ error: `Unknown preset "${presetParam}".` }, { status: 400 });
  }

  const brief = await buildCreativeBrief(projectId);
  if (!brief) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const image = await renderSlide(brief, index, presetParam);
  // Slides change whenever inventory does; a short private cache keeps the
  // studio snappy without serving a stale price to a connector.
  image.headers.set("Cache-Control", "private, max-age=60");
  image.headers.set(
    "Content-Disposition",
    `inline; filename="${brief.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${presetParam.toLowerCase()}-${index + 1}.png"`,
  );
  return image;
}
