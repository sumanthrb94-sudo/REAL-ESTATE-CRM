// EstateCRM — one colour per unit status, shared by every surface that draws
// them. The project page shows the same four statuses twice (a donut and the
// unit matrix); before this they used different palettes and the two legends
// on one screen disagreed about what green meant.

import type { UnitStatus } from "@/types/domain";

/** Hex values for canvas/SVG contexts such as Recharts, which cannot read Tailwind classes. */
export const UNIT_STATUS_HEX: Record<UnitStatus, string> = {
  AVAILABLE: "#16a34a", // success green
  BLOCKED: "#f59e0b", // warning amber
  BOOKED: "#2563eb", // primary blue
  SOLD: "#64748b", // muted slate
};

/** Tailwind classes for the clickable chips in the unit matrix. */
export const UNIT_STATUS_CHIP: Record<UnitStatus, string> = {
  AVAILABLE: "border-success/40 bg-success/15 text-success hover:bg-success/30",
  BLOCKED: "border-warning/40 bg-warning/15 text-warning hover:bg-warning/30",
  BOOKED: "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
  SOLD: "border-border bg-muted text-muted-foreground hover:bg-muted/70",
};

/** Legend swatches, matching the chips above. */
export const UNIT_STATUS_SWATCH: Record<UnitStatus, string> = {
  AVAILABLE: "bg-success/60",
  BLOCKED: "bg-warning/60",
  BOOKED: "bg-primary/60",
  SOLD: "bg-muted-foreground/40",
};
