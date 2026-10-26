// Live, print-ready quotation preview. Always renders on white "paper".
// A quotation shows NO GST in the line math — the total is pre-tax and GST is
// only noted in the terms. Uses the live company profile so edits in Settings
// (name, logo, accent colour) show here too.

import { formatAmount, termLines } from "@/lib/quote";
import type { CompanyProfile, Quote, QuoteTotals } from "@/lib/types";

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

export default function QuotePreview({
  quote,
  totals,
  profile,
}: {
  quote: Quote;
  totals: QuoteTotals;
  profile: CompanyProfile;
}) {
  const terms = termLines(quote.terms);
  const accent = profile.accentColor || "#c0392b";
  // Black bands (header + total) with white text — the accent is still used for
  // the letterhead title/tagline above.
  const headBg = "#000000";
  const headText = "#ffffff";

  return (
    <div className="print-area mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white p-6 text-[11px] leading-snug text-gray-900 shadow-sm">
      {/* Letterhead */}
      {profile.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logo} alt={profile.name} className="mx-auto mb-1 h-14 object-contain" />
      )}
      <h1 className="text-center text-2xl font-bold" style={{ color: accent }}>
        {profile.name}
      </h1>
      <p className="text-center text-xs font-semibold" style={{ color: accent }}>
        {profile.tagline}
      </p>
      <p className="mt-1 text-center text-[10px] text-gray-700">Work Office: {profile.branchOffice}</p>
      <p className="text-center text-[10px] text-gray-700">Reg. Office: {profile.regOffice}</p>
      <div className="my-1 border-t border-gray-400" />
      <p className="text-center text-[10px] text-gray-700">
        Ph: {profile.phone} &nbsp;&nbsp; Email: {profile.email}
      </p>

      {/* Buyer + date */}
      <div className="mt-5 flex items-start justify-between">
        <div className="max-w-[65%]">
          <p className="font-bold">M/s &nbsp;{quote.buyerName || "—"}</p>
          <p className="whitespace-pre-line">{quote.buyerAddress}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">Date: {fmtDate(quote.quoteDate) || "—"}</p>
          <p className="text-gray-600">Quotation No: {quote.quoteNo}</p>
          {quote.validUntil && (
            <p className="text-gray-600">Valid until: {fmtDate(quote.validUntil)}</p>
          )}
        </div>
      </div>

      {/* Subject + heading */}
      <p className="mt-4 font-bold underline">Sub: - {quote.subject}</p>
      <p className="mt-3 font-bold">{quote.heading}</p>

      {/* Items table */}
      <table className="mt-2 w-full border-collapse border border-gray-500 text-[10px]">
        <thead>
          <tr className="text-center font-bold" style={{ backgroundColor: headBg, color: headText }}>
            <th className="border border-gray-500 p-1">S.No.</th>
            <th className="border border-gray-500 p-1 text-left">Product Name</th>
            <th className="border border-gray-500 p-1">Qty</th>
            <th className="border border-gray-500 p-1">Unit</th>
            <th className="border border-gray-500 p-1">Rate</th>
            <th className="border border-gray-500 p-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-gray-500 p-3 text-center text-gray-400">
                No items yet
              </td>
            </tr>
          ) : (
            quote.items.map((it, i) => (
              <tr key={it.id} className="align-top">
                <td className="border border-gray-500 p-1 text-center">{i + 1}</td>
                <td className="border border-gray-500 p-1 font-medium">{it.productName}</td>
                <td className="border border-gray-500 p-1 text-center">{it.qty}</td>
                <td className="border border-gray-500 p-1 text-center">{it.unit}</td>
                <td className="border border-gray-500 p-1 text-center">{it.rate}</td>
                <td className="border border-gray-500 p-1 text-right">{formatAmount(it.amount)}</td>
              </tr>
            ))
          )}
          {totals.freight > 0 && (
            <tr>
              <td className="border border-gray-500 p-1" />
              <td className="border border-gray-500 p-1 font-medium">Freight</td>
              <td className="border border-gray-500 p-1" />
              <td className="border border-gray-500 p-1" />
              <td className="border border-gray-500 p-1" />
              <td className="border border-gray-500 p-1 text-right">{formatAmount(totals.freight)}</td>
            </tr>
          )}
          <tr className="font-bold" style={{ backgroundColor: headBg, color: headText }}>
            <td className="border border-gray-500 p-1" colSpan={5}>
              Total
            </td>
            <td className="border border-gray-500 p-1 text-right">₹ {formatAmount(totals.total)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-2 text-[10px]">
        <span className="font-semibold">Amount in words:</span> {totals.amountInWords}
      </p>

      {/* Terms */}
      {terms.length > 0 && (
        <div className="mt-4">
          <p className="font-bold underline">Terms &amp; Conditions:</p>
          <ol className="mt-1 list-decimal pl-5">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Signature — pinned to the bottom so the sheet fills a full page */}
      <div className="mt-auto pt-8 text-right">
        <p className="font-bold">For {profile.name}</p>
        <p className="mt-6">Authorised Signatory</p>
      </div>

      <p className="mt-4 text-center text-[9px] text-gray-500">
        This is a quotation, not a tax invoice — prices are valid subject to the terms above.
      </p>
    </div>
  );
}
