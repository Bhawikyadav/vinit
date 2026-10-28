// Client-side storage for the customer (party) directory. All data lives in
// MongoDB via the /api/customers routes, scoped to the signed-in owner — the
// same cloud-only model as bills (see storage.ts).

import {
  blankCustomer,
  findCustomerMatch,
  gstinStateCode,
  normalizeGstin,
} from "./customer";
import type { Customer, Party } from "./types";

// ---------- Public API (uniform, async) ----------
export async function getAllCustomers(): Promise<Customer[]> {
  const res = await fetch("/api/customers", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load customers");
  const list = (await res.json()) as Customer[];
  // Alphabetical so the directory page and the empty-query suggestions read in a
  // predictable order.
  return list.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const res = await fetch(`/api/customers/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load customer");
  return (await res.json()) as Customer;
}

export async function saveCustomer(customer: Customer): Promise<void> {
  customer.updatedAt = new Date().toISOString();
  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customer),
  });
  if (!res.ok) throw new Error("Failed to save customer");
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete customer");
}

// Capture a document's party into the directory. No-op for an empty name.
// Dedupes by GSTIN then name (see findCustomerMatch); on a match it refreshes the
// details without erasing fields the party left blank, and skips the write when
// nothing meaningful changed. The state code is back-filled from the GSTIN when
// the party didn't carry one. Best-effort by contract: callers wrap this so a
// directory failure never blocks saving the invoice itself.
export async function rememberParty(party: Party): Promise<Customer | null> {
  const name = party.name.trim();
  if (!name) return null;

  const list = await getAllCustomers();
  const gstin = normalizeGstin(party.gstin);
  const stateCode = party.stateCode.trim() || gstinStateCode(gstin);
  const address = party.address.trim();
  const match = findCustomerMatch(list, { name, gstin });

  if (match) {
    const updated: Customer = {
      ...match,
      name,
      address: address || match.address,
      gstin: gstin || match.gstin,
      stateCode: stateCode || match.stateCode,
    };
    if (
      updated.name === match.name &&
      updated.address === match.address &&
      updated.gstin === match.gstin &&
      updated.stateCode === match.stateCode
    ) {
      return match; // nothing changed — don't churn the record
    }
    await saveCustomer(updated);
    return updated;
  }

  const created: Customer = { ...blankCustomer(), name, address, gstin, stateCode };
  await saveCustomer(created);
  return created;
}
