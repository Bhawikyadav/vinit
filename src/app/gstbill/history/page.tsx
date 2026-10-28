"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/controls";
import { IconPlus } from "@/components/dashboard/icons";
import { computeBill } from "@/lib/gst";
import { stateName } from "@/lib/states";
import {
  getAllBills,
  saveBill,
  deleteBill,
  exportAllJSON,
  importJSON,
  getProfile,
} from "@/lib/storage";
import DuplicateTemplateDialog from "@/components/DuplicateTemplateDialog";
import type { Bill } from "@/lib/types";

export default function HistoryPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dupTarget, setDupTarget] = useState<Bill | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open a bill in the editor. Used by both the "Open" action and the
  // whole-card / whole-row click (so the entire card is a hit target).
  const open = (id: string) => router.push(`/gstbill?id=${id}`);
  const openOnKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(id);
    }
  };
  // Action buttons sit inside the clickable card/row — keep their clicks from
  // also opening the bill.
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  async function reload() {
    setLoading(true);
    setBills(await getAllBills());
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await getAllBills();
      if (active) {
        setBills(data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bills;
    return bills.filter((b) =>
      [b.invoiceNo, b.billTo.name, b.invoiceDate].join(" ").toLowerCase().includes(term),
    );
  }, [bills, q]);

  // `useCurrentTemplate` true → the copy adopts the current default template &
  // accent from the company profile; false → it keeps the snapshot it was made
  // in. The original is cloned either way; only the template fields differ.
  async function duplicate(b: Bill, useCurrentTemplate: boolean) {
    const now = new Date();
    const copy: Bill = {
      ...structuredClone(b),
      id: crypto.randomUUID(),
      invoiceNo: b.invoiceNo + "-COPY",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (useCurrentTemplate) {
      const profile = await getProfile();
      copy.template = profile.template;
      copy.accentColor = profile.accentColor;
    }
    await saveBill(copy);
    setDupTarget(null);
    setStatus(`Duplicated ${b.invoiceNo}`);
    reload();
  }

  async function remove(b: Bill) {
    if (!confirm(`Delete invoice ${b.invoiceNo}? This cannot be undone.`)) return;
    await deleteBill(b.id);
    setStatus(`Deleted ${b.invoiceNo}`);
    reload();
  }

  async function downloadPdf(b: Bill) {
    const [{ generatePdfBlob }, profile] = await Promise.all([
      import("@/lib/pdf/invoicePdf"),
      getProfile(),
    ]);
    const blob = await generatePdfBlob(b, computeBill(b, profile.stateCode), profile);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${b.invoiceNo.replace(/[\/\\]/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportBackup() {
    const json = await exportAllJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const n = await importJSON(await file.text());
      setStatus(`Imported ${n} bill(s)`);
      reload();
    } catch (err) {
      setStatus("Import failed: " + (err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  // Compact row-action chips, shared by the mobile cards and the desktop table.
  const chip = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={loading ? "Loading…" : `${bills.length} invoice${bills.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/gstbill" className={buttonStyles("primary", "sm", "hidden sm:inline-flex")}>
            <IconPlus className="h-[18px] w-[18px]" /> New invoice
          </Link>
        }
      />

      {/* Toolbar: search + data management */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by invoice no, buyer, or date…"
          className="min-w-[12rem] flex-1 sm:max-w-md"
          aria-label="Search invoices"
        />
        <Button variant="secondary" size="sm" onClick={exportBackup}>Export</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Import</Button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
      </div>

      {status && <p className="mb-3 text-sm text-muted">{status}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-surface p-10 text-center text-muted">
          {bills.length === 0 ? (
            <>
              No invoices yet.{" "}
              <Link href="/gstbill" className="font-medium text-accent hover:underline">
                Create your first invoice
              </Link>
              .
            </>
          ) : (
            "No invoices match your search."
          )}
        </div>
      ) : (
        <>
          {/* Mobile: one card per invoice */}
          <div className="space-y-3 md:hidden">
            {filtered.map((b) => {
              const t = computeBill(b);
              return (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(b.id)}
                  onKeyDown={openOnKey(b.id)}
                  aria-label={`Open invoice ${b.invoiceNo}`}
                  className="cursor-pointer rounded-2xl border border-hair bg-surface p-4 shadow-card transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{b.invoiceNo}</p>
                      <p className="truncate text-sm text-muted">{b.billTo.name || "—"}</p>
                    </div>
                    <p className="shrink-0 text-right font-semibold tabular-nums text-ink">
                      ₹ {t.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    {b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString("en-GB") : "—"} ·{" "}
                    {stateName(b.placeOfSupplyCode) || "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
                    <Link href={`/gstbill?id=${b.id}`} onClick={(e) => e.stopPropagation()} className={`${chip} bg-accent-weak text-accent`}>
                      Open
                    </Link>
                    <button className={`${chip} bg-surface-2 text-muted hover:text-ink`} onClick={stop(() => downloadPdf(b))}>
                      PDF
                    </button>
                    <button className={`${chip} bg-surface-2 text-muted hover:text-ink`} onClick={stop(() => setDupTarget(b))}>
                      Duplicate
                    </button>
                    <button className={`${chip} ml-auto text-neg hover:bg-neg-weak`} onClick={stop(() => remove(b))}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-hair bg-surface shadow-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="p-3 font-semibold">Invoice No.</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Buyer</th>
                  <th className="p-3 font-semibold">State</th>
                  <th className="p-3 text-right font-semibold">Grand Total</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const t = computeBill(b);
                  return (
                    <tr
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => open(b.id)}
                      onKeyDown={openOnKey(b.id)}
                      aria-label={`Open invoice ${b.invoiceNo}`}
                      className="cursor-pointer border-t border-hair text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                    >
                      <td className="p-3 font-medium">{b.invoiceNo}</td>
                      <td className="p-3 text-muted">{b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="p-3">{b.billTo.name || "—"}</td>
                      <td className="p-3 text-muted">{stateName(b.placeOfSupplyCode) || "—"}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        ₹ {t.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-3 text-xs font-medium">
                          <Link href={`/gstbill?id=${b.id}`} onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">Open</Link>
                          <button className="text-muted hover:text-ink hover:underline" onClick={stop(() => downloadPdf(b))}>PDF</button>
                          <button className="text-muted hover:text-ink hover:underline" onClick={stop(() => setDupTarget(b))}>Duplicate</button>
                          <button className="text-neg hover:underline" onClick={stop(() => remove(b))}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dupTarget && (
        <DuplicateTemplateDialog
          docLabel={`invoice ${dupTarget.invoiceNo}`}
          onUseCurrent={() => duplicate(dupTarget, true)}
          onKeepOriginal={() => duplicate(dupTarget, false)}
          onCancel={() => setDupTarget(null)}
        />
      )}
    </>
  );
}
