// Turns a per-document NameStyle (set in Settings) into the inline overrides that
// get merged onto a template's company-name heading. An unset field (0 / 0 /
// false) contributes nothing, so a default profile leaves every template's own
// heading styling untouched.

import type { CSSProperties } from "react";
import type { NameStyle } from "./types";

export const DEFAULT_NAME_STYLE: NameStyle = { fontSize: 0, fontWeight: 0, italic: false };

// Selectable options for the Settings controls.
export const NAME_SIZES = [16, 18, 20, 22, 24, 28, 32, 36, 40, 48] as const;
// Weights run heavy: "Regular" starts at the old Semibold value (600) and each
// step climbs to the top of the CSS range (1000) at Extra-bold, so the lightest
// choice is already a strong, legible letterhead name.
export const NAME_WEIGHTS: ReadonlyArray<readonly [number, string]> = [
  [0, "Template default"],
  [600, "Regular"],
  [700, "Medium"],
  [800, "Semibold"],
  [900, "Bold"],
  [1000, "Extra-bold"],
];

// Overrides for the on-screen (HTML) preview. Browsers render the exact numeric
// weight and true italic, so nothing is mapped here.
export function nameCss(ns: NameStyle | undefined): CSSProperties {
  const s: CSSProperties = {};
  if (!ns) return s;
  if (ns.fontSize) s.fontSize = `${ns.fontSize}px`;
  if (ns.fontWeight) s.fontWeight = ns.fontWeight;
  if (ns.italic) s.fontStyle = "italic";
  return s;
}

// Overrides for @react-pdf/renderer. The registered Roboto only carries normal +
// bold and no italic, so weight collapses to normal/bold and italic is rendered
// with the built-in Helvetica (which ships an oblique and bold-oblique). A
// company name doesn't need the ₹ glyph that Roboto was chosen for, so the font
// swap only happens when italic is actually requested.
export function namePdfStyle(ns: NameStyle | undefined): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  if (!ns) return s;
  if (ns.fontSize) s.fontSize = ns.fontSize;
  if (ns.fontWeight) s.fontWeight = ns.fontWeight >= 600 ? "bold" : "normal";
  if (ns.italic) {
    s.fontStyle = "italic";
    s.fontFamily = "Helvetica";
  }
  return s;
}
