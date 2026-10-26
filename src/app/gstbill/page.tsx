"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppBar from "@/components/AppBar";
import FitToWidth from "@/components/FitToWidth";
import InvoicePreview from "@/components/InvoicePreview";
import InvoicePreviewMobile from "@/components/InvoicePreviewMobile";
import { computeBill, nextInvoiceNo } from "@/lib/gst";
import { STATES } from "@/lib/states";
import { getAllBills, getBill, saveBill, getProfile, isCloud } from "@/lib/storage";
import {
  emptyParty,
  type Bill,
  type CompanyProfile,
  type LineItem,
  type Party,
} from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

function blankItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsnSac: "",
    qty: 1,
    unit: "Nos",
    rate: 0,
    discount: 0,
    gstRate: 18,
  };
}

function blankBill(invoiceNo: string, profile: CompanyProfile): Bill {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    invoiceNo,
    invoiceDate: now.toISOString().slice(0, 10),
    deliveryNote: "",
    placeOfSupplyCode: profile.stateCode,
    paymentTerms: "",
    dueDate: "",
    billTo: { ...emptyParty(), stateCode: profile.stateCode },
    shipTo: emptyParty(),
    shipSameAsBill: true,
    items: [blankItem()],
    manualRoundOff: false,
    roundOff: 0,
    template: profile.template,
    accentColor: profile.accentColor,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// ---- small styled inputs ----
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500";

function Text({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-medium text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

function StateSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-medium text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select state</option>
        {STATES.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({s.code})
          </option>
        ))}
      </select>
    </label>
  );
}

function GstBillInner() {
  const params = useSearchParams();
  const editId = params.get("id");

  const [bill, setBill] = useState<Bill | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Load the company profile, then the existing bill or a fresh one.
  useEffect(() => {
    (async () => {
      const prof = await getProfile();
      setProfile(prof);
      if (editId) {
        const existing = await getBill(editId);
        if (existing) {
          setBill(existing);
          return;
        }
      }
      const all = await getAllBills();
      setBill(
        blankBill(
          nextInvoiceNo(all.map((b) => b.invoiceNo), new Date(), prof.invoicePrefix),
          prof,
        ),
      );
    })();
  }, [editId]);

  const totals = useMemo(() => (bill ? computeBill(bill) : null), [bill]);

  if (!bill || !totals || !profile) {
    return <div className="p-8 text-center text-gray-500">Loading…</div>;
  }

  // ---- mutations ----
  const patch = (p: Partial<Bill>) => setBill({ ...bill, ...p });
  const patchParty = (key: "billTo" | "shipTo", p: Partial<Party>) =>
    setBill({ ...bill, [key]: { ...bill[key], ...p } });
  const patchItem = (id: string, p: Partial<LineItem>) =>
    setBill({ ...bill, items: bill.items.map((it) => (it.id === id ? { ...it, ...p } : it)) });
  const addItem = () => setBill({ ...bill, items: [...bill.items, blankItem()] });
  const removeItem = (id: string) =>
    setBill({ ...bill, items: bill.items.filter((it) => it.id !== id) });

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      await saveBill(bill!);
      setStatus("✓ Saved" + (isCloud() ? " to cloud" : " on this device"));
    } catch (e) {
      setStatus("✕ " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      await saveBill(bill!); // keep a record of what was exported
      const { generatePdfBlob } = await import("@/lib/pdf/invoicePdf");
      const blob = await generatePdfBlob(bill!, totals!, profile!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bill!.invoiceNo.replace(/[\/\\]/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("✓ PDF downloaded & bill saved");
    } catch (e) {
      setStatus("✕ " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors";

  return (
    <div className="min-h-screen">
      <AppBar
        title={profile.name}
        subtitle="New Bill"
        status={status || undefined}
        actions={
          <>
            <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} onClick={save} disabled={busy}>
              Save
            </button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={downloadPdf} disabled={busy}>
              Download PDF
            </button>
            <button className={`${btn} gap-1.5 bg-gray-700 text-white hover:bg-gray-800`} onClick={() => setShowFull(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View
            </button>
            <Link href="/gstbill/settings" className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
              Profile
            </Link>
            <Link href="/gstbill/history" className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
              All Bills
            </Link>
          </>
        }
      />

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {/* ---------- FORM ---------- */}
        <div className="no-print min-w-0 space-y-5">
          {/* Invoice meta */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Invoice Details</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Text label="Invoice No." value={bill.invoiceNo} onChange={(v) => patch({ invoiceNo: v })} />
              <Text label="Date" type="date" value={bill.invoiceDate} onChange={(v) => patch({ invoiceDate: v })} />
              <Text label="Delivery Note / Challan" value={bill.deliveryNote} onChange={(v) => patch({ deliveryNote: v })} />
              <StateSelect label="Place of Supply" value={bill.placeOfSupplyCode} onChange={(v) => patch({ placeOfSupplyCode: v })} />
              <Text label="Payment Terms" value={bill.paymentTerms} onChange={(v) => patch({ paymentTerms: v })} />
              <Text label="Due Date" type="date" value={bill.dueDate} onChange={(v) => patch({ dueDate: v })} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Tax mode:{" "}
              <span className="font-semibold">
                {totals.intraState ? "Intra-state → CGST + SGST" : "Inter-state → IGST"}
              </span>{" "}
              (supplier: {profile.stateName})
            </p>
          </section>

          {/* Bill To */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Bill To / Buyer</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Text label="Name" value={bill.billTo.name} onChange={(v) => patchParty("billTo", { name: v })} />
              </div>
              <div className="sm:col-span-2">
                <Text label="Address" value={bill.billTo.address} onChange={(v) => patchParty("billTo", { address: v })} />
              </div>
              <Text label="GSTIN / UIN" value={bill.billTo.gstin} onChange={(v) => patchParty("billTo", { gstin: v.toUpperCase() })} />
              <StateSelect label="State & Code" value={bill.billTo.stateCode} onChange={(v) => patchParty("billTo", { stateCode: v })} />
            </div>
          </section>

          {/* Ship To */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Ship To / Consignee</h2>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={bill.shipSameAsBill}
                  onChange={(e) => patch({ shipSameAsBill: e.target.checked })}
                />
                Same as Bill To
              </label>
            </div>
            {!bill.shipSameAsBill && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Text label="Name" value={bill.shipTo.name} onChange={(v) => patchParty("shipTo", { name: v })} />
                </div>
                <div className="sm:col-span-2">
                  <Text label="Address" value={bill.shipTo.address} onChange={(v) => patchParty("shipTo", { address: v })} />
                </div>
                <Text label="GSTIN / UIN" value={bill.shipTo.gstin} onChange={(v) => patchParty("shipTo", { gstin: v.toUpperCase() })} />
                <StateSelect label="State & Code" value={bill.shipTo.stateCode} onChange={(v) => patchParty("shipTo", { stateCode: v })} />
              </div>
            )}
          </section>

          {/* Items */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Items</h2>
              <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={addItem}>
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {bill.items.map((it, i) => (
                <div key={it.id} className="rounded border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                    {bill.items.length > 1 && (
                      <button
                        className="text-xs font-medium text-red-600 hover:underline"
                        onClick={() => removeItem(it.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    <div className="col-span-2 md:col-span-3">
                      <Text label="Description" value={it.description} onChange={(v) => patchItem(it.id, { description: v })} />
                    </div>
                    <Text label="HSN/SAC" value={it.hsnSac} onChange={(v) => patchItem(it.id, { hsnSac: v })} />
                    <Text label="Qty" type="number" value={String(it.qty)} onChange={(v) => patchItem(it.id, { qty: Number(v) })} />
                    {profile.invoice.showUnit && (
                      <label className="block">
                        <span className="mb-0.5 block text-xs font-medium text-gray-600">Unit</span>
                        <select value={it.unit} onChange={(e) => patchItem(it.id, { unit: e.target.value })} className={inputCls}>
                          {!profile.units.includes(it.unit) && it.unit && <option value={it.unit}>{it.unit}</option>}
                          {profile.units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <Text label="Rate (₹)" type="number" value={String(it.rate)} onChange={(v) => patchItem(it.id, { rate: Number(v) })} />
                    {profile.invoice.showDiscount && (
                      <Text label="Disc (₹)" type="number" value={String(it.discount)} onChange={(v) => patchItem(it.id, { discount: Number(v) })} />
                    )}
                    <label className="block">
                      <span className="mb-0.5 block text-xs font-medium text-gray-600">GST %</span>
                      <select value={it.gstRate} onChange={(e) => patchItem(it.id, { gstRate: Number(e.target.value) })} className={inputCls}>
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-col justify-end">
                      <span className="mb-0.5 block text-xs font-medium text-gray-600">Line Total</span>
                      <div className="rounded bg-gray-50 px-2 py-1 text-right text-sm font-semibold">
                        ₹ {totals.rows[i]?.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---------- PREVIEW ---------- */}
        <div className="preview-scroll min-w-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
          <p className="no-print mb-2 text-xs text-gray-500">
            Live preview. Tap <span className="font-medium text-gray-700">Download PDF</span> for the printable A4 copy.
          </p>
          {/* Phone: a readable, stacked layout */}
          <div className="no-print lg:hidden">
            <InvoicePreviewMobile bill={bill} totals={totals} profile={profile} />
          </div>
          {/* Desktop screen + print: the true A4, scaled to the column */}
          <div className="a4-preview hidden lg:block">
            <FitToWidth>
              <InvoicePreview bill={bill} totals={totals} profile={profile} />
            </FitToWidth>
          </div>
        </div>
      </div>

      {/* Full-screen A4 view (original template) */}
      {showFull && (
        <div className="no-print fixed inset-0 z-50 flex flex-col bg-gray-900/95" role="dialog" aria-modal="true" aria-label="Invoice full view">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="truncate text-sm font-medium">
              Invoice · {bill.invoiceNo || "Draft"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadPdf}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowFull(false)}
                aria-label="Close preview"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto overscroll-contain p-3">
            <div className="mx-auto w-full max-w-[794px]">
              <FitToWidth>
                <InvoicePreview bill={bill} totals={totals} profile={profile} />
              </FitToWidth>
            </div>
            <p className="py-4 text-center text-xs text-white/60">
              Pinch to zoom in · tap the close button to return
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GstBillPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <GstBillInner />
    </Suspense>
  );
}
