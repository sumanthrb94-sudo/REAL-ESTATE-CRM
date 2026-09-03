"use server";

// Studio server actions: copy and images on demand, behind marketing.write.
//
// Generation is never triggered by a page render. Each action is a button
// press by someone allowed to spend the company's quota, recorded in the
// ledger, and returned to the client as data it can show or save.

import { can } from "@/server/auth/rbac";
import { getSessionUser } from "@/server/auth/session";
import { writeAdCopy, writeNarration, type AdCopyResult, type NarrationResult } from "@/server/ai/copy";
import { isLlmEnabled, llmConfig } from "@/server/ai/llm";
import { buildCreativeBrief } from "@/server/content/brief";
import { BudgetExceededError, withLedger } from "./ledger";
import { createNvidiaImageProvider, nvidiaImageConfig } from "./nvidia-image";
import type { MediaAspect } from "./types";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const NO_PERMISSION = "You do not have permission to generate marketing assets.";

export async function generateAdCopyAction(projectId: string): Promise<Result<AdCopyResult>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in required." };
  if (!can(user.role, "marketing.write")) return { ok: false, error: NO_PERMISSION };
  const brief = await buildCreativeBrief(projectId);
  if (!brief) return { ok: false, error: "Project not found." };
  if (!isLlmEnabled()) {
    const result = await writeAdCopy(brief);
    return { ok: true, ...result };
  }
  try {
    const config = llmConfig();
    const result = await withLedger(
      { kind: "copy", provider: config.provider, model: config.model, prompt: `ad-copy:${projectId}`, projectId, userId: user.id },
      async () => ({ ...(await writeAdCopy(brief)), estimatedCostUsd: 0 }),
    );
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Copy generation failed." };
  }
}

export async function generateNarrationAction(projectId: string, language?: string): Promise<Result<NarrationResult>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in required." };
  if (!can(user.role, "marketing.write")) return { ok: false, error: NO_PERMISSION };
  const brief = await buildCreativeBrief(projectId);
  if (!brief) return { ok: false, error: "Project not found." };
  if (!isLlmEnabled()) {
    const result = await writeNarration(brief, { language });
    return { ok: true, ...result };
  }
  try {
    const config = llmConfig();
    const result = await withLedger(
      { kind: "copy", provider: config.provider, model: config.model, prompt: `narration:${projectId}:${language ?? "en"}`, projectId, userId: user.id },
      async () => ({ ...(await writeNarration(brief, { language })), estimatedCostUsd: 0 }),
    );
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Narration generation failed." };
  }
}

const ASPECTS: MediaAspect[] = ["1:1", "4:5", "9:16", "16:9"];

export interface GeneratedImage {
  dataUrl: string;
  width: number;
  height: number;
  model: string;
  provider: string;
  seed?: number;
}

export async function generateImageAction(input: {
  projectId: string;
  prompt: string;
  aspect: string;
  seed?: number;
}): Promise<Result<GeneratedImage>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in required." };
  if (!can(user.role, "marketing.write")) return { ok: false, error: NO_PERMISSION };
  const prompt = input.prompt.trim();
  if (prompt.length < 8 || prompt.length > 1500) return { ok: false, error: "Prompt must be 8 to 1500 characters." };
  const aspect = ASPECTS.includes(input.aspect as MediaAspect) ? (input.aspect as MediaAspect) : "4:5";
  if (!nvidiaImageConfig().apiKey) {
    return { ok: false, error: "Image generation is not configured. Set NVIDIA_API_KEY (free at build.nvidia.com)." };
  }
  try {
    const provider = createNvidiaImageProvider();
    const image = await withLedger(
      {
        kind: "image",
        provider: provider.name,
        model: provider.model,
        prompt,
        projectId: input.projectId,
        userId: user.id,
        extra: { aspect, seed: input.seed ?? 0 },
      },
      () => provider.generateImage({ prompt, aspect, seed: input.seed, projectId: input.projectId }),
    );
    const dataUrl = `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`;
    return { ok: true, dataUrl, width: image.width, height: image.height, model: image.model, provider: image.provider, seed: image.seed };
  } catch (error) {
    if (error instanceof BudgetExceededError) return { ok: false, error: error.message };
    return { ok: false, error: error instanceof Error ? error.message : "Image generation failed." };
  }
}
