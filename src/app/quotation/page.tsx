"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonStyles } from "@/components/ui/Button";
import { IconPlus } from "@/components/dashboard/icons";
import FitToWidth from "@/components/FitToWidth";
import QuotePreview from "@/components/QuotePreview";
import QuotePreviewMobile from "@/components/QuotePreviewMobile";
import PartyAutocomplete from "@/components/PartyAutocomplete";
import ProductAutocomplete from "@/components/ProductAutocomplete";
import { nextInvoiceNo, round2 } from "@/lib/gst";
import {
  asNumber,
  blankQuote,
  blankQuoteItem,
  computeQuote,
  formatAmount,
  nextQuoteNo,
  quoteToBill,
} from "@/lib/quote";
import { getAllBills, saveBill, getProfile, isCloud } from "@/lib/storage";
import { getAllQuotes, getQuote, saveQuote } from "@/lib/quoteStorage";
import { getAllCustomers } from "@/lib/customerStorage";
import { getAllProducts } from "@/lib/productStorage";
import type { CompanyProfile, Customer, Product, Quote, QuoteItem } from "@/lib/types";

// Sentinel select value that switches the Unit field into free-text mode.
const OTHER_UNIT = "__other__";

// ---- small styled inputs (compact, themed to the app tokens) ----
const inputCls =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

function Text({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      {hint ? <span className="mt-0.5 block text-[11px] leading-tight text-faint">{hint}</span> : null}
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-y`}
      />
    </label>
  );
}

// Unit field: pick a common unit from the dropdown, or choose "Other…" to type
// any unit you want. A saved custom unit opens straight into the text box.
function UnitPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const inList = options.includes(value);
  const [other, setOther] = useState(!inList && value !== "");
  const isOther = other || (!inList && value !== "");

  return (
    <div className="space-y-1">
      <select
        value={isOther ? OTHER_UNIT : value}
        onChange={(e) => {
          if (e.target.value === OTHER_UNIT) {
            setOther(true); // keep the current text, just reveal the box
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
        className={inputCls}
      >
        {options.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value={OTHER_UNIT}>Other (type your own)…</option>
      </select>
      {isOther && (
        <input
          value={value}
          placeholder="Type a unit, e.g. Running ft"
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          autoFocus
        />
      )}
    </div>
  );
}

function QuotationInner() {
  const params = useSearchParams();
  const router = useRouter();
  const editId = params.get("id");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Saved-customer directory for the buyer-name autocomplete. A quotation only
  // reads it (its address is free-text and carries no GSTIN, so it isn't a good
  // source of truth to write back) — invoices are what populate the directory.
  useEffect(() => {
    getAllCustomers().then(setCustomers).catch(() => {});
    getAllProducts().then(setProducts).catch(() => {});
  }, []);

  // Load the company profile, then the existing quote or a fresh one.
  useEffect(() => {
    (async () => {
      const prof = await getProfile();
      setProfile(prof);
      if (editId) {
        const existing = await getQuote(editId);
        if (existing) {
          setQuote(existing);
          return;
        }
      }
      const all = await getAllQuotes();
      // Snapshot the chosen quotation template + accent so a past quote keeps
      // its look even if the default is later changed (mirrors the bill).
      setQuote({
        ...blankQuote(nextQuoteNo(all.map((q) => q.quoteNo), new Date(), prof.invoicePrefix)),
        template: prof.quoteTemplate,
        accentColor: prof.accentColor,
      });
    })();
  }, [editId]);

  const totals = useMemo(() => (quote ? computeQuote(quote) : null), [quote]);

  // Common units for the dropdown: "Each" (quotations' usual unit) plus the
  // units configured in the company profile, de-duplicated. Typing any other
  // unit is still allowed via the "Other…" option.
  const unitOptions = useMemo(
    () => Array.from(new Set(["Each", ...(profile?.units ?? [])].filter(Boolean))),
    [profile],
  );

  if (!quote || !totals || !profile) {
    return <p className="pt-10 text-center text-muted">Loading…</p>;
  }

  // ---- mutations ----
  const patch = (p: Partial<Quote>) => setQuote({ ...quote, ...p });

  const patchItem = (id: string, p: Partial<QuoteItem>) =>
    setQuote({
      ...quote,
      items: quote.items.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...p };
        // Auto-fill Amount when both Qty and Rate are plain numbers; leave it
        // for manual entry when either is free text ("750/mtr", "As per…").
        if ("qty" in p || "rate" in p) {
          const q = asNumber(next.qty);
          const r = asNumber(next.rate);
          if (q !== null && r !== null) next.amount = round2(q * r);
        }
        return next;
      }),
    });

  const addItem = () => setQuote({ ...quote, items: [...quote.items, blankQuoteItem()] });
  const removeItem = (id: string) =>
    setQuote({ ...quote, items: quote.items.filter((it) => it.id !== id) });

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      await saveQuote(quote!);
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
      await saveQuote(quote!);
      const { generateQuotePdfBlob } = await import("@/lib/pdf/quotePdf");
      const blob = await generateQuotePdfBlob(quote!, totals!, profile!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quote!.quoteNo.replace(/[\/\\]/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("✓ PDF downloaded & quotation saved");
    } catch (e) {
      setStatus("✕ " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Turn this quotation into a GST tax invoice: amounts become the taxable base,
  // GST is added on top, then open it in the invoice editor.
  async function convertToInvoice() {
    if (!confirm("Create a GST tax invoice from this quotation? GST will be added on top of the quoted amounts.")) {
      return;
    }
    setBusy(true);
    try {
      await saveQuote(quote!);
      const bill = quoteToBill(quote!, profile!);
      const bills = await getAllBills();
      bill.invoiceNo = nextInvoiceNo(bills.map((b) => b.invoiceNo), new Date(), profile!.invoicePrefix);
      await saveBill(bill);
      router.push(`/gstbill?id=${bill.id}`);
    } catch (e) {
      setStatus("✕ " + (e as Error).message);
      setBusy(false);
    }
  }

  const statusTone = status.startsWith("✕") ? "text-neg" : status.startsWith("✓") ? "text-pos" : "text-muted";

  return (
    <>
      <PageHeader
        title={editId ? "Edit quotation" : "New quotation"}
        subtitle={quote.quoteNo || "Draft"}
        backHref="/quotation/history"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={save} disabled={busy}>Save</Button>
            <Button variant="primary" size="sm" onClick={downloadPdf} disabled={busy}>Download PDF</Button>
          </>
        }
      />

      {status && <p className={`-mt-1 mb-4 text-sm ${statusTone}`}>{status}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- FORM ---------- */}
        <div className="no-print min-w-0 space-y-5">
          {/* Quotation meta */}
          <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">Quotation details</h2>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Quotation No." value={quote.quoteNo} onChange={(v) => patch({ quoteNo: v })} />
              <Text label="Date" type="date" value={quote.quoteDate} onChange={(v) => patch({ quoteDate: v })} />
              <Text label="Valid Until" type="date" value={quote.validUntil} onChange={(v) => patch({ validUntil: v })} />
              <Text
                label="GST %"
                type="number"
                value={String(quote.gstPercent)}
                onChange={(v) => patch({ gstPercent: Number(v) })}
                hint="Noted as extra, not added to the total."
              />
              <div className="col-span-2">
                <Text label="Subject" value={quote.subject} onChange={(v) => patch({ subject: v })} />
              </div>
              <div className="col-span-2">
                <Text label="Heading" value={quote.heading} onChange={(v) => patch({ heading: v })} />
              </div>
            </div>
          </section>

          {/* Buyer */}
          <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">Quotation to (M/s)</h2>
            <div className="space-y-3">
              <PartyAutocomplete
                label="Name"
                value={quote.buyerName}
                customers={customers}
                onNameChange={(v) => patch({ buyerName: v })}
                onSelect={(c) => patch({ buyerName: c.name, buyerAddress: c.address })}
                placeholder="Type a name to search saved customers…"
              />
              <Area label="Address" value={quote.buyerAddress} onChange={(v) => patch({ buyerAddress: v })} rows={3} />
            </div>
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-ink">Items</h2>
              <Button variant="secondary" size="sm" onClick={addItem}>
                <IconPlus className="h-[18px] w-[18px]" /> Add item
              </Button>
            </div>
            <div className="space-y-3">
              {quote.items.map((it, i) => {
                const autoCalc = asNumber(it.qty) !== null && asNumber(it.rate) !== null;
                return (
                  <div key={it.id} className="rounded-xl border border-hair p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-faint">Item {i + 1}</span>
                      {quote.items.length > 1 && (
                        <button
                          className="text-xs font-medium text-neg hover:underline"
                          onClick={() => removeItem(it.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      <div className="col-span-2 md:col-span-3">
                        <ProductAutocomplete
                          label="Product Name"
                          value={it.productName}
                          products={products}
                          onNameChange={(v) => patchItem(it.id, { productName: v })}
                          onSelect={(p) =>
                            patchItem(it.id, { productName: p.name, unit: p.unit, rate: String(p.rate) })
                          }
                          placeholder="Type to search saved products…"
                        />
                      </div>
                      <Text label="Qty" value={it.qty} onChange={(v) => patchItem(it.id, { qty: v })} placeholder="e.g. 20 or As per requirement" />
                      {profile.quote.showUnit && (
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-muted">Unit</span>
                          <UnitPicker value={it.unit} options={unitOptions} onChange={(v) => patchItem(it.id, { unit: v })} />
                        </label>
                      )}
                      <Text label="Rate" value={it.rate} onChange={(v) => patchItem(it.id, { rate: v })} placeholder="e.g. 7600 or 750/mtr" />
                      <div className="col-span-2 md:col-span-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-muted">
                            Amount (₹){" "}
                            {autoCalc ? (
                              <span className="font-normal text-faint">· auto Qty × Rate</span>
                            ) : (
                              <span className="font-normal text-faint">· enter manually</span>
                            )}
                          </span>
                          <input
                            type="number"
                            value={String(it.amount)}
                            onChange={(e) => patchItem(it.id, { amount: Number(e.target.value) })}
                            className={inputCls}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Freight & terms */}
          <section className="rounded-2xl border border-hair bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">Freight &amp; Terms</h2>
            <div className="space-y-3">
              <Text
                label="Freight (₹)"
                type="number"
                value={String(quote.freight)}
                onChange={(v) => patch({ freight: Number(v) })}
              />
              <Area
                label="Terms & Conditions (one per line)"
                value={quote.terms}
                onChange={(v) => patch({ terms: v })}
                rows={4}
              />
            </div>
            <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Quotation total (shown to customer)</span>
                <span className="font-semibold tabular-nums text-ink">₹ {formatAmount(totals.total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-faint">
                <span>With {totals.gstPercent}% GST (for your reference, not on quote)</span>
                <span className="tabular-nums">₹ {formatAmount(totals.withGst)}</span>
              </div>
            </div>
          </section>

          {/* Convert — the natural next step once the quote is ready */}
          <div className="flex">
            <Button variant="secondary" onClick={convertToInvoice} disabled={busy} className="w-full justify-center sm:w-auto">
              Convert to GST invoice
            </Button>
          </div>
        </div>

        {/* ---------- PREVIEW ---------- */}
        <div className="preview-scroll min-w-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
          <div className="no-print mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Live preview. Tap <span className="font-medium text-ink">Download PDF</span> for the printable A4 copy.
            </p>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setShowFull(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View
            </Button>
          </div>
          {/* Phone: a readable, stacked layout */}
          <div className="no-print lg:hidden">
            <QuotePreviewMobile quote={quote} totals={totals} profile={profile} />
          </div>
          {/* Desktop screen + print: the true A4, scaled to the column */}
          <div className="a4-preview hidden lg:block">
            <FitToWidth>
              <QuotePreview quote={quote} totals={totals} profile={profile} />
            </FitToWidth>
          </div>
        </div>
      </div>

      {/* Full-screen A4 view (original template) */}
      {showFull && (
        <div className="no-print fixed inset-0 z-50 flex flex-col bg-ink/95" role="dialog" aria-modal="true" aria-label="Quotation full view">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="truncate text-sm font-medium">Quotation · {quote.quoteNo || "Draft"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadPdf}
                disabled={busy}
                className={buttonStyles("primary", "sm")}
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowFull(false)}
                aria-label="Close preview"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
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
                <QuotePreview quote={quote} totals={totals} profile={profile} />
              </FitToWidth>
            </div>
            <p className="py-4 text-center text-xs text-white/60">
              Pinch to zoom in · tap the close button to return
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function QuotationPage() {
  return (
    <Suspense fallback={<p className="pt-10 text-center text-muted">Loading…</p>}>
      <QuotationInner />
    </Suspense>
  );
}
