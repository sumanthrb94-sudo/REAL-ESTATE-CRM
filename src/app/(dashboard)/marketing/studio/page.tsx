// EstateCRM — /marketing/studio: generated creative for a project.
//
// Picks a project and shows the carousel slides and Reel kit the content
// engine derives from live inventory. Nothing here is designed by hand per
// post: change the project's amenities or price and every asset follows.

import Link from "next/link";
import { Clapperboard, Download, Images, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/server/auth/guard";
import { buildCreativeBrief } from "@/server/content/brief";
import { SLIDES, SLIDE_TITLES } from "@/server/content/carousel";
import { IMAGE_PRESETS, DEFAULT_IMAGE_PRESET, isImagePresetId, REEL_PRESET } from "@/server/content/presets";
import { REEL_KIT_FILES, REEL_DURATION_S } from "@/server/content/reel";
import { isVoiceoverEnabled, reelNarration, voiceConfig } from "@/server/content/voiceover";
import { listProjects } from "@/server/modules/inventory";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; preset?: string }>;
}) {
  const [, { project: projectParam, preset: presetParam }, projects] = await Promise.all([
    requirePermission("marketing.read"),
    searchParams,
    listProjects(),
  ]);

  const preset = presetParam && isImagePresetId(presetParam) ? presetParam : DEFAULT_IMAGE_PRESET;
  const selectedId = projectParam ?? projects[0]?.project.id;
  const brief = selectedId ? await buildCreativeBrief(selectedId) : null;
  const size = IMAGE_PRESETS[preset];

  const slideUrl = (i: number) => `/api/content/carousel/${selectedId}/${i}?preset=${preset}`;
  const voiceReady = isVoiceoverEnabled();
  const voice = voiceConfig();
  const cues = brief ? reelNarration(brief) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio"
        description="Carousels and Reels generated from live project data — no design tool, no stale prices."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Add a project under Inventory and its creative appears here."
          icon={<Images className="h-8 w-8" />}
        />
      ) : (
        <>
          {/* Project + preset pickers, as links so the page stays a server component. */}
          <div className="flex flex-wrap items-center gap-2">
            {projects.map(({ project: p }) => (
              <Link
                key={p.id}
                href={`/marketing/studio?project=${p.id}&preset=${preset}`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  p.id === selectedId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                {p.name}
              </Link>
            ))}
          </div>

          {brief ? (
            <>
              <Card>
                <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle>Carousel — {brief.name}</CardTitle>
                    <CardDescription>
                      {SLIDES.length} slides · {size.width}×{size.height} · {size.use}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(IMAGE_PRESETS).map((p) => (
                      <Link
                        key={p.id}
                        href={`/marketing/studio?project=${selectedId}&preset=${p.id}`}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium",
                          p.id === preset ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {!brief.hasInventory ? (
                    <p className="mb-4 text-sm text-warning">
                      This project has no units yet, so price and configuration slides show placeholders.
                      Add towers and units under Inventory to populate them.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {SLIDES.map((id, i) => (
                      <a
                        key={id}
                        href={slideUrl(i)}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex flex-col gap-1.5"
                        title={`Open slide ${i + 1} full size`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slideUrl(i)}
                          alt={`${brief.name} — ${SLIDE_TITLES[id]}`}
                          width={size.width}
                          height={size.height}
                          className="w-full rounded-md border border-border bg-muted transition-shadow group-hover:shadow-md"
                        />
                        <span className="text-xs text-muted-foreground">
                          {i + 1}. {SLIDE_TITLES[id]}
                        </span>
                      </a>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Right-click a slide to save it, or use the URL directly — an Instagram or Google Ads
                    connector needs a public image URL, which is exactly what each slide already is.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clapperboard className="h-5 w-5" /> Reel — {brief.name}
                  </CardTitle>
                  <CardDescription>
                    {REEL_DURATION_S}s · {REEL_PRESET.width}×{REEL_PRESET.height} · four scenes with motion, sound and narration,
                    rendered locally with HyperFrames.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {["index.html", "package.json", "hyperframes.json", "meta.json", "README.md"].map((f) => (
                      <a
                        key={f}
                        href={`/api/content/reel/${selectedId}?file=${f}${voiceReady ? "&vo=1" : ""}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <Download className="h-3.5 w-3.5" /> {f}
                      </a>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Assets (place under <code className="rounded bg-muted px-1">assets/</code>)</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {REEL_KIT_FILES.map((f) => (
                        <a
                          key={f}
                          href={`/reel-kit/${f}`}
                          download
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <Download className="h-3.5 w-3.5" /> {f}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Render on your machine (Node 22+, FFmpeg):</p>
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre">{`mkdir ${brief.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-reel && cd $_
# put index.html, package.json, hyperframes.json, meta.json here, assets/ beside them
npm run check      # 0 findings
npm run preview    # scrub it in the Studio
npm run render     # reel.mp4`}</pre>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Mic className="h-4 w-4" /> Narration
                      <Badge tone={voiceReady ? "success" : "muted"}>
                        {voiceReady ? `ElevenLabs · ${voice.modelId}` : "script only — set VOICE_DRIVER=elevenlabs"}
                      </Badge>
                    </p>
                    <ol className="mt-2 space-y-1 text-sm">
                      {cues.map((c) => (
                        <li key={c.scene} className="flex gap-3">
                          <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{c.start.toFixed(1)}s</span>
                          <span>{c.text}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/api/content/voiceover/${selectedId}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <Download className="h-3.5 w-3.5" /> script.json
                      </a>
                      {voiceReady ? (
                        <a
                          href={`/api/content/voiceover/${selectedId}?format=mp3`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <Download className="h-3.5 w-3.5" /> vo.mp3
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="muted">GSAP · local</Badge>
                    <Badge tone="muted">SFX · generated, no licence</Badge>
                    <Badge tone="muted">H.264 + AAC · 30 fps</Badge>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
