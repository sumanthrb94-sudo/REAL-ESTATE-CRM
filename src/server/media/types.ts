// Generated media: the provider contract and the request shape.
//
// Providers differ in what they can make and what they cost; the Studio only
// ever talks to this interface. Aspect ratios are named after where the asset
// goes, so a provider maps them to whatever pixel sizes it supports.

export type MediaAspect = "1:1" | "4:5" | "9:16" | "16:9";

export interface ImageRequest {
  prompt: string;
  aspect: MediaAspect;
  /** Deterministic seed so a regenerate with the same prompt is the same image. */
  seed?: number;
  projectId?: string;
  purpose?: "hero" | "background" | "lifestyle";
}

export interface ImageResult {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  model: string;
  provider: string;
  seed?: number;
  /** List-price estimate; 0 on a free tier. */
  estimatedCostUsd: number;
}

export interface ImageProvider {
  readonly name: string;
  readonly model: string;
  generateImage(request: ImageRequest, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<ImageResult>;
}

/** Pixel sizes per aspect; multiples of 16 within what FLUX and SD3.5 accept. */
export const ASPECT_SIZES: Record<MediaAspect, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 896, height: 1120 },
  "9:16": { width: 768, height: 1344 },
  "16:9": { width: 1344, height: 768 },
};
