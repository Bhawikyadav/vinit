// Pure helpers for the product (catalog) directory — no I/O, no React. The async
// storage layer lives in productStorage.ts (mirrors the customer.ts /
// customerStorage.ts split). Unlike customers, products are never captured from
// a document — the catalog is edited only on the Products page.

import type { Product } from "./types";

// A fresh, empty product with its own id and timestamps. Sensible line defaults
// (Nos / 18% GST) so a hand-added product drops straight into an invoice.
export function blankProduct(): Product {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    hsnSac: "",
    unit: "Nos",
    rate: 0,
    gstRate: 18,
    createdAt: now,
    updatedAt: now,
  };
}

// Normalise a name for matching: trim, collapse internal whitespace, lowercase.
export function normalizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Rank + filter products for the autocomplete dropdown. With no query, returns
// the most recently used (so focusing an empty field offers quick picks). With a
// query, matches by name (prefix beats substring) then by HSN/SAC, best first.
export function rankProducts(products: Product[], query: string, limit = 8): Product[] {
  const q = normalizeProductName(query);
  if (!q) {
    return [...products]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 6);
  }
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    const name = normalizeProductName(p.name);
    const hsn = p.hsnSac.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    else if (hsn && hsn.includes(q)) score = 2;
    if (score >= 0) scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((s) => s.p);
}
