"use client";

// The customer (party) directory: every buyer the user has billed, plus any they
// add by hand. Invoices capture their buyer here automatically (see the gstbill
// page), and the Bill To / buyer-name fields autocomplete against it. This page
// is where the user searches, corrects, and prunes that list.

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonStyles } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/controls";
import { IconPlus, IconUsers, IconClose } from "@/components/dashboard/icons";
import { blankCustomer, gstinStateCode, isLikelyGstin, normalizeGstin } from "@/lib/customer";
import { getAllCustomers, saveCustomer, deleteCustomer } from "@/lib/customerStorage";
import { STATES, stateName } from "@/lib/states";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setCustomers(await getAllCustomers());
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getAllCustomers();
        if (active) setCustomers(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close the editor on Escape.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.name, c.gstin, c.phone, c.address, stateName(c.stateCode)]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [customers, q]);

  const patchEdit = (p: Partial<Customer>) => setEditing((e) => (e ? { ...e, ...p } : e));

  // GSTIN encodes the state in its first two digits — back-fill the state when
  // it's still blank so the user doesn't pick it twice.
  function onGstinChange(v: string) {
    const gstin = normalizeGstin(v);
    const derived = gstinStateCode(gstin);
    patchEdit({ gstin, ...(derived && !editing?.stateCode ? { stateCode: derived } : {}) });
  }

  async function saveEditing() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await saveCustomer({ ...editing, name: editing.name.trim() });
      await reload();
      setStatus(`Saved ${editing.name.trim()}`);
      setEditing(null);
    } catch (e) {
      setStatus("Save failed: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.name} from your customers? This cannot be undone.`)) return;
    try {
      await deleteCustomer(c.id);
      await reload();
      setStatus(`Deleted ${c.name}`);
    } catch (e) {
      setStatus("Delete failed: " + (e as Error).message);
    }
  }

  const gstinWarn = !!editing && editing.gstin.trim() !== "" && !isLikelyGstin(editing.gstin);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={loading ? "Loading…" : `${customers.length} customer${customers.length === 1 ? "" : "s"}`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing(blankCustomer())}>
            <IconPlus className="h-[18px] w-[18px]" /> Add customer
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, GSTIN, phone, or state…"
          className="sm:max-w-md"
          aria-label="Search customers"
        />
      </div>

      {status && <p className="mb-3 text-sm text-muted">{status}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-surface p-10 text-center text-muted">
          {customers.length === 0 ? (
            <>
              <IconUsers className="mx-auto mb-3 h-8 w-8 text-faint" />
              <p>No customers yet.</p>
              <p className="mt-1 text-sm text-faint">
                They&apos;re remembered automatically when you save an invoice — or{" "}
                <button onClick={() => setEditing(blankCustomer())} className="font-medium text-accent hover:underline">
                  add one now
                </button>
                .
              </p>
            </>
          ) : (
            "No customers match your search."
          )}
        </div>
      ) : (
        <>
          {/* Mobile: one card per customer */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {[c.gstin || null, stateName(c.stateCode) || null, c.phone || null].filter(Boolean).join(" · ") || "No GSTIN"}
                </p>
                {c.address ? <p className="mt-1 truncate text-sm text-muted">{c.address}</p> : null}
                <div className="mt-3 flex items-center gap-2 border-t border-hair pt-3">
                  <button className="rounded-lg bg-accent-weak px-3 py-1.5 text-sm font-medium text-accent" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-neg hover:bg-neg-weak" onClick={() => remove(c)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-hair bg-surface shadow-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">GSTIN</th>
                  <th className="p-3 font-semibold">State</th>
                  <th className="p-3 font-semibold">Phone</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-hair text-ink">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 font-mono text-xs text-muted">{c.gstin || "—"}</td>
                    <td className="p-3 text-muted">{stateName(c.stateCode) || "—"}</td>
                    <td className="p-3 text-muted">{c.phone || "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-3 text-xs font-medium">
                        <button className="text-accent hover:underline" onClick={() => setEditing(c)}>Edit</button>
                        <button className="text-neg hover:underline" onClick={() => remove(c)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cust-editor-title">
          <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-pop sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="cust-editor-title" className="text-base font-semibold text-ink">
                {customers.some((c) => c.id === editing.id) ? "Edit customer" : "Add customer"}
              </h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Name">
                  <Input value={editing.name} onChange={(e) => patchEdit({ name: e.target.value })} placeholder="M/s Example Traders" autoFocus />
                </Field>
              </div>
              <Field label="GSTIN / UIN" hint={gstinWarn ? "Doesn't look like a 15-character GSTIN." : undefined}>
                <Input value={editing.gstin} onChange={(e) => onGstinChange(e.target.value)} placeholder="08ABCDE1234F1Z5" className="font-mono" />
              </Field>
              <Field label="State & Code">
                <Select value={editing.stateCode} onChange={(e) => patchEdit({ stateCode: e.target.value })}>
                  <option value="">Select state</option>
                  {STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone">
                <Input type="tel" value={editing.phone} onChange={(e) => patchEdit({ phone: e.target.value })} placeholder="Optional" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Textarea value={editing.address} onChange={(e) => patchEdit({ address: e.target.value })} rows={3} placeholder="Billing address" />
                </Field>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={buttonStyles("secondary", "md")}>
                Cancel
              </button>
              <Button variant="primary" onClick={saveEditing} disabled={saving || !editing.name.trim()}>
                {saving ? "Saving…" : "Save customer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
