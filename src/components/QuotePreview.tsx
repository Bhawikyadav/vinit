// Live, print-ready A4 quotation preview. Mirrors the five react-pdf layouts in
// src/lib/pdf/quotePdf.tsx exactly: classic (original) / banner / minimal /
// sidebar / premium. A quotation shows NO GST in the line math — the total is
// the pre-tax figure; GST is only noted in the terms.

import { formatAmount, termLines } from "@/lib/quote";
import { getTemplate, contrastText, tint } from "@/lib/templates";
import { nameCss } from "@/lib/nameStyle";
import type { CompanyProfile, Quote, QuoteTotals } from "@/lib/types";

const DARK = "#111827";
const SLATE = "#1f2937";
const GREY = "#6b7280";

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

interface TableTheme {
  headBg?: string;
  headColor?: string;
  headUpper?: boolean;
  headBorderBottom?: string;
  gridBorder?: string; // full cell grid (classic)
  rowLine?: string;
  outer?: string;
  zebra?: [string, string];
  totalBg?: string;
  totalColor?: string;
  totalBorderTop?: string;
}

function QItemsTable({ quote, totals, showUnit, showTotal, theme }: { quote: Quote; totals: QuoteTotals; showUnit: boolean; showTotal: boolean; theme: TableTheme }) {
  const totalSpan = showUnit ? 5 : 4;
  const emptySpan = showUnit ? 6 : 5;
  const grid = theme.gridBorder ? { border: `1px solid ${theme.gridBorder}` } : undefined;
  const upper = theme.headUpper ? "uppercase tracking-wide text-[8px]" : "";
  const rowTop = theme.rowLine ? `1px solid ${theme.rowLine}` : undefined;
  const tdStyle = grid ?? { borderTop: rowTop };
  const th = (label: string, align: string) => (
    <th className={`p-1 font-bold ${align} ${upper}`} style={grid ?? { borderBottom: theme.headBorderBottom }}>{label}</th>
  );
  return (
    <table className="mt-2 w-full border-collapse text-[10px]" style={{ border: theme.outer ? `1px solid ${theme.outer}` : undefined }}>
      <thead>
        <tr style={{ backgroundColor: theme.headBg, color: theme.headColor }}>
          {th("S.No.", "text-center")}
          {th("Product Name", "text-left")}
          {th("Qty", "text-center")}
          {showUnit && th("Unit", "text-center")}
          {th("Rate", "text-center")}
          {th("Amount", "text-right")}
        </tr>
      </thead>
      <tbody>
        {quote.items.length === 0 ? (
          <tr>
            <td colSpan={emptySpan} className="p-3 text-center text-gray-400" style={grid}>No items yet</td>
          </tr>
        ) : (
          quote.items.map((it, i) => (
            <tr key={it.id} className="align-top" style={{ backgroundColor: theme.zebra ? theme.zebra[i % 2] : undefined }}>
              <td className="p-1 text-center" style={tdStyle}>{i + 1}</td>
              <td className="p-1 font-medium" style={tdStyle}>{it.productName}</td>
              <td className="p-1 text-center" style={tdStyle}>{it.qty}</td>
              {showUnit && <td className="p-1 text-center" style={tdStyle}>{it.unit}</td>}
              <td className="p-1 text-center" style={tdStyle}>{it.rate}</td>
              <td className="p-1 text-right" style={tdStyle}>{formatAmount(it.amount)}</td>
            </tr>
          ))
        )}
        {totals.freight > 0 && (
          <tr>
            <td className="p-1 font-medium" colSpan={totalSpan} style={tdStyle}>Freight</td>
            <td className="p-1 text-right" style={tdStyle}>{formatAmount(totals.freight)}</td>
          </tr>
        )}
        {showTotal && (
          <tr className="font-bold" style={{ backgroundColor: theme.totalBg, color: theme.totalColor }}>
            <td className="p-1" colSpan={totalSpan} style={grid ?? { borderTop: theme.totalBorderTop ?? rowTop }}>Total</td>
            <td className="p-1 text-right" style={grid ?? { borderTop: theme.totalBorderTop ?? rowTop }}>₹ {formatAmount(totals.total)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Terms({ terms, accentLabel }: { terms: string[]; accentLabel?: string }) {
  if (terms.length === 0) return null;
  return (
    <div className="mt-4">
      {accentLabel ? (
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accentLabel }}>Terms &amp; Conditions</p>
      ) : (
        <p className="font-bold underline">Terms &amp; Conditions:</p>
      )}
      <ol className="mt-1 list-decimal pl-5">
        {terms.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}

function QSignOff({ profile }: { profile: CompanyProfile }) {
  return (
    <div className="text-right">
      <p className="font-bold">For {profile.name}</p>
      {profile.quote.showSignature && profile.signature ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.signature} alt="Signature" className="ml-auto mt-1 h-14 object-contain" />
      ) : (
        <div className="h-10" />
      )}
      <p>Authorised Signatory</p>
    </div>
  );
}

function QBank({ profile }: { profile: CompanyProfile }) {
  if (!profile.quote.showBankDetails) return <div />;
  return (
    <div className="text-[10px] leading-relaxed text-gray-700">
      <p className="font-bold">Bank Details</p>
      <p>Bank: {profile.bank.name}</p>
      <p>Branch: {profile.bank.branch}</p>
      <p>A/c No.: {profile.bank.accountNo}</p>
      <p>IFSC: {profile.bank.ifsc}</p>
    </div>
  );
}

const NOTE = "This is a quotation, not a tax invoice — prices are valid subject to the terms above.";

interface QCtx {
  quote: Quote;
  totals: QuoteTotals;
  profile: CompanyProfile;
  accent: string;
  terms: string[];
  showUnit: boolean;
}

const logoEl = (profile: CompanyProfile, cls: string) =>
  profile.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.logo} alt={profile.name} className={cls} />
  ) : null;

// 1 · CLASSIC — original black-band quotation
function ClassicQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  return (
    <div className="flex min-h-[1123px] flex-col p-6 text-[11px] leading-snug">
      {logoEl(profile, "mx-auto mb-1 h-14 object-contain")}
      <h1 className="text-center text-2xl font-bold" style={{ color: accent, ...nameCss(profile.quote.name) }}>{profile.name}</h1>
      <p className="text-center text-xs font-semibold text-gray-900">{profile.tagline}</p>
      <p className="mt-1 text-center text-[10px] text-gray-700">Work Office: {profile.branchOffice}</p>
      <p className="text-center text-[10px] text-gray-700">Reg. Office: {profile.regOffice}</p>
      <div className="my-1 border-t border-gray-400" />
      <p className="text-center text-[10px] text-gray-700">Ph: {profile.phone} &nbsp;&nbsp; Email: {profile.email}</p>

      <div className="mt-5 flex items-start justify-between">
        <div className="max-w-[65%]">
          <p className="font-bold">M/s &nbsp;{quote.buyerName || "—"}</p>
          <p className="whitespace-pre-line">{quote.buyerAddress}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">Date: {fmtDate(quote.quoteDate) || "—"}</p>
          <p className="text-gray-600">Quotation No: {quote.quoteNo}</p>
          {quote.validUntil && <p className="text-gray-600">Valid until: {fmtDate(quote.validUntil)}</p>}
        </div>
      </div>

      <p className="mt-4 font-bold underline">Sub: - {quote.subject}</p>
      <p className="mt-3 font-bold">{quote.heading}</p>

      <QItemsTable quote={quote} totals={totals} showUnit={showUnit} showTotal={profile.quote.showTotal} theme={{ headBg: "#000", headColor: "#fff", gridBorder: GREY, outer: GREY, totalBg: "#000", totalColor: "#fff" }} />

      {profile.quote.showTotal && <p className="mt-2 text-[10px]"><span className="font-semibold">Amount in words:</span> {totals.amountInWords}</p>}

      <Terms terms={terms} />

      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
        <QBank profile={profile} />
        <QSignOff profile={profile} />
      </div>
      <p className="mt-4 text-center text-[9px] text-gray-500">{NOTE}</p>
    </div>
  );
}

// 2 · BANNER
function BannerQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const onAccent = contrastText(accent);
  return (
    <div className="flex min-h-[1123px] flex-col text-[11px] leading-snug">
      <div className="flex items-center justify-between p-5" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="flex max-w-[62%] items-center gap-3">
          {logoEl(profile, "h-12 object-contain")}
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={nameCss(profile.quote.name)}>{profile.name}</h1>
            <p className="text-xs opacity-85">{profile.tagline}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-widest">QUOTATION</p>
          <p className="text-xs">No: {quote.quoteNo || "—"}</p>
          <p className="text-xs">Date: {fmtDate(quote.quoteDate) || "—"}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex justify-between">
          <div className="w-[62%]">
            <p className="text-[9px] uppercase tracking-wide text-gray-500">Quotation for</p>
            <p className="font-bold">M/s {quote.buyerName || "—"}</p>
            <p className="whitespace-pre-line">{quote.buyerAddress}</p>
          </div>
          {quote.validUntil && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">Valid until</p>
              <p className="font-bold">{fmtDate(quote.validUntil)}</p>
            </div>
          )}
        </div>

        <p className="mt-3 font-bold" style={{ color: accent }}>Sub: {quote.subject}</p>
        <p className="mt-1 font-bold">{quote.heading}</p>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} showTotal={profile.quote.showTotal} theme={{ headBg: accent, headColor: onAccent, rowLine: "#e5e7eb", zebra: ["#ffffff", tint(accent, 0.96)], totalBg: accent, totalColor: onAccent }} />

        {profile.quote.showTotal && <p className="mt-2 text-[10px]"><span className="font-semibold">Amount in words:</span> {totals.amountInWords}</p>}

        <Terms terms={terms} accentLabel={accent} />

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-gray-200 pt-3">
          <QBank profile={profile} />
          <QSignOff profile={profile} />
        </div>
        <p className="mt-3 text-center text-[9px] text-gray-500">{NOTE}</p>
      </div>
    </div>
  );
}

// 3 · MINIMAL
function MinimalQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const hair = "#e3e6ea";
  const labelCls = "text-[9px] uppercase tracking-widest text-gray-500";
  return (
    <div className="flex min-h-[1123px] flex-col p-10 text-[11px] leading-snug">
      <div className="mb-2.5 h-[3px] w-12" style={{ backgroundColor: accent }} />
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          {logoEl(profile, "h-11 object-contain")}
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={nameCss(profile.quote.name)}>{profile.name}</h1>
            <p className="text-xs text-gray-500">{profile.tagline}</p>
          </div>
        </div>
        <p className="text-lg uppercase tracking-[0.3em] text-gray-400">Quotation</p>
      </div>

      <div className="my-3 border-b" style={{ borderColor: hair }} />

      <div className="flex justify-between">
        <div className="w-[60%]">
          <p className={labelCls}>Quotation for</p>
          <p className="font-semibold">M/s {quote.buyerName || "—"}</p>
          <p className="whitespace-pre-line text-gray-500">{quote.buyerAddress}</p>
        </div>
        <div className="w-[36%]">
          <div className="flex justify-between"><span className={labelCls}>No.</span><span className="font-semibold">{quote.quoteNo}</span></div>
          <div className="flex justify-between"><span className={labelCls}>Date</span><span className="font-semibold">{fmtDate(quote.quoteDate) || "—"}</span></div>
          {quote.validUntil && <div className="flex justify-between"><span className={labelCls}>Valid until</span><span className="font-semibold">{fmtDate(quote.validUntil)}</span></div>}
        </div>
      </div>

      <p className="mt-3 font-bold">{quote.subject}</p>
      <p className="mt-0.5 text-gray-500">{quote.heading}</p>

      <QItemsTable quote={quote} totals={totals} showUnit={showUnit} showTotal={profile.quote.showTotal} theme={{ headColor: GREY, headUpper: true, headBorderBottom: `1px solid ${DARK}`, rowLine: hair, totalBorderTop: `1px solid ${DARK}` }} />

      {profile.quote.showTotal && <p className="mt-2 text-gray-500">{totals.amountInWords}</p>}

      <Terms terms={terms} />

      <div className="mt-auto flex items-end justify-between border-t pt-3" style={{ borderColor: hair }}>
        <div className="w-[55%] text-gray-500">
          {profile.quote.showBankDetails && (
            <>
              <p className={labelCls}>Payment</p>
              <p>{profile.bank.name} · A/c {profile.bank.accountNo}</p>
              <p>IFSC {profile.bank.ifsc}</p>
            </>
          )}
        </div>
        <QSignOff profile={profile} />
      </div>
    </div>
  );
}

// 4 · SIDEBAR
function SidebarQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const onAccent = contrastText(accent);
  const grandBg = tint(accent, 0.88);
  const railLabel = "mt-2 text-[9px] uppercase tracking-wide opacity-80";
  return (
    <div className="flex min-h-[1123px]">
      <div className="w-[150px] shrink-0 p-4" style={{ backgroundColor: accent, color: onAccent }}>
        {logoEl(profile, "mb-2 h-12 object-contain")}
        <h1 className="text-base font-bold leading-tight" style={nameCss(profile.quote.name)}>{profile.name}</h1>
        <p className="text-[10px] opacity-85">{profile.tagline}</p>
        <p className={railLabel}>Office</p>
        <p className="text-[10px]">{profile.branchOffice}</p>
        <p className="mt-0.5 text-[10px]">{profile.regOffice}</p>
        <p className={railLabel}>Contact</p>
        <p className="text-[10px]">{profile.phone}</p>
        <p className="text-[10px]">{profile.email}</p>
        {profile.quote.showBankDetails && (
          <>
            <p className={railLabel}>Bank</p>
            <p className="text-[10px]">{profile.bank.name}</p>
            <p className="text-[10px]">A/c {profile.bank.accountNo}</p>
            <p className="text-[10px]">IFSC {profile.bank.ifsc}</p>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 text-[11px] leading-snug">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold tracking-wide" style={{ color: accent }}>QUOTATION</h2>
          <div className="text-right text-gray-500">
            <p>No. <span className="font-semibold text-gray-900">{quote.quoteNo}</span></p>
            <p>Date <span className="font-semibold text-gray-900">{fmtDate(quote.quoteDate) || "—"}</span></p>
            {quote.validUntil && <p>Valid until <span className="font-semibold text-gray-900">{fmtDate(quote.validUntil)}</span></p>}
          </div>
        </div>
        <div className="mb-3 mt-2 border-b-2" style={{ borderColor: accent }} />

        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>Quotation for</p>
        <p className="font-bold">M/s {quote.buyerName || "—"}</p>
        <p className="whitespace-pre-line">{quote.buyerAddress}</p>

        <p className="mt-2.5 font-bold">Sub: {quote.subject}</p>
        <p className="mt-0.5 text-gray-600">{quote.heading}</p>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} showTotal={profile.quote.showTotal} theme={{ headColor: accent, headUpper: true, headBorderBottom: `1.5px solid ${accent}`, rowLine: "#e5e7eb", totalBg: grandBg }} />

        {profile.quote.showTotal && <p className="mt-2 text-gray-600"><span className="font-semibold">In words: </span>{totals.amountInWords}</p>}

        <Terms terms={terms} accentLabel={accent} />

        <div className="mt-auto flex justify-end pt-4">
          <QSignOff profile={profile} />
        </div>
      </div>
    </div>
  );
}

// 5 · PREMIUM
function PremiumQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const micro = "text-[9px] font-bold uppercase tracking-wide";
  return (
    <div className="flex min-h-[1123px] flex-col text-[11px] leading-snug">
      <div className="flex items-center justify-between p-5" style={{ backgroundColor: SLATE }}>
        <div className="flex max-w-[60%] items-center gap-3">
          {logoEl(profile, "h-12 object-contain")}
          <div>
            <h1 className="text-2xl font-bold leading-tight text-white" style={nameCss(profile.quote.name)}>{profile.name}</h1>
            <p className="text-xs tracking-wide text-white">{profile.tagline}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-widest text-white">QUOTATION</p>
          <p className="text-xs text-gray-300">No: {quote.quoteNo || "—"}</p>
          <p className="text-xs text-gray-300">Date: {fmtDate(quote.quoteDate) || "—"}</p>
        </div>
      </div>
      <div className="h-[3px]" style={{ backgroundColor: accent }} />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex justify-between">
          <div className="w-[62%]">
            <p className={micro} style={{ color: accent }}>Quotation for</p>
            <p className="font-bold">M/s {quote.buyerName || "—"}</p>
            <p className="whitespace-pre-line text-gray-500">{quote.buyerAddress}</p>
          </div>
          {quote.validUntil && (
            <div className="text-right">
              <p className={micro} style={{ color: accent }}>Valid until</p>
              <p className="font-bold">{fmtDate(quote.validUntil)}</p>
            </div>
          )}
        </div>

        <p className="mt-3 font-bold">Sub: {quote.subject}</p>
        <p className="mt-0.5 text-gray-500">{quote.heading}</p>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} showTotal={profile.quote.showTotal} theme={{ headBg: SLATE, headColor: "#fff", headUpper: true, rowLine: "#e5e7eb", totalBg: SLATE, totalColor: "#fff" }} />

        {profile.quote.showTotal && <p className="mt-2 text-gray-500"><span className="font-semibold">Amount in words:</span> {totals.amountInWords}</p>}

        <Terms terms={terms} accentLabel={accent} />

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-gray-200 pt-3">
          <QBank profile={profile} />
          <QSignOff profile={profile} />
        </div>
      </div>
    </div>
  );
}

export default function QuotePreview({ quote, totals, profile }: { quote: Quote; totals: QuoteTotals; profile: CompanyProfile }) {
  const spec = getTemplate(quote.template ?? profile.quoteTemplate);
  const accent = quote.accentColor || profile.accentColor || "#c0392b";
  const ctx: QCtx = { quote, totals, profile, accent, terms: termLines(quote.terms), showUnit: profile.quote.showUnit };

  const layout =
    spec.id === "banner" ? <BannerQuote {...ctx} /> :
    spec.id === "minimal" ? <MinimalQuote {...ctx} /> :
    spec.id === "sidebar" ? <SidebarQuote {...ctx} /> :
    spec.id === "premium" ? <PremiumQuote {...ctx} /> :
    <ClassicQuote {...ctx} />;

  return <div className="print-area mx-auto w-full max-w-[794px] overflow-hidden bg-white text-gray-900 shadow-sm">{layout}</div>;
}
