// GET /api/content/voiceover/:projectId            → narration script (JSON)
// GET /api/content/voiceover/:projectId?format=mp3 → synthesised narration
//
// The script is always available. Audio needs VOICE_DRIVER=elevenlabs and an
// API key; without them the route says so with a 503 rather than shipping a
// silent file that looks like a finished asset.

import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/server/auth/rbac";
import { getSessionUser } from "@/server/auth/session";
import { buildCreativeBrief } from "@/server/content/brief";
import { isVoiceoverEnabled, narrationText, reelNarration, synthesizeNarration, voiceConfig } from "@/server/content/voiceover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const cues = reelNarration(brief);
  const text = narrationText(cues);
  const format = request.nextUrl.searchParams.get("format") ?? "script";
  const slug = brief.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (format === "script") {
    const { driver, voiceId, modelId } = voiceConfig();
    return NextResponse.json(
      { project: brief.name, language: brief.market.language, driver, voiceId, modelId, cues, text },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  if (format !== "mp3") {
    return NextResponse.json({ error: `Unknown format "${format}". Use script or mp3.` }, { status: 400 });
  }
  if (!isVoiceoverEnabled()) {
    return NextResponse.json(
      { error: "Voiceover is not configured. Set VOICE_DRIVER=elevenlabs and ELEVENLABS_API_KEY.", cues },
      { status: 503 },
    );
  }

  const { audio, contentType } = await synthesizeNarration(text);
  return new NextResponse(audio, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${slug}-vo.mp3"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
