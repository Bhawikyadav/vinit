// A compact, readable quotation preview built for phones — the same data as the
// A4 QuotePreview, stacked vertically at full-size text. Shown on small screens;
// the A4 version is used on desktop and for the printed / PDF copy.
// A quotation shows NO GST in the line math — the total is pre-tax.

import { formatAmount, termLines } from "@/lib/quote";
import { contrastText, tint } from "@/lib/templates";
import type { CompanyProfile, Quote, QuoteTotals } from "@/lib/types";

function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

export default function QuotePreviewMobile({
  quote,
  totals,
  profile,
}: {
  quote: Quote;
  totals: QuoteTotals;
  profile: CompanyProfile;
}) {
  const accent = profile.accentColor || "#c0392b";
  const headText = contrastText(accent);
  const terms = termLines(quote.terms);

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
          QUOTATION
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Offices / contact */}
        <div className="px-4 py-3 text-[11px] leading-relaxed text-gray-600">
          {profile.branchOffice ? <p>Work Office: {profile.branchOffice}</p> : null}
          {profile.regOffice ? <p>Reg. Office: {profile.regOffice}</p> : null}
          <p>
            Ph: {profile.phone} · {profile.email}
          </p>
        </div>

        {/* Buyer + meta */}
        <div className="px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">M/s {quote.buyerName || "—"}</p>
          {quote.buyerAddress ? (
            <p className="whitespace-pre-line text-xs text-gray-600">{quote.buyerAddress}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
            <span>
              Date: <span className="font-medium text-gray-700">{fmtDate(quote.quoteDate)}</span>
            </span>
            <span>
              No: <span className="font-medium text-gray-700">{quote.quoteNo}</span>
            </span>
            {quote.validUntil ? (
              <span>
                Valid until: <span className="font-medium text-gray-700">{fmtDate(quote.validUntil)}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Subject + heading */}
        {quote.subject || quote.heading ? (
          <div className="px-4 py-3">
            {quote.subject ? (
              <p className="text-sm font-semibold text-gray-800 underline">Sub: {quote.subject}</p>
            ) : null}
            {quote.heading ? <p className="mt-1 text-sm font-medium text-gray-700">{quote.heading}</p> : null}
          </div>
        ) : null}

        {/* Items */}
        <div className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            Items
          </p>
          {quote.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No items yet</p>
          ) : (
            <ul className="space-y-2">
              {quote.items.map((it, i) => (
                <li key={it.id} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {i + 1}. {it.productName || <span className="text-gray-400">Untitled</span>}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-gray-900">{formatAmount(it.amount)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {it.qty || "—"}
                    {profile.quote.showUnit && it.unit ? ` ${it.unit}` : ""} × {it.rate || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totals.freight > 0 ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-sm">
              <span className="font-medium text-gray-700">Freight</span>
              <span className="font-bold text-gray-900">{formatAmount(totals.freight)}</span>
            </div>
          ) : null}
        </div>

        {/* Total */}
        <div className="px-4 py-3" style={{ backgroundColor: tint(accent, 0.94) }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-gray-700">Total (pre-GST)</span>
            <span className="text-base font-bold" style={{ color: accent }}>
              ₹ {formatAmount(totals.total)}
            </span>
          </div>
          {totals.amountInWords ? <p className="mt-1 text-[11px] text-gray-500">{totals.amountInWords}</p> : null}
        </div>

        {/* Terms */}
        {terms.length > 0 ? (
          <div className="px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
              Terms &amp; Conditions
            </p>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-gray-600">
              {terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {/* Bank details (optional) */}
        {profile.quote.showBankDetails ? (
          <div className="px-4 py-3 text-[11px] leading-relaxed text-gray-600">
            <p className="text-xs font-semibold text-gray-800">Bank Details</p>
            <p>
              {profile.bank.name}
              {profile.bank.branch ? ` · ${profile.bank.branch}` : ""}
            </p>
            <p>
              A/c {profile.bank.accountNo} · IFSC {profile.bank.ifsc}
            </p>
          </div>
        ) : null}

        {/* Signature */}
        <div className="px-4 py-3 text-right text-xs text-gray-600">
          <p className="font-medium text-gray-800">For {profile.name}</p>
          {profile.quote.showSignature && profile.signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.signature} alt="Signature" className="ml-auto mt-1 h-10 object-contain" />
          ) : null}
          <p className="mt-6 text-gray-500">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}
