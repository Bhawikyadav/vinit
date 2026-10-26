// Document templates. Unlike before, these are NOT knobs over one shared body —
// each `id` is a genuinely different page architecture. The on-screen A4 preview
// and the react-pdf renderer both `switch` on the id and build the matching
// layout, so the two always agree. The spec here only carries identity (id,
// name, description) for the picker; the structure lives in the renderers.

import type { TemplateId } from "./types";

export interface TemplateSpec {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "A classic centred letterhead — dark table header, full borders. The traditional Indian tax-invoice look.",
  },
  banner: {
    id: "banner",
    name: "Banner",
    description: "A bold full-width colour header with the name reversed out, a clean zebra table and a totals card. Modern.",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Airy letter style — hairline rules, no boxes, lots of white space. Understated and clean.",
  },
  sidebar: {
    id: "sidebar",
    name: "Sidebar",
    description: "A full-height accent rail down the left carries the logo and contact; the content fills the right. Corporate.",
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "A dark header block, uppercase tracked labels and a reversed 'Total' block. A boutique, premium feel.",
  },
};

export const TEMPLATE_LIST: TemplateSpec[] = Object.values(TEMPLATES);

// Older saved bills/profiles used a first-generation id that no longer exists
// ("modern"). "classic" and "minimal" are still valid ids, so they pass through
// unchanged and keep their original look.
const LEGACY: Record<string, TemplateId> = {
  modern: "banner",
};

export function migrateTemplateId(id: string | undefined): TemplateId {
  if (id && id in TEMPLATES) return id as TemplateId;
  if (id && id in LEGACY) return LEGACY[id];
  return "classic";
}

export function getTemplate(id: string | undefined): TemplateSpec {
  return TEMPLATES[migrateTemplateId(id)];
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
