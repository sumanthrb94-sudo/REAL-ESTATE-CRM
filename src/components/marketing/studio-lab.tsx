"use client";

// The Studio's generation panels: ad copy and images, each one button press,
// each result shown in place. Nothing here fires on page load.

import { useState, useTransition } from "react";
import { Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateAdCopyAction, generateImageAction, generateNarrationAction, type GeneratedImage } from "@/server/media/actions";
import type { AdCopyResult, NarrationResult } from "@/server/ai/copy";

function SourceBadge({ source, model, rejected }: { source: "ai" | "template"; model?: string; rejected?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={source === "ai" ? "success" : "muted"}>{source === "ai" ? `AI · ${model}` : "template"}</Badge>
      {rejected ? <span className="text-xs text-warning">{rejected}</span> : null}
    </span>
  );
}

export function CopyLab({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [copy, setCopy] = useState<AdCopyResult | null>(null);
  const [narration, setNarration] = useState<NarrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      await fn();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canWrite || pending}
          onClick={() =>
            run(async () => {
              const r = await generateAdCopyAction(projectId);
              if (r.ok) setCopy(r);
              else setError(r.error);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Write ad copy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canWrite || pending}
          onClick={() =>
            run(async () => {
              const r = await generateNarrationAction(projectId);
              if (r.ok) setNarration(r);
              else setError(r.error);
            })
          }
        >
          <Sparkles className="h-4 w-4" /> Rewrite narration
        </Button>
        {!canWrite ? <span className="self-center text-xs text-muted-foreground">Needs marketing.write</span> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {narration ? (
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">Narration</span>
            <SourceBadge source={narration.source} model={narration.model} rejected={narration.rejected} />
          </div>
          <ol className="space-y-1">
            {narration.cues.map((c) => (
              <li key={c.scene} className="flex gap-3">
                <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{c.start.toFixed(1)}s</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {copy ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">Instagram</span>
              <SourceBadge source={copy.source} model={copy.model} rejected={copy.rejected} />
            </div>
            <p className="font-medium">{copy.copy.hook}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{copy.copy.instagram.caption}</p>
            <p className="mt-2 text-xs text-primary">{copy.copy.instagram.hashtags.join(" ")}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="mb-2 font-medium">Google responsive display</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Headlines · 30</p>
            <ul className="mb-2 list-disc pl-5">
              {copy.copy.google.headlines.map((h) => (
                <li key={h}>
                  {h} <span className="text-xs text-muted-foreground">({h.length})</span>
                </li>
              ))}
            </ul>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Long headline · 90</p>
            <p className="mb-2">{copy.copy.google.longHeadline}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Descriptions · 90</p>
            <ul className="list-disc pl-5">
              {copy.copy.google.descriptions.map((d) => (
                <li key={d}>
                  {d} <span className="text-xs text-muted-foreground">({d.length})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ImageLab({
  projectId,
  defaultPrompt,
  canWrite,
  configured,
}: {
  projectId: string;
  defaultPrompt: string;
  canWrite: boolean;
  configured: boolean;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspect, setAspect] = useState("4:5");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={1500}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={aspect}
          onChange={(e) => setAspect(e.target.value)}
        >
          <option value="4:5">4:5 · Instagram portrait</option>
          <option value="1:1">1:1 · square</option>
          <option value="9:16">9:16 · Reel background</option>
          <option value="16:9">16:9 · Google landscape</option>
        </select>
        <Button
          type="button"
          size="sm"
          disabled={!canWrite || !configured || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await generateImageAction({ projectId, prompt, aspect });
              if (r.ok) setImage(r);
              else setError(r.error);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Generate image
        </Button>
        {!configured ? (
          <span className="text-xs text-muted-foreground">Set NVIDIA_API_KEY (free at build.nvidia.com) to enable.</span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {image ? (
        <figure className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt="Generated" width={image.width} height={image.height} className="max-h-[520px] w-auto rounded-md border border-border" />
          <figcaption className="text-xs text-muted-foreground">
            {image.provider} · {image.model} · {image.width}×{image.height} · seed {image.seed ?? 0} · right-click to save
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
