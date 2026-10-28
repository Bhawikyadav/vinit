"use client";

// The product (catalog) directory: every product/service the user sells, with a
// default price, HSN/SAC, unit and GST rate. The invoice "Description" and
// quotation "Product Name" fields autocomplete against it; picking one imports
// its details into the line. Edits made on a document stay on that document —
// the catalog is changed only here, so this page is the single source of truth.

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonStyles } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/controls";
import { IconPlus, IconBox, IconClose, IconUpload } from "@/components/dashboard/icons";
import ProductBulkUpload from "@/components/ProductBulkUpload";
import { blankProduct } from "@/lib/product";
import { getAllProducts, saveProduct, deleteProduct } from "@/lib/productStorage";
import { formatINR } from "@/lib/gst";
import type { Product } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  // Bulk "Add products" drawer: a list of draft rows saved together.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [drafts, setDrafts] = useState<Product[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function reload() {
    setProducts(await getAllProducts());
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getAllProducts();
        if (active) setProducts(data);
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

  // Close the bulk drawer on Escape.
  useEffect(() => {
    if (!bulkOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBulkOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bulkOpen]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.hsnSac, p.unit].join(" ").toLowerCase().includes(term),
    );
  }, [products, q]);

  const patchEdit = (p: Partial<Product>) => setEditing((e) => (e ? { ...e, ...p } : e));

  async function saveEditing() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await saveProduct({ ...editing, name: editing.name.trim() });
      await reload();
      setStatus(`Saved ${editing.name.trim()}`);
      setEditing(null);
    } catch (e) {
      setStatus("Save failed: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name} from your products? This cannot be undone.`)) return;
    try {
      await deleteProduct(p.id);
      await reload();
      setStatus(`Deleted ${p.name}`);
    } catch (e) {
      setStatus("Delete failed: " + (e as Error).message);
    }
  }

  // ---- Bulk "Add products" drawer ----
  function openBulk() {
    setDrafts([blankProduct()]);
    setBulkOpen(true);
  }
  const patchDraft = (id: string, p: Partial<Product>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const addDraft = () => setDrafts((ds) => [...ds, blankProduct()]);
  const removeDraft = (id: string) => setDrafts((ds) => ds.filter((d) => d.id !== id));

  // Rows with a name are the ones that will be saved; blank rows are ignored.
  const draftCount = drafts.filter((d) => d.name.trim()).length;

  async function saveBulk() {
    const toSave = drafts.filter((d) => d.name.trim());
    if (toSave.length === 0) return;
    setSavingBulk(true);
    try {
      for (const d of toSave) {
        await saveProduct({ ...d, name: d.name.trim() });
      }
      await reload();
      setStatus(`Added ${toSave.length} product${toSave.length === 1 ? "" : "s"}`);
      setBulkOpen(false);
      setDrafts([]);
    } catch (e) {
      setStatus("Save failed: " + (e as Error).message);
    } finally {
      setSavingBulk(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={loading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
              <IconUpload className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Bulk upload</span>
            </Button>
            <Button variant="primary" size="sm" onClick={openBulk}>
              <IconPlus className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">Add product</span>
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, HSN/SAC, or unit…"
          className="sm:max-w-md"
          aria-label="Search products"
        />
      </div>

      {status && <p className="mb-3 text-sm text-muted">{status}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-surface p-10 text-center text-muted">
          {products.length === 0 ? (
            <>
              <IconBox className="mx-auto mb-3 h-8 w-8 text-faint" />
              <p>No products yet.</p>
              <p className="mt-1 text-sm text-faint">
                Save the things you sell here, then reuse them on any invoice or quotation —{" "}
                <button onClick={openBulk} className="font-medium text-accent hover:underline">
                  add one now
                </button>
                .
              </p>
            </>
          ) : (
            "No products match your search."
          )}
        </div>
      ) : (
        <>
          {/* Mobile: one card per product */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold text-ink">{p.name}</p>
                  <p className="shrink-0 font-semibold tabular-nums text-ink">₹ {formatINR(p.rate)}</p>
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {[p.hsnSac ? `HSN ${p.hsnSac}` : null, p.unit || null, `${p.gstRate}% GST`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-3 flex items-center gap-2 border-t border-hair pt-3">
                  <button className="rounded-lg bg-accent-weak px-3 py-1.5 text-sm font-medium text-accent" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-neg hover:bg-neg-weak" onClick={() => remove(p)}>
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
                  <th className="p-3 font-semibold">HSN/SAC</th>
                  <th className="p-3 font-semibold">Unit</th>
                  <th className="p-3 text-right font-semibold">Rate (₹)</th>
                  <th className="p-3 text-right font-semibold">GST %</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-hair text-ink">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 font-mono text-xs text-muted">{p.hsnSac || "—"}</td>
                    <td className="p-3 text-muted">{p.unit || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{formatINR(p.rate)}</td>
                    <td className="p-3 text-right tabular-nums text-muted">{p.gstRate}%</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-3 text-xs font-medium">
                        <button className="text-accent hover:underline" onClick={() => setEditing(p)}>Edit</button>
                        <button className="text-neg hover:underline" onClick={() => remove(p)}>Delete</button>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="prod-editor-title">
          <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-pop sm:max-w-lg sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="prod-editor-title" className="text-base font-semibold text-ink">
                {products.some((p) => p.id === editing.id) ? "Edit product" : "Add product"}
              </h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Name">
                  <Input value={editing.name} onChange={(e) => patchEdit({ name: e.target.value })} placeholder="e.g. Fire Extinguisher ABC 6kg" autoFocus />
                </Field>
              </div>
              <Field label="HSN / SAC">
                <Input value={editing.hsnSac} onChange={(e) => patchEdit({ hsnSac: e.target.value })} placeholder="Optional" className="font-mono" />
              </Field>
              <Field label="Unit">
                <Input value={editing.unit} onChange={(e) => patchEdit({ unit: e.target.value })} placeholder="Nos" />
              </Field>
              <Field label="Rate (₹)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={String(editing.rate)}
                  onChange={(e) => patchEdit({ rate: Number(e.target.value) || 0 })}
                  placeholder="0"
                />
              </Field>
              <Field label="GST %">
                <Select value={editing.gstRate} onChange={(e) => patchEdit({ gstRate: Number(e.target.value) })}>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={buttonStyles("secondary", "md")}>
                Cancel
              </button>
              <Button variant="primary" onClick={saveEditing} disabled={saving || !editing.name.trim()}>
                {saving ? "Saving…" : "Save product"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk add drawer — enter several products, then save them together */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
          <button type="button" aria-label="Close" onClick={() => setBulkOpen(false)} className="bm-drawer-backdrop absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="bm-drawer-pop relative z-10 flex h-full w-full max-w-xl flex-col bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-hair p-5">
              <div>
                <h2 id="bulk-title" className="text-base font-semibold text-ink">Add products</h2>
                <p className="text-xs text-muted">Enter as many as you like, then save them all at once.</p>
              </div>
              <button type="button" onClick={() => setBulkOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {drafts.map((d, i) => (
                <div key={d.id} className="rounded-xl border border-hair p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-faint">Product {i + 1}</span>
                    {drafts.length > 1 && (
                      <button className="text-xs font-medium text-neg hover:underline" onClick={() => removeDraft(d.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-4">
                      <Field label="Name">
                        <Input value={d.name} onChange={(e) => patchDraft(d.id, { name: e.target.value })} placeholder="e.g. Fire Extinguisher ABC 6kg" autoFocus={i === drafts.length - 1} />
                      </Field>
                    </div>
                    <Field label="HSN / SAC">
                      <Input value={d.hsnSac} onChange={(e) => patchDraft(d.id, { hsnSac: e.target.value })} placeholder="Optional" className="font-mono" />
                    </Field>
                    <Field label="Unit">
                      <Input value={d.unit} onChange={(e) => patchDraft(d.id, { unit: e.target.value })} placeholder="Nos" />
                    </Field>
                    <Field label="Rate (₹)">
                      <Input type="number" inputMode="decimal" value={String(d.rate)} onChange={(e) => patchDraft(d.id, { rate: Number(e.target.value) || 0 })} placeholder="0" />
                    </Field>
                    <Field label="GST %">
                      <Select value={d.gstRate} onChange={(e) => patchDraft(d.id, { gstRate: Number(e.target.value) })}>
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              ))}

              <Button variant="secondary" size="sm" onClick={addDraft}>
                <IconPlus className="h-[18px] w-[18px]" /> Add another product
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-hair p-5">
              <button type="button" onClick={() => setBulkOpen(false)} className={buttonStyles("secondary", "md")}>
                Cancel
              </button>
              <Button variant="primary" onClick={saveBulk} disabled={savingBulk || draftCount === 0}>
                {savingBulk ? "Saving…" : `Save ${draftCount} product${draftCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <ProductBulkUpload
          existing={products}
          onClose={() => setUploadOpen(false)}
          onImported={async (summary) => {
            await reload();
            setUploadOpen(false);
            setStatus(
              `Imported ${summary.saved} product${summary.saved === 1 ? "" : "s"}` +
                (summary.skipped ? ` · ${summary.skipped} skipped` : ""),
            );
          }}
        />
      )}
    </>
  );
}
