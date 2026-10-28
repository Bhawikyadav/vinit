// Pure helpers for the customer (party) directory — no I/O, no React. The async
// storage layer lives in customerStorage.ts (mirrors the gst.ts / storage.ts and
// quote.ts / quoteStorage.ts split).

import { STATES } from "./states";
import type { Customer, Party } from "./types";

// A fresh, empty customer record with its own id and timestamps.
export function blankCustomer(): Customer {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    address: "",
    gstin: "",
    stateCode: "",
    phone: "",
    createdAt: now,
    updatedAt: now,
  };
}

// Normalise a name for matching/dedup: trim, collapse internal whitespace, and
// lowercase. "  M/s   ABC  Traders " -> "m/s abc traders".
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Clean a GSTIN for storage and matching: drop spaces, uppercase.
export function normalizeGstin(gstin: string): string {
  return gstin.replace(/\s+/g, "").toUpperCase();
}

// Shape of a valid 15-char GSTIN: 2-digit state, 5 letters (PAN), 4 digits,
// 1 letter, an entity digit/letter, a literal "Z", and a checksum char. Used
// only for a soft "this doesn't look right" hint — never to block saving.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export function isLikelyGstin(gstin: string): boolean {
  return GSTIN_RE.test(normalizeGstin(gstin));
}

// The GST state code is the first two digits of a GSTIN. Returns "" when the
// prefix isn't a state code we recognise.
export function gstinStateCode(gstin: string): string {
  const prefix = normalizeGstin(gstin).slice(0, 2);
  return STATES.some((s) => s.code === prefix) ? prefix : "";
}

// Find the saved customer a party refers to, if any. A GSTIN is the strongest
// identity, so match on it first; fall back to an exact normalised-name match
// for unregistered (no-GSTIN) buyers.
export function findCustomerMatch(
  list: Customer[],
  party: { name: string; gstin: string },
): Customer | null {
  const gstin = normalizeGstin(party.gstin);
  if (gstin) {
    const byGstin = list.find((c) => normalizeGstin(c.gstin) === gstin);
    if (byGstin) return byGstin;
  }
  const name = normalizeName(party.name);
  if (!name) return null;
  return list.find((c) => normalizeName(c.name) === name) ?? null;
}

// The billing identity (Party) a document fills in from a saved customer.
export function partyFromCustomer(c: Customer): Party {
  return { name: c.name, address: c.address, gstin: c.gstin, stateCode: c.stateCode };
}

// Rank + filter customers for the autocomplete dropdown — a proper search, only
// after the user types (an empty query returns nothing; the field shows no
// suggestions until there's something to match). A customer matches when EVERY
// whitespace-separated token appears somewhere in its name or GSTIN, so "bha ya"
// finds "Bhawik Yadav" and "yadav" finds it too. Ranking: whole-query name prefix
// first, then name substring, then a looser token/GSTIN match — best first.
export function rankCustomers(customers: Customer[], query: string, limit = 8): Customer[] {
  const q = normalizeName(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  const scored: { c: Customer; score: number }[] = [];
  for (const c of customers) {
    const name = normalizeName(c.name);
    const gstin = c.gstin.toLowerCase();
    const haystack = `${name} ${gstin}`;
    if (!tokens.every((t) => haystack.includes(t))) continue;
    let score = 2;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
}
