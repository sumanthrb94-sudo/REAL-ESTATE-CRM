// Carousel slides, rendered to PNG by next/og (Satori).
//
// Satori is not a browser: it draws a subset of CSS. Every element with more
// than one child must be display:flex, there is no grid, no external
// stylesheet, and text only renders in fonts passed as TTF bytes. The
// templates below stay inside that subset on purpose (note: "Life at {name}"
// is TWO text nodes to Satori and needs a template literal), and the sizes come from
// presets so one layout serves Instagram and Google Ads placements alike.

import { ImageResponse } from "next/og";
import { BRAND } from "./brand";
import type { CreativeBrief } from "./brief";
import { loadFonts } from "./fonts";
import { formatArea } from "./market";
import { DEFAULT_IMAGE_PRESET, IMAGE_PRESETS, type ImagePresetId } from "./presets";

/** Slides in the order they are published. */
export const SLIDES = ["cover", "location", "homes", "amenities", "cta"] as const;
export type SlideId = (typeof SLIDES)[number];
export const SLIDE_COUNT = SLIDES.length;

export const SLIDE_TITLES: Record<SlideId, string> = {
  cover: "Cover",
  location: "Location",
  homes: "Homes & price",
  amenities: "Amenities",
  cta: "Call to action",
};

type Style = React.CSSProperties;

/** Everything scales off the shorter edge so a 1200×628 banner is not a 1080×1350 slide squeezed. */
function scale(preset: ImagePresetId) {
  const { width, height } = IMAGE_PRESETS[preset];
  const short = Math.min(width, height);
  const wide = width > height;
  return {
    width,
    height,
    wide,
    pad: Math.round(short * 0.074),
    eyebrow: Math.round(short * 0.026),
    display: Math.round(short * (wide ? 0.13 : 0.118)),
    h2: Math.round(short * 0.082),
    body: Math.round(short * 0.036),
    small: Math.round(short * 0.028),
    rule: Math.max(4, Math.round(short * 0.008)),
  };
}

const eyebrow = (s: ReturnType<typeof scale>): Style => ({
  fontSize: s.eyebrow,
  letterSpacing: s.eyebrow * 0.18,
  textTransform: "uppercase",
  color: BRAND.accent,
  fontWeight: 600,
});

const footer = (s: ReturnType<typeof scale>, brief: CreativeBrief, index: number): React.ReactNode => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: s.small,
      color: BRAND.inkFaint,
    }}
  >
    <span>{BRAND.handle}</span>
    <span style={{ display: "flex", gap: s.small * 0.6 }}>
      {SLIDES.map((_, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: i === index ? s.small * 1.6 : s.small * 0.5,
            height: s.small * 0.5,
            borderRadius: s.small,
            background: i === index ? BRAND.accent : BRAND.inkFaint,
          }}
        />
      ))}
    </span>
    <span>{brief.registrationLabel ?? brief.developer}</span>
  </div>
);

function frame(s: ReturnType<typeof scale>, children: React.ReactNode, foot: React.ReactNode): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: s.pad,
        background: BRAND.ground,
        color: BRAND.ink,
        fontFamily: BRAND.fontFamily,
      }}
    >
      {children}
      {foot}
    </div>
  );
}

function cover(brief: CreativeBrief, s: ReturnType<typeof scale>, i: number) {
  return frame(
    s,
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1 }}>
      <div style={eyebrow(s)}>{brief.developer}</div>
      <div style={{ fontSize: s.display, fontWeight: 700, lineHeight: 1.0, marginTop: s.body * 0.5 }}>
        {brief.name}
      </div>
      <div style={{ display: "block", width: s.pad * 1.6, height: s.rule, background: BRAND.accent, marginTop: s.body }} />
      <div style={{ fontSize: s.body, color: BRAND.inkMuted, marginTop: s.body * 0.8, lineHeight: 1.35 }}>
        {brief.unitTypes.length ? `${brief.unitTypes.join(" & ")} homes in ${brief.location}` : `Now launching in ${brief.location}`}
      </div>
    </div>,
    footer(s, brief, i),
  );
}

function location(brief: CreativeBrief, s: ReturnType<typeof scale>, i: number) {
  return frame(
    s,
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
      <div style={eyebrow(s)}>Where</div>
      <div style={{ fontSize: s.h2, fontWeight: 700, lineHeight: 1.05, marginTop: s.body * 0.5 }}>
        {brief.location}
      </div>
      {brief.description ? (
        <div style={{ fontSize: s.body, color: BRAND.inkMuted, marginTop: s.body, lineHeight: 1.4, maxWidth: s.width - s.pad * 2 }}>
          {brief.description}
        </div>
      ) : null}
    </div>,
    footer(s, brief, i),
  );
}

function homes(brief: CreativeBrief, s: ReturnType<typeof scale>, i: number) {
  const rows: Array<[string, string]> = [];
  if (brief.unitTypes.length) rows.push(["Configurations", brief.unitTypes.join(" · ")]);
  if (brief.carpetMax) rows.push(["Carpet area up to", formatArea(brief.carpetMax, brief.market)]);
  if (brief.availableCount) rows.push(["Available now", `${brief.availableCount} of ${brief.totalUnits} homes`]);
  return frame(
    s,
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
      <div style={eyebrow(s)}>{brief.priceFromLabel ? "Starting from" : "Homes"}</div>
      {brief.priceFromLabel ? (
        <div style={{ fontSize: s.display, fontWeight: 700, lineHeight: 1.0, marginTop: s.body * 0.5 }}>
          {brief.priceFromLabel}
        </div>
      ) : (
        <div style={{ fontSize: s.h2, fontWeight: 700, lineHeight: 1.05, marginTop: s.body * 0.5 }}>
          Pricing on request
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginTop: s.body * 1.2, gap: s.small * 0.9 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: s.body, borderTop: `1px solid ${BRAND.inkFaint}`, paddingTop: s.small * 0.7 }}>
            <span style={{ color: BRAND.inkMuted }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>,
    footer(s, brief, i),
  );
}

function amenities(brief: CreativeBrief, s: ReturnType<typeof scale>, i: number) {
  const list = brief.amenities.length ? brief.amenities : ["Details on request"];
  return frame(
    s,
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
      <div style={eyebrow(s)}>{`Life at ${brief.name}`}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: s.body * 0.8, gap: s.small * 0.6 }}>
        {list.map((a) => (
          <div key={a} style={{ display: "flex", alignItems: "center", gap: s.small, fontSize: s.wide ? s.body : s.h2 * 0.62, fontWeight: 600 }}>
            <span style={{ display: "block", width: s.small * 0.55, height: s.small * 0.55, borderRadius: s.small, background: BRAND.accent }} />
            <span>{a}</span>
          </div>
        ))}
      </div>
    </div>,
    footer(s, brief, i),
  );
}

function cta(brief: CreativeBrief, s: ReturnType<typeof scale>, i: number) {
  return frame(
    s,
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
      <div style={eyebrow(s)}>{`Visit ${brief.name}`}</div>
      <div style={{ fontSize: s.h2, fontWeight: 700, lineHeight: 1.05, marginTop: s.body * 0.5 }}>
        {BRAND.cta}
      </div>
      <div style={{ fontSize: s.body, color: BRAND.inkMuted, marginTop: s.body, lineHeight: 1.4 }}>
        {brief.priceFromLabel ? `${brief.location} · from ${brief.priceFromLabel}` : brief.location}
      </div>
      <div style={{ display: "flex", marginTop: s.body * 1.4 }}>
        <div style={{ display: "flex", padding: `${s.small}px ${s.body}px`, borderRadius: s.small * 0.5, background: BRAND.accent, color: BRAND.ground, fontSize: s.body, fontWeight: 700 }}>
          {BRAND.handle}
        </div>
      </div>
    </div>,
    footer(s, brief, i),
  );
}

const RENDERERS: Record<SlideId, (b: CreativeBrief, s: ReturnType<typeof scale>, i: number) => React.ReactElement> = {
  cover,
  location,
  homes,
  amenities,
  cta,
};

/** The JSX for one slide — exported so tests can inspect it without rendering. */
export function slideElement(brief: CreativeBrief, index: number, preset: ImagePresetId = DEFAULT_IMAGE_PRESET) {
  const id = SLIDES[index];
  if (!id) throw new Error(`Slide ${index} does not exist; carousel has ${SLIDE_COUNT} slides.`);
  return RENDERERS[id](brief, scale(preset), index);
}

/** One slide as a PNG response, sized by the preset. */
export async function renderSlide(
  brief: CreativeBrief,
  index: number,
  preset: ImagePresetId = DEFAULT_IMAGE_PRESET,
): Promise<ImageResponse> {
  const { width, height } = IMAGE_PRESETS[preset];
  return new ImageResponse(slideElement(brief, index, preset), {
    width,
    height,
    fonts: await loadFonts(BRAND.fontFamily),
  });
}
