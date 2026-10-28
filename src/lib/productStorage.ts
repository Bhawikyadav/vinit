// Client-side storage for the product (catalog) directory. All data lives in
// MongoDB via the /api/products routes, scoped to the signed-in owner — the same
// cloud-only model as bills and customers. There is no "capture from a document"
// helper (cf. rememberParty): products are created and edited only on the
// Products page, so a document never writes back into the catalog.

import type { Product } from "./types";

export async function getAllProducts(): Promise<Product[]> {
  const res = await fetch("/api/products", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load products");
  const list = (await res.json()) as Product[];
  // Alphabetical so the directory page and empty-query suggestions read in a
  // predictable order.
  return list.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function getProduct(id: string): Promise<Product | null> {
  const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load product");
  return (await res.json()) as Product;
}

export async function saveProduct(product: Product): Promise<void> {
  product.updatedAt = new Date().toISOString();
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error("Failed to save product");
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete product");
}

// Save many products in one request (bulk upload). The server re-validates every
// row and upserts by id, returning how many were saved vs skipped. Throws with
// the server's message on a non-2xx (e.g. the row-count cap was exceeded).
export async function bulkSaveProducts(products: Product[]): Promise<{ saved: number; skipped: number }> {
  const res = await fetch("/api/products/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });
  const data = (await res.json().catch(() => null)) as { saved?: number; skipped?: number; error?: string } | null;
  if (!res.ok) throw new Error(data?.error || "Bulk upload failed");
  return { saved: data?.saved ?? 0, skipped: data?.skipped ?? 0 };
}
