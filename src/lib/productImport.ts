// Pure, framework-free helpers for the product bulk upload — the single source of
// truth for the column schema, limits, header mapping and row validation. Shared
// by the browser (parse + preview in ProductBulkUpload) and the server (defence-
// in-depth re-validation in /api/products/bulk). No DOM, no SheetJS, no Node:
// the spreadsheet parsing itself lives in the component (dynamic-imported), this
// module only turns already-parsed rows into clean products or typed errors.

import type { Product } from "./types";

// ---- Limits (enforced on both sides) ----
export const ALLOWED_GST = [0, 5, 12, 18, 28];
export const MAX_BULK_ROWS = 500; // products per upload
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
export const MAX_NAME_LEN = 200;
export const MAX_SHORT_LEN = 20; // hsn / unit

// Canonical column order for the downloadable template + any export.
export const TEMPLATE_COLUMNS = ["Name", "HSN/SAC", "Unit", "Rate", "GST%"] as const;

// 8 realistic sample rows for the downloadable template (fire-safety catalog).
export const SAMPLE_ROWS: Record<string, string | number>[] = [
  { Name: "Fire Extinguisher ABC 6kg", "HSN/SAC": "84241000", Unit: "Nos", Rate: 2400, "GST%": 18 },
  { Name: "Fire Extinguisher CO2 4.5kg", "HSN/SAC": "84241000", Unit: "Nos", Rate: 6500, "GST%": 18 },
  { Name: "Fire Hose Reel Drum Complete", "HSN/SAC": "84241000", Unit: "Nos", Rate: 8500, "GST%": 18 },
  { Name: "Smoke Detector (Optical)", "HSN/SAC": "85311010", Unit: "Nos", Rate: 950, "GST%": 18 },
  { Name: "Fire Alarm Control Panel 4 Zone", "HSN/SAC": "85311010", Unit: "Nos", Rate: 7200, "GST%": 18 },
  { Name: "Sprinkler Head Pendent", "HSN/SAC": "84242000", Unit: "Nos", Rate: 180, "GST%": 18 },
  { Name: "Fire Bucket with Stand", "HSN/SAC": "73269099", Unit: "Set", Rate: 1500, "GST%": 18 },
  { Name: "AMC - Fire Safety System (Annual)", "HSN/SAC": "998719", Unit: "Service", Rate: 12000, "GST%": 18 },
];

export type FieldKey = "name" | "hsnSac" | "unit" | "rate" | "gstRate";

// Map a spreadsheet header to one of our canonical keys, tolerant of case,
// spacing, punctuation (incl. ₹ / %) and common synonyms. Unknown → null.
export function headerToField(header: string): FieldKey | null {
  const h = String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["name", "product", "productname", "description", "item", "itemname", "particulars"].includes(h)) return "name";
  if (["hsn", "sac", "hsnsac", "hsncode", "saccode", "hsnsaccode"].includes(h)) return "hsnSac";
  if (["unit", "uom", "units"].includes(h)) return "unit";
  if (["rate", "price", "rateinr", "unitprice", "mrp", "amount", "cost"].includes(h)) return "rate";
  if (["gst", "gstrate", "gstpercent", "gstpercentage", "tax", "taxrate"].includes(h)) return "gstRate";
  return null;
}

// Remap a raw parsed row (keyed by original headers) to canonical field keys.
// First non-empty value wins when two columns map to the same field.
export function remapRow(raw: Record<string, unknown>): Partial<Record<FieldKey, unknown>> {
  const out: Partial<Record<FieldKey, unknown>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = headerToField(key);
    if (!field) continue;
    const cur = out[field];
    const curEmpty = cur === undefined || cur === null || String(cur).trim() === "";
    if (curEmpty) out[field] = value;
  }
  return out;
}

const asText = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

export interface CoercedFields {
  name: string;
  hsnSac: string;
  unit: string;
  rate: number;
  gstRate: number;
}

export interface RowOutcome {
  blank: boolean; // entirely empty row — ignored silently
  fields?: CoercedFields; // present only when there are no errors
  errors: string[];
}

// Validate + coerce one remapped row. Missing optional values fall back to sane
// defaults (unit "Nos", rate 0, GST 18%); a present-but-bad value is an error so
// the user sees it rather than having it silently "fixed".
export function coerceRow(m: Partial<Record<FieldKey, unknown>>): RowOutcome {
  const name = asText(m.name);
  const hsnSac = asText(m.hsnSac);
  const unitRaw = asText(m.unit);
  const rateRaw = asText(m.rate);
  const gstRaw = asText(m.gstRate);

  if (!name && !hsnSac && !unitRaw && !rateRaw && !gstRaw) {
    return { blank: true, errors: [] };
  }

  const errors: string[] = [];

  if (!name) errors.push("Name is required");
  else if (name.length > MAX_NAME_LEN) errors.push(`Name is too long (max ${MAX_NAME_LEN})`);

  let rate = 0;
  if (rateRaw !== "") {
    const n = Number(rateRaw.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(n)) errors.push(`Rate "${rateRaw}" is not a number`);
    else if (n < 0) errors.push("Rate cannot be negative");
    else rate = n;
  }

  let gstRate = 18;
  if (gstRaw !== "") {
    const g = Number(gstRaw.replace(/[%\s]/g, ""));
    if (!Number.isFinite(g)) errors.push(`GST "${gstRaw}" is not a number`);
    else if (!ALLOWED_GST.includes(g)) errors.push(`GST ${g}% must be one of ${ALLOWED_GST.join("/")}`);
    else gstRate = g;
  }

  if (hsnSac.length > MAX_SHORT_LEN) errors.push(`HSN/SAC is too long (max ${MAX_SHORT_LEN})`);

  if (errors.length) return { blank: false, errors };

  const unit = (unitRaw || "Nos").slice(0, MAX_SHORT_LEN);
  return { blank: false, errors: [], fields: { name, hsnSac, unit, rate, gstRate } };
}

// Server-side sanitiser: turn an untrusted product-like object (already resolved
// to fields by the client) into a clean Product, or null if it fails the same
// rules. Preserves a client-supplied id/createdAt so an "update" row replaces the
// right record; otherwise mints fresh ones.
export function sanitizeProduct(p: Partial<Product> | null | undefined): Product | null {
  if (!p || typeof p !== "object") return null;
  const name = asText(p.name);
  if (!name || name.length > MAX_NAME_LEN) return null;

  const rate = Number(p.rate);
  if (!Number.isFinite(rate) || rate < 0) return null;

  const gstRate = Number(p.gstRate);
  if (!ALLOWED_GST.includes(gstRate)) return null;

  const now = new Date().toISOString();
  return {
    id: typeof p.id === "string" && p.id ? p.id : crypto.randomUUID(),
    name,
    hsnSac: asText(p.hsnSac).slice(0, MAX_SHORT_LEN),
    unit: (asText(p.unit) || "Nos").slice(0, MAX_SHORT_LEN),
    rate,
    gstRate,
    createdAt: typeof p.createdAt === "string" && p.createdAt ? p.createdAt : now,
    updatedAt: now,
  };
}
