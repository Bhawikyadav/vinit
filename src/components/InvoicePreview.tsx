// Live, print-ready invoice preview. Always renders on white "paper".
// Layout varies by template (classic / modern / minimal) and accent colour.

import { formatINR } from "@/lib/gst";
import { stateLabel } from "@/lib/states";
import { getTemplate, contrastText, tint } from "@/lib/templates";
import type { Bill, BillTotals, CompanyProfile } from "@/lib/types";

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-semibold">{value || "—"}</div>
    </div>
  );
}

export default function InvoicePreview({
  bill,
  totals,
  profile,
}: {
  bill: Bill;
  totals: BillTotals;
  profile: CompanyProfile;
}) {
  const spec = getTemplate(bill.template ?? profile.template);
  const accent = bill.accentColor || profile.accentColor;
  const ship = bill.shipSameAsBill ? bill.billTo : bill.shipTo;

  // Derived colours
  const bc = spec.borders === "full" ? "#9ca3af" : "#d1d5db"; // structural border
  const rowBc = "#e5e7eb"; // subtle item-row separators
  const headBg =
    spec.tableHead === "dark" ? "#1f2937" : spec.tableHead === "accent" ? accent : "#f3f4f6";
  const headText =
    spec.tableHead === "light" ? "#111827" : spec.tableHead === "accent" ? contrastText(accent) : "#ffffff";
  const thDivider = spec.tableHead === "light" ? bc : "rgba(255,255,255,0.28)";
  const bandBg = tint(accent, 0.9);
  const grandBg = tint(accent, 0.85);
  const titleColor = spec.id === "modern" ? accent : "#111827";

  const logoImg = profile.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.logo} alt={profile.name} className="h-14 object-contain" />
  ) : null;

  const nameBlock = (
    <div>
      <h1 className="text-2xl font-bold leading-tight" style={{ color: accent }}>
        {profile.name}
      </h1>
      <p className="text-xs text-gray-600">{profile.tagline}</p>
    </div>
  );

  // Header: centered (classic) vs split letterhead (modern / minimal)
  const header =
    spec.headerLayout === "centered" ? (
      <div
        className={`mb-2 flex flex-col items-center text-center ${spec.headerBand ? "rounded p-3" : ""}`}
        style={spec.headerBand ? { backgroundColor: bandBg } : undefined}
      >
        {logoImg && <div className="mb-1">{logoImg}</div>}
        {nameBlock}
        <p className="mt-1 text-base font-bold" style={{ color: titleColor }}>
          TAX INVOICE
        </p>
      </div>
    ) : (
      <div
        className={`mb-2 flex items-center justify-between gap-4 ${spec.headerBand ? "rounded p-3" : ""}`}
        style={spec.headerBand ? { backgroundColor: bandBg, borderLeft: `4px solid ${accent}` } : undefined}
      >
        <div className="flex items-center gap-3">
          {logoImg}
          {nameBlock}
        </div>
        <p className="text-xl font-bold" style={{ color: titleColor }}>
          TAX INVOICE
        </p>
      </div>
    );

  const th = "p-1 font-bold";
  const thCell = (label: string, align: "left" | "center" | "right", last = false) => (
    <th
      className={`${th} ${align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center"}`}
      style={{
        backgroundColor: headBg,
        color: headText,
        borderRight: last ? undefined : `1px solid ${thDivider}`,
        borderBottom: `1px solid ${spec.tableHead === "light" ? bc : headBg}`,
      }}
    >
      {label}
    </th>
  );

  return (
    <div className="print-area mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white p-6 text-[11px] leading-snug text-gray-900 shadow-sm">
      {header}

      {/* Company + meta */}
      <div className="flex border" style={{ borderColor: bc }}>
        <div className="w-[55%] border-r p-2" style={{ borderColor: bc }}>
          <p className="font-bold">{profile.name}</p>
          <p>{profile.tagline}</p>
          <p>Proprietor: {profile.proprietor}</p>
          <p>GSTIN: {profile.gstin}</p>
          <p>Registered Office: {profile.regOffice}</p>
          {profile.branchOffice && <p>Branch Office: {profile.branchOffice}</p>}
          <p>
            Phone: {profile.phone} &nbsp; Email: {profile.email}
          </p>
        </div>
        <div className="grid w-[45%] grid-cols-2 gap-2 p-2">
          <Field label="Invoice No." value={bill.invoiceNo} />
          <Field label="Date" value={fmtDate(bill.invoiceDate)} />
          <Field label="Delivery Note / Challan" value={bill.deliveryNote} />
          <Field label="Place of Supply" value={stateLabel(bill.placeOfSupplyCode)} />
          <Field label="Payment Terms" value={bill.paymentTerms} />
          <Field label="Due Date" value={fmtDate(bill.dueDate)} />
        </div>
      </div>

      {/* Bill To / Ship To */}
      <div className="flex border border-t-0" style={{ borderColor: bc }}>
        {[
          { title: "Bill To / Buyer", p: bill.billTo },
          { title: "Ship To / Consignee", p: ship },
        ].map((col, i) => (
          <div key={col.title} className={`w-1/2 ${i === 0 ? "border-r" : ""}`} style={{ borderColor: bc }}>
            <div className="border-b p-1 font-bold" style={{ borderColor: bc, backgroundColor: tint(accent, 0.94) }}>
              {col.title}
            </div>
            <div className="min-h-[70px] p-2">
              <p className="font-semibold">{col.p.name || "—"}</p>
              <p className="whitespace-pre-line">{col.p.address}</p>
              <p>GSTIN/UIN: {col.p.gstin || "—"}</p>
              <p>State &amp; Code: {stateLabel(col.p.stateCode) || "—"}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Items */}
      <table className="w-full border-collapse border border-t-0 text-[10px]" style={{ borderColor: bc }}>
        <thead>
          <tr>
            {thCell("Sl", "center")}
            {thCell("Description of Goods / Services", "left")}
            {thCell("HSN/SAC", "center")}
            {thCell("Qty", "center")}
            {profile.showUnit && thCell("Unit", "center")}
            {thCell("Rate (₹)", "right")}
            {profile.showDiscount && thCell("Disc (₹)", "right")}
            {thCell("Taxable (₹)", "right")}
            {thCell("GST %", "right")}
            {thCell("GST Amt (₹)", "right")}
            {thCell("Total (₹)", "right", true)}
          </tr>
        </thead>
        <tbody>
          {bill.items.length === 0 ? (
            <tr>
              <td colSpan={9 + (profile.showUnit ? 1 : 0) + (profile.showDiscount ? 1 : 0)} className="p-3 text-center text-gray-400">
                No items yet
              </td>
            </tr>
          ) : (
            bill.items.map((it, i) => {
              const r = totals.rows[i];
              const cell = "p-1";
              return (
                <tr key={it.id} className="align-top" style={{ borderTop: `1px solid ${rowBc}` }}>
                  <td className={`${cell} text-center`} style={{ borderRight: `1px solid ${rowBc}` }}>{i + 1}</td>
                  <td className={cell} style={{ borderRight: `1px solid ${rowBc}` }}>{it.description}</td>
                  <td className={`${cell} text-center`} style={{ borderRight: `1px solid ${rowBc}` }}>{it.hsnSac}</td>
                  <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{it.qty || ""}</td>
                  {profile.showUnit && (
                    <td className={`${cell} text-center`} style={{ borderRight: `1px solid ${rowBc}` }}>{it.unit}</td>
                  )}
                  <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{formatINR(it.rate)}</td>
                  {profile.showDiscount && (
                    <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{it.discount ? formatINR(it.discount) : "—"}</td>
                  )}
                  <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{formatINR(r.taxable)}</td>
                  <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{it.gstRate}%</td>
                  <td className={`${cell} text-right`} style={{ borderRight: `1px solid ${rowBc}` }}>{formatINR(r.gstAmount)}</td>
                  <td className={`${cell} text-right`}>{formatINR(r.total)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Amount in words + totals */}
      <div className="flex border border-t-0" style={{ borderColor: bc }}>
        <div className="w-[58%] border-r p-2" style={{ borderColor: bc }}>
          <p className="font-bold">Amount in words:</p>
          <p>{totals.amountInWords}</p>
        </div>
        <div className="w-[42%]">
          {[
            { l: "Subtotal", v: totals.subtotal },
            ...(totals.intraState
              ? [
                  { l: "CGST", v: totals.cgst },
                  { l: "SGST", v: totals.sgst },
                ]
              : [{ l: "IGST", v: totals.igst }]),
            { l: "Round Off", v: totals.roundOff },
          ].map((t) => (
            <div key={t.l} className="flex border-b" style={{ borderColor: bc }}>
              <div className="w-[55%] border-r p-1" style={{ borderColor: bc }}>{t.l}</div>
              <div className="w-[45%] p-1 text-right">₹ {formatINR(t.v)}</div>
            </div>
          ))}
          <div className="flex font-bold" style={{ backgroundColor: grandBg }}>
            <div className="w-[55%] border-r p-1" style={{ borderColor: bc }}>Grand Total</div>
            <div className="w-[45%] p-1 text-right">₹ {formatINR(totals.grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* Footer — pinned to the bottom so the sheet fills a full page */}
      <div className="mt-auto flex border" style={{ borderColor: bc }}>
        <div className="w-1/2 border-r p-2" style={{ borderColor: bc }}>
          <p className="font-bold">Bank Details</p>
          <p>Bank: {profile.bank.name}</p>
          <p>Branch: {profile.bank.branch}</p>
          <p>A/c No.: {profile.bank.accountNo}</p>
          <p>IFSC: {profile.bank.ifsc}</p>
        </div>
        <div className="w-1/2 p-2">
          <p className="font-bold">Declaration</p>
          <p>{profile.declaration}</p>
          <p className="mt-4 font-bold">For {profile.name}</p>
          {profile.signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.signature} alt="Signature" className="mt-1 h-14 object-contain" />
          ) : (
            <div className="h-10" />
          )}
          <p>Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}
