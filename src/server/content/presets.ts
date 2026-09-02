// Output sizes for generated creative, named for where they are used.
//
// Each platform publishes its own specs and they drift; these are the 2026
// recommendations. A preset is the whole contract for one destination, so
// adding a new placement is one line here, not a change to any template.

export interface OutputPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Where this size is accepted. Shown in the studio so people pick right. */
  use: string;
}

export const IMAGE_PRESETS = {
  IG_PORTRAIT: {
    id: "IG_PORTRAIT",
    label: "Instagram carousel · 4:5",
    width: 1080,
    height: 1350,
    use: "Instagram feed and carousel (up to 20 slides). Best engagement of the three IG ratios.",
  },
  IG_SQUARE: {
    id: "IG_SQUARE",
    label: "Instagram square · 1:1",
    width: 1080,
    height: 1080,
    use: "Instagram feed and carousel when a square crop is needed.",
  },
  GOOGLE_LANDSCAPE: {
    id: "GOOGLE_LANDSCAPE",
    label: "Google Ads landscape · 1.91:1",
    width: 1200,
    height: 628,
    use: "Responsive Display Ads — required landscape asset.",
  },
  GOOGLE_SQUARE: {
    id: "GOOGLE_SQUARE",
    label: "Google Ads square · 1:1",
    width: 1200,
    height: 1200,
    use: "Responsive Display Ads — required square asset.",
  },
  GOOGLE_PORTRAIT: {
    id: "GOOGLE_PORTRAIT",
    label: "Google Ads portrait · 4:5",
    width: 1200,
    height: 1500,
    use: "Responsive Display Ads — optional portrait asset for extra placements.",
  },
} as const satisfies Record<string, OutputPreset>;

export type ImagePresetId = keyof typeof IMAGE_PRESETS;

export const DEFAULT_IMAGE_PRESET: ImagePresetId = "IG_PORTRAIT";

export const REEL_PRESET: OutputPreset = {
  id: "IG_REEL",
  label: "Instagram Reel · 9:16",
  width: 1080,
  height: 1920,
  use: "Reels and Stories. MP4, H.264 + AAC, 30 fps.",
};

export function isImagePresetId(value: string): value is ImagePresetId {
  return value in IMAGE_PRESETS;
}
