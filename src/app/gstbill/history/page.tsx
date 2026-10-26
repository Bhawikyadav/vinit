"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppBar from "@/components/AppBar";
import { COMPANY } from "@/lib/company";
import { computeBill } from "@/lib/gst";
import { stateName } from "@/lib/states";
import {
  getAllBills,
  saveBill,
  deleteBill,
  exportAllJSON,
  importJSON,
  getProfile,
  isCloud,
} from "@/lib/storage";
import type { Bill } from "@/lib/types";

export default function HistoryPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function duplicate(b: Bill) {
    const now = new Date();
    const copy: Bill = {
      ...structuredClone(b),
      id: crypto.randomUUID(),
      invoiceNo: b.invoiceNo + "-COPY",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await saveBill(copy);
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
    const blob = await generatePdfBlob(b, computeBill(b), profile);
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
    a.download = `vm-bills-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  const btn =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  return (
    <div className="min-h-screen">
      <AppBar
        title="All Bills"
        subtitle={isCloud() ? "☁ Cloud sync on" : "Saved on this device"}
        actions={
          <>
            <Link href="/gstbill" className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
              + New Bill
            </Link>
            <Link href="/gstbill/settings" className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
              Profile
            </Link>
            <button className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`} onClick={exportBackup}>
              Export
            </button>
            <button
              className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}
              onClick={() => fileRef.current?.click()}
            >
              Import
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
          </>
        }
      />

      <div className="p-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by invoice no, buyer, or date…"
        className="mb-4 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      {status && <p className="mb-3 text-sm text-gray-700">{status}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {bills.length === 0 ? (
            <>
              No bills yet.{" "}
              <Link href="/gstbill" className="font-medium text-blue-600 hover:underline">
                Create your first bill
              </Link>
              .
            </>
          ) : (
            "No bills match your search."
          )}
        </div>
      ) : (
        <>
          {/* Mobile: one card per bill */}
          <div className="space-y-3 md:hidden">
            {filtered.map((b) => {
              const t = computeBill(b);
              return (
                <div key={b.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{b.invoiceNo}</p>
                      <p className="truncate text-sm text-gray-600">{b.billTo.name || "—"}</p>
                    </div>
                    <p className="shrink-0 text-right font-semibold text-gray-900">
                      ₹ {t.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString("en-GB") : "—"} ·{" "}
                    {stateName(b.placeOfSupplyCode) || "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
                    <Link
                      href={`/gstbill?id=${b.id}`}
                      className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Open
                    </Link>
                    <button
                      className="rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-200"
                      onClick={() => downloadPdf(b)}
                    >
                      PDF
                    </button>
                    <button
                      className="rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-200"
                      onClick={() => duplicate(b)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="ml-auto rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                      onClick={() => remove(b)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Invoice No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Buyer</th>
                <th className="p-3">State</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const t = computeBill(b);
                return (
                  <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium">{b.invoiceNo}</td>
                    <td className="p-3">{b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="p-3">{b.billTo.name || "—"}</td>
                    <td className="p-3">{stateName(b.placeOfSupplyCode) || "—"}</td>
                    <td className="p-3 text-right font-semibold">
                      ₹ {t.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2 text-xs">
                        <Link href={`/gstbill?id=${b.id}`} className="font-medium text-blue-600 hover:underline">
                          Open
                        </Link>
                        <button className="font-medium text-gray-600 hover:underline" onClick={() => downloadPdf(b)}>
                          PDF
                        </button>
                        <button className="font-medium text-gray-600 hover:underline" onClick={() => duplicate(b)}>
                          Duplicate
                        </button>
                        <button className="font-medium text-red-600 hover:underline" onClick={() => remove(b)}>
                          Delete
                        </button>
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

      <p className="mt-4 text-xs text-gray-400">
        {COMPANY.name} · {bills.length} bill(s) stored
      </p>
      </div>
    </div>
  );
}
