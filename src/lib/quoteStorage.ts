// Client-side storage for quotations. Mirrors storage.ts (bills):
// all data is stored in MongoDB via the /api/quotes route (requires MONGODB_URI
// on the server). There is no local-only mode.

import type { Quote } from "./types";

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
  const quotes = await apiGetAll();
  return quotes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getQuote(id: string): Promise<Quote | null> {
  return apiGet(id);
}

export async function saveQuote(quote: Quote): Promise<void> {
  quote.updatedAt = new Date().toISOString();
  await apiSave(quote);
}

export async function deleteQuote(id: string): Promise<void> {
  await apiDelete(id);
}
