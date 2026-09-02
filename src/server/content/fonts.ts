// Fonts for the image renderer.
//
// Satori (behind next/og) cannot use a Google Fonts stylesheet: it needs the
// raw TTF bytes for every weight it draws. IBM Plex Sans is vendored under
// public/fonts (SIL Open Font License) and read once per process.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface FontDescriptor {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: "normal";
}

const FONT_DIR = join(process.cwd(), "public", "fonts");

const FILES: Array<{ file: string; weight: FontDescriptor["weight"] }> = [
  { file: "IBMPlexSans-Regular.ttf", weight: 400 },
  { file: "IBMPlexSans-SemiBold.ttf", weight: 600 },
  { file: "IBMPlexSans-Bold.ttf", weight: 700 },
];

let cache: Promise<FontDescriptor[]> | undefined;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** The three Plex weights, loaded once and shared by every render. */
export function loadFonts(family = "Plex"): Promise<FontDescriptor[]> {
  cache ??= Promise.all(
    FILES.map(async ({ file, weight }) => ({
      name: family,
      data: toArrayBuffer(await readFile(join(FONT_DIR, file))),
      weight,
      style: "normal" as const,
    })),
  );
  return cache;
}
