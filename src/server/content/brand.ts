// Visual tokens for generated marketing creative.
//
// Kept separate from the app's UI theme on purpose: a carousel slide and a
// CRM dashboard have different jobs, and the app's Tailwind tokens are not
// available inside the image renderer or a HyperFrames composition anyway.
// Change these to rebrand every generated asset at once.

export const BRAND = {
  /** Deep slate ground that makes white type and the accent read on a phone. */
  ground: "#0e1116",
  groundAlt: "#161a21",
  ink: "#ffffff",
  inkMuted: "#a5b0be",
  inkFaint: "#6b7684",
  /** One accent, used sparingly — rules, eyebrows, a single highlighted figure. */
  accent: "#4fc3cd",
  accentDeep: "#0e7c86",
  /** Font family name as registered with the image renderer (see fonts.ts). */
  fontFamily: "Plex",
  /** Footer line on every slide. */
  handle: "@modcon.developers",
  cta: "DM us to book a site visit",
} as const;

export type Brand = typeof BRAND;
