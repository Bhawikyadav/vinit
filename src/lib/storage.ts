// Client-side storage abstraction for bills.
//
// All data is stored in MongoDB via the /api/bills route (requires MONGODB_URI
// on the server). There is no local-only mode — the app is always cloud-backed.

import { DEFAULT_PROFILE } from "./company";
import { migrateTemplateId } from "./templates";
import type { Bill, CompanyProfile } from "./types";

// Kept for the UI badges ("☁ Cloud sync on"). Always true now.
export function isCloud(): boolean {
  return true;
}

// ---------- API (cloud) implementation ----------
async function apiGetAll(): Promise<Bill[]> {
  const res = await fetch("/api/bills", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load bills");
  return (await res.json()) as Bill[];
}

async function apiGet(id: string): Promise<Bill | null> {
  const res = await fetch(`/api/bills/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load bill");
  return (await res.json()) as Bill;
}

async function apiSave(bill: Bill): Promise<void> {
  const res = await fetch("/api/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bill),
  });
  if (!res.ok) throw new Error("Failed to save bill");
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/bills/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete bill");
}

// ---------- Public API (uniform, async) ----------
export async function getAllBills(): Promise<Bill[]> {
  const bills = await apiGetAll();
  return bills.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getBill(id: string): Promise<Bill | null> {
  return apiGet(id);
}

export async function saveBill(bill: Bill): Promise<void> {
  bill.updatedAt = new Date().toISOString();
  await apiSave(bill);
}

export async function deleteBill(id: string): Promise<void> {
  await apiDelete(id);
}

// ---------- Company profile (single record) ----------
// A fresh copy of the defaults, with the nested objects cloned so callers can
// mutate their profile without touching the shared DEFAULT_PROFILE constant.
function defaultProfile(): CompanyProfile {
  return {
    ...DEFAULT_PROFILE,
    bank: { ...DEFAULT_PROFILE.bank },
    units: [...DEFAULT_PROFILE.units],
    invoice: { ...DEFAULT_PROFILE.invoice },
    quote: { ...DEFAULT_PROFILE.quote },
  };
}

// Merge stored values over the defaults so new fields always have a value.
// Older saved profiles kept flat `showUnit` / `showDiscount` flags; those are
// migrated into the per-document `invoice` / `quote` objects when the nested
// form isn't present yet.
function mergeProfile(stored: Partial<CompanyProfile> | null): CompanyProfile {
  if (!stored) return defaultProfile();
  const legacy = stored as Partial<CompanyProfile> & {
    showUnit?: boolean;
    showDiscount?: boolean;
  };
  const merged: CompanyProfile = {
    ...defaultProfile(),
    ...stored,
    bank: { ...DEFAULT_PROFILE.bank, ...(stored.bank ?? {}) },
    invoice: {
      ...DEFAULT_PROFILE.invoice,
      showUnit: legacy.showUnit ?? DEFAULT_PROFILE.invoice.showUnit,
      showDiscount: legacy.showDiscount ?? DEFAULT_PROFILE.invoice.showDiscount,
      ...(stored.invoice ?? {}),
    },
    quote: {
      ...DEFAULT_PROFILE.quote,
      showUnit: legacy.showUnit ?? DEFAULT_PROFILE.quote.showUnit,
      ...(stored.quote ?? {}),
    },
    // Map first-generation ids (classic/modern) onto the new layouts. The
    // quotation never had a template before, so it defaults to the invoice's.
    template: migrateTemplateId(stored.template),
    quoteTemplate: migrateTemplateId(stored.quoteTemplate ?? stored.template),
  };
  // Drop the migrated legacy flags so they don't linger on the saved record.
  const bag = merged as unknown as Record<string, unknown>;
  delete bag.showUnit;
  delete bag.showDiscount;
  return merged;
}

export async function getProfile(): Promise<CompanyProfile> {
  try {
    const res = await fetch("/api/profile", { cache: "no-store" });
    if (res.status === 404) return defaultProfile();
    if (!res.ok) throw new Error("Failed to load profile");
    return mergeProfile((await res.json()) as Partial<CompanyProfile>);
  } catch {
    return defaultProfile();
  }
}

export async function saveProfile(profile: CompanyProfile): Promise<void> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to save profile");
}

// ---------- Backup helpers (export / import JSON) ----------
export async function exportAllJSON(): Promise<string> {
  return JSON.stringify(await getAllBills(), null, 2);
}

export async function importJSON(json: string): Promise<number> {
  const incoming = JSON.parse(json) as Bill[];
  if (!Array.isArray(incoming)) throw new Error("Invalid backup file");
  for (const bill of incoming) await saveBill(bill);
  return incoming.length;
}
