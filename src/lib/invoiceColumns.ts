// Item-table column widths. When the Unit or Disc columns are hidden, the
// remaining columns are scaled back up so the table still fills the page width.
// Shared by the PDF renderer (which needs explicit widths).

const BASE: Record<string, number> = {
  sl: 3.5,
  desc: 21,
  hsn: 8,
  qty: 5.5,
  unit: 5.5,
  rate: 10,
  disc: 8,
  taxable: 11,
  gstp: 5.5,
  gstamt: 10.5,
  total: 11.5,
};

export function colWidths(
  showUnit: boolean,
  showDiscount: boolean,
): Record<string, string> {
  const active = Object.entries(BASE).filter(
    ([k]) => (k !== "unit" || showUnit) && (k !== "disc" || showDiscount),
  );
  const sum = active.reduce((s, [, v]) => s + v, 0);
  const out: Record<string, string> = {};
  for (const [k, v] of active) out[k] = `${((v / sum) * 100).toFixed(2)}%`;
  return out;
}
