// Client-side storage abstraction.
//
// Default: localStorage (works immediately, single device).
// Cloud mode: set NEXT_PUBLIC_USE_CLOUD=1 (and MONGODB_URI on the server) to
// sync bills across devices through the /api/bills route.

import { DEFAULT_PROFILE } from "./company";
import type { Bill, CompanyProfile } from "./types";

const KEY = "vm_bills_v1";
const PROFILE_KEY = "vm_profile_v1";
const USE_CLOUD = process.env.NEXT_PUBLIC_USE_CLOUD === "1";

export function isCloud(): boolean {
  return USE_CLOUD;
}

// ---------- localStorage implementation ----------
function localGetAll(): Bill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Bill[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function localWriteAll(bills: Bill[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bills));
  } catch {
    // ignore (private mode / quota)
  }
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
  const bills = USE_CLOUD ? await apiGetAll() : localGetAll();
  return bills.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getBill(id: string): Promise<Bill | null> {
  if (USE_CLOUD) return apiGet(id);
  return localGetAll().find((b) => b.id === id) ?? null;
}

export async function saveBill(bill: Bill): Promise<void> {
  bill.updatedAt = new Date().toISOString();
  if (USE_CLOUD) {
    await apiSave(bill);
    return;
  }
  const all = localGetAll();
  const i = all.findIndex((b) => b.id === bill.id);
  if (i >= 0) all[i] = bill;
  else all.push(bill);
  localWriteAll(all);
}

export async function deleteBill(id: string): Promise<void> {
  if (USE_CLOUD) {
    await apiDelete(id);
    return;
  }
  localWriteAll(localGetAll().filter((b) => b.id !== id));
}

// ---------- Company profile (single record) ----------
// Merge stored values over the defaults so new fields always have a value.
function mergeProfile(stored: Partial<CompanyProfile> | null): CompanyProfile {
  if (!stored) return { ...DEFAULT_PROFILE };
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    bank: { ...DEFAULT_PROFILE.bank, ...(stored.bank ?? {}) },
  };
}

export async function getProfile(): Promise<CompanyProfile> {
  if (USE_CLOUD) {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.status === 404) return { ...DEFAULT_PROFILE };
      if (!res.ok) throw new Error("Failed to load profile");
      return mergeProfile((await res.json()) as Partial<CompanyProfile>);
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return mergeProfile(raw ? (JSON.parse(raw) as Partial<CompanyProfile>) : null);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: CompanyProfile): Promise<void> {
  if (USE_CLOUD) {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error("Failed to save profile");
    return;
  }
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    throw new Error("Could not save profile (storage full or blocked)");
  }
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
