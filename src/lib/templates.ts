// Invoice template presets. Each template is a set of style "knobs" that both
// the on-screen preview and the PDF read, so the two always match. The body
// (bill-to/ship-to, item table, totals, footer) is shared; templates vary the
// header layout, the accent band, the table-header colour and the border weight.

import type { TemplateId } from "./types";

export interface TemplateSpec {
  id: TemplateId;
  name: string;
  description: string;
  headerLayout: "centered" | "split"; // centered title vs letterhead-left + title-right
  headerBand: boolean; // tinted accent band behind the letterhead
  tableHead: "dark" | "accent" | "light";
  borders: "full" | "soft";
}

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Centered letterhead, bold dark table header, full borders — formal and traditional.",
    headerLayout: "centered",
    headerBand: false,
    tableHead: "dark",
    borders: "full",
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Logo to the left, accent-coloured band and table header, softer lines.",
    headerLayout: "split",
    headerBand: true,
    tableHead: "accent",
    borders: "soft",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Clean and airy — light table header, thin lines, lots of whitespace.",
    headerLayout: "split",
    headerBand: false,
    tableHead: "light",
    borders: "soft",
  },
};

export const TEMPLATE_LIST: TemplateSpec[] = Object.values(TEMPLATES);

export function getTemplate(id: string | undefined): TemplateSpec {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.classic;
}

// ---- colour helpers (used by both HTML preview and react-pdf) ----

function parseHex(hex: string): [number, number, number] {
  const h = (hex || "#c0392b").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

const to2 = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");

/** Readable text colour (black or white) to place on top of `hex`. */
export function contrastText(hex: string): string {
  const [r, g, b] = parseHex(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

/** Mix `hex` toward white by `ratio` (0..1). ratio 0.88 ≈ a very light tint. */
export function tint(hex: string, ratio: number): string {
  const [r, g, b] = parseHex(hex);
  const m = (c: number) => Math.round(c + (255 - c) * ratio);
  return `#${to2(m(r))}${to2(m(g))}${to2(m(b))}`;
}
