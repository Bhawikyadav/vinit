// Client-side storage for quotations. Mirrors storage.ts (bills):
// localStorage by default, cloud via /api/quotes when NEXT_PUBLIC_USE_CLOUD=1.

import { isCloud } from "./storage";
import type { Quote } from "./types";

const KEY = "vm_quotes_v1";

// ---------- localStorage implementation ----------
function localGetAll(): Quote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Quote[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function localWriteAll(quotes: Quote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(quotes));
  } catch {
    // ignore (private mode / quota)
  }
}

// ---------- API (cloud) implementation ----------
async function apiGetAll(): Promise<Quote[]> {
  const res = await fetch("/api/quotes", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load quotations");
  return (await res.json()) as Quote[];
}

async function apiGet(id: string): Promise<Quote | null> {
  const res = await fetch(`/api/quotes/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load quotation");
  return (await res.json()) as Quote;
}

async function apiSave(quote: Quote): Promise<void> {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quote),
  });
  if (!res.ok) throw new Error("Failed to save quotation");
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete quotation");
}

// ---------- Public API (uniform, async) ----------
export async function getAllQuotes(): Promise<Quote[]> {
  const quotes = isCloud() ? await apiGetAll() : localGetAll();
  return quotes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getQuote(id: string): Promise<Quote | null> {
  if (isCloud()) return apiGet(id);
  return localGetAll().find((q) => q.id === id) ?? null;
}

export async function saveQuote(quote: Quote): Promise<void> {
  quote.updatedAt = new Date().toISOString();
  if (isCloud()) {
    await apiSave(quote);
    return;
  }
  const all = localGetAll();
  const i = all.findIndex((q) => q.id === quote.id);
  if (i >= 0) all[i] = quote;
  else all.push(quote);
  localWriteAll(all);
}

export async function deleteQuote(id: string): Promise<void> {
  if (isCloud()) {
    await apiDelete(id);
    return;
  }
  localWriteAll(localGetAll().filter((q) => q.id !== id));
}
