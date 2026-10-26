// A compact, readable invoice preview built for phones — the same data as the
// A4 InvoicePreview, but stacked vertically at full-size text instead of a tiny
// scaled-down sheet. Shown on small screens; the A4 version is used on desktop
// and for the printed / PDF copy.

import { formatINR } from "@/lib/gst";
import { stateLabel } from "@/lib/states";
import { contrastText, tint } from "@/lib/templates";
import type { Bill, BillTotals, CompanyProfile } from "@/lib/types";

function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`text-right ${strong ? "text-base font-bold" : "text-sm font-medium text-gray-800"}`}
        style={strong && accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export default function InvoicePreviewMobile({
  bill,
  totals,
  profile,
}: {
  bill: Bill;
  totals: BillTotals;
  profile: CompanyProfile;
}) {
  const accent = bill.accentColor || profile.accentColor;
  const headText = contrastText(accent);
  const ship = bill.shipSameAsBill ? bill.billTo : bill.shipTo;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="px-4 py-4 text-center" style={{ backgroundColor: accent, color: headText }}>
        {profile.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logo} alt={profile.name} className="mx-auto mb-2 h-10 object-contain" />
        ) : null}
        <h3 className="text-lg font-bold leading-tight">{profile.name}</h3>
        {profile.tagline ? <p className="text-[11px] opacity-90">{profile.tagline}</p> : null}
        <div className="mt-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold tracking-wide">
          TAX INVOICE
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Invoice meta */}
        <div className="px-4 py-3">
          <Row label="Invoice No." value={bill.invoiceNo || "—"} />
          <Row label="Date" value={fmtDate(bill.invoiceDate)} />
          <Row label="Place of Supply" value={stateLabel(bill.placeOfSupplyCode) || "—"} />
          {bill.deliveryNote ? <Row label="Delivery Note" value={bill.deliveryNote} /> : null}
          {bill.paymentTerms ? <Row label="Payment Terms" value={bill.paymentTerms} /> : null}
          {bill.dueDate ? <Row label="Due Date" value={fmtDate(bill.dueDate)} /> : null}
          <p className="mt-1 text-[11px] text-gray-400">
            {totals.intraState ? "CGST + SGST (intra-state)" : "IGST (inter-state)"}
          </p>
        </div>

        {/* Supplier */}
        <div className="px-4 py-3 text-xs leading-relaxed text-gray-600">
          <p className="text-sm font-semibold text-gray-800">{profile.name}</p>
          <p>GSTIN: {profile.gstin}</p>
          {profile.regOffice ? <p>{profile.regOffice}</p> : null}
          {profile.phone ? <p>Phone: {profile.phone}</p> : null}
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
          {[
            { t: "Bill To / Buyer", p: bill.billTo },
            { t: "Ship To / Consignee", p: ship },
          ].map((c) => (
            <div key={c.t}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
                {c.t}
              </p>
              <p className="text-sm font-medium text-gray-800">{c.p.name || "—"}</p>
              {c.p.address ? <p className="whitespace-pre-line text-xs text-gray-600">{c.p.address}</p> : null}
              <p className="text-xs text-gray-500">GSTIN: {c.p.gstin || "—"}</p>
              <p className="text-xs text-gray-500">{stateLabel(c.p.stateCode) || "—"}</p>
            </div>
          ))}
        </div>

        {/* Items */}
        <div className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            Items
          </p>
          {bill.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No items yet</p>
          ) : (
            <ul className="space-y-2">
              {bill.items.map((it, i) => {
                const r = totals.rows[i];
                return (
                  <li key={it.id} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {i + 1}. {it.description || <span className="text-gray-400">Untitled item</span>}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-gray-900">₹ {formatINR(r.total)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                      {it.hsnSac ? <span>HSN {it.hsnSac}</span> : null}
                      <span>
                        {it.qty}
                        {profile.invoice.showUnit ? ` ${it.unit}` : ""} × ₹{formatINR(it.rate)}
                      </span>
                      {profile.invoice.showDiscount && it.discount ? <span>− ₹{formatINR(it.discount)} disc</span> : null}
                      <span>Taxable ₹{formatINR(r.taxable)}</span>
                      <span>
                        GST {it.gstRate}% = ₹{formatINR(r.gstAmount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Totals */}
        <div className="px-4 py-3" style={{ backgroundColor: tint(accent, 0.94) }}>
          <Row label="Subtotal" value={`₹ ${formatINR(totals.subtotal)}`} />
          {totals.intraState ? (
            <>
              <Row label="CGST" value={`₹ ${formatINR(totals.cgst)}`} />
              <Row label="SGST" value={`₹ ${formatINR(totals.sgst)}`} />
            </>
          ) : (
            <Row label="IGST" value={`₹ ${formatINR(totals.igst)}`} />
          )}
          {totals.roundOff ? <Row label="Round Off" value={`₹ ${formatINR(totals.roundOff)}`} /> : null}
          <div className="mt-1 border-t border-black/10 pt-2">
            <Row label="Grand Total" value={`₹ ${formatINR(totals.grandTotal)}`} strong accent={accent} />
          </div>
          {totals.amountInWords ? (
            <p className="mt-1 text-[11px] text-gray-500">{totals.amountInWords}</p>
          ) : null}
        </div>

        {/* Bank + declaration — each optional; the sign-off always shows */}
        <div className="px-4 py-3 text-[11px] leading-relaxed text-gray-600">
          {profile.invoice.showBankDetails ? (
            <>
              <p className="text-xs font-semibold text-gray-800">Bank Details</p>
              <p>
                {profile.bank.name}
                {profile.bank.branch ? ` · ${profile.bank.branch}` : ""}
              </p>
              <p>
                A/c {profile.bank.accountNo} · IFSC {profile.bank.ifsc}
              </p>
            </>
          ) : null}
          {profile.invoice.showDeclaration && profile.declaration ? (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-800">Declaration</p>
              <p>{profile.declaration}</p>
            </>
          ) : null}
          <div className="mt-3">
            {profile.invoice.showSignature && profile.signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.signature} alt="Signature" className="h-10 object-contain" />
            ) : null}
            <p className="font-medium text-gray-800">For {profile.name}</p>
            <p className="text-gray-500">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
