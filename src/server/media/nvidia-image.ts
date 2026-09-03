// Images from NVIDIA NIM: FLUX.1 and Stable Diffusion 3.5 on a free developer key.
//
// build.nvidia.com hands out an `nvapi-` key with a pool of free credits and a
// rate limit of roughly forty requests a minute; there is no per-token bill on
// that tier. Generation endpoints are model-specific, unlike the chat surface,
// so the URL is built from the model slug. The response carries the image as
// base64 either under `image` (FLUX) or `artifacts[0].base64` (SD).

import { ASPECT_SIZES, type ImageProvider, type ImageRequest, type ImageResult } from "./types";

export type EnvLike = Record<string, string | undefined>;

const GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";

/** Slugs known to work on the hosted free tier. Override with MEDIA_IMAGE_MODEL. */
export const NVIDIA_IMAGE_MODELS = {
  "flux.1-schnell": { path: "black-forest-labs/flux.1-schnell", steps: 4 },
  "flux.1-dev": { path: "black-forest-labs/flux.1-dev", steps: 30 },
  "stable-diffusion-3.5-large": { path: "stabilityai/stable-diffusion-3.5-large", steps: 30 },
} as const;

export type NvidiaImageModel = keyof typeof NVIDIA_IMAGE_MODELS;

export function isNvidiaImageModel(value: string | undefined): value is NvidiaImageModel {
  return value !== undefined && Object.prototype.hasOwnProperty.call(NVIDIA_IMAGE_MODELS, value);
}

export function nvidiaImageConfig(env: EnvLike = process.env): { apiKey?: string; model: NvidiaImageModel } {
  return {
    apiKey: env.NVIDIA_API_KEY || undefined,
    model: isNvidiaImageModel(env.MEDIA_IMAGE_MODEL) ? env.MEDIA_IMAGE_MODEL : "flux.1-schnell",
  };
}

export function createNvidiaImageProvider(env: EnvLike = process.env): ImageProvider {
  const { apiKey, model } = nvidiaImageConfig(env);
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not set.");
  const spec = NVIDIA_IMAGE_MODELS[model];

  return {
    name: "nvidia",
    model,
    async generateImage(request: ImageRequest, options = {}): Promise<ImageResult> {
      const { width, height } = ASPECT_SIZES[request.aspect];
      const seed = request.seed ?? 0;
      const doFetch = options.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
      try {
        const response = await doFetch(`${GENAI_BASE}/${spec.path}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: request.prompt,
            width,
            height,
            steps: spec.steps,
            seed,
            ...(model === "flux.1-schnell" ? {} : { cfg_scale: 3.5 }),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`NVIDIA returned ${response.status}: ${detail.slice(0, 300)}`);
        }
        const data = (await response.json()) as {
          image?: string;
          artifacts?: Array<{ base64?: string; seed?: number }>;
        };
        const b64 = data.image ?? data.artifacts?.[0]?.base64;
        if (!b64) throw new Error("NVIDIA returned no image data.");
        const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
        const mimeType = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : "image/png";
        return {
          bytes,
          mimeType,
          width,
          height,
          model,
          provider: "nvidia",
          seed: data.artifacts?.[0]?.seed ?? seed,
          estimatedCostUsd: 0,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
