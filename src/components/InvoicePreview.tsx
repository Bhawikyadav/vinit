// Live, print-ready A4 invoice preview. Mirrors the five react-pdf layouts in
// src/lib/pdf/invoicePdf.tsx exactly, so what's on screen is what prints:
// classic (original) / banner / minimal / sidebar / premium. Always on white.

import { formatINR } from "@/lib/gst";
import { stateLabel } from "@/lib/states";
import { getTemplate, contrastText, tint } from "@/lib/templates";
import { nameCss } from "@/lib/nameStyle";
import { partyAddress } from "@/lib/types";
import type { Bill, BillTotals, CompanyProfile, LineItem, ItemTotals } from "@/lib/types";

const DARK = "#111827";
const SLATE = "#1f2937";
const MUTED = "#4b5563";

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

type Align = "left" | "right" | "center";
const alignCls = (a: Align) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

interface Col {
  key: string;
  label: string;
  align: Align;
  get: (it: LineItem, r: ItemTotals, i: number) => string;
}

function buildCols(profile: CompanyProfile): Col[] {
  const cols: (Col | false)[] = [
    { key: "sl", label: "Sl", align: "center", get: (_it, _r, i) => String(i + 1) },
    { key: "desc", label: "Description of Goods / Services", align: "left", get: (it) => it.description },
    { key: "hsn", label: "HSN/SAC", align: "center", get: (it) => it.hsnSac },
    { key: "qty", label: "Qty", align: "right", get: (it) => (it.qty ? String(it.qty) : "") },
    profile.invoice.showUnit && { key: "unit", label: "Unit", align: "center", get: (it) => it.unit },
    { key: "rate", label: "Rate (₹)", align: "right", get: (it) => formatINR(it.rate) },
    profile.invoice.showDiscount && { key: "disc", label: "Disc (₹)", align: "right", get: (it) => (it.discount ? formatINR(it.discount) : "—") },
    { key: "taxable", label: "Taxable (₹)", align: "right", get: (_it, r) => formatINR(r.taxable) },
    { key: "gstp", label: "GST %", align: "right", get: (it) => `${it.gstRate}%` },
    { key: "gstamt", label: "GST Amt (₹)", align: "right", get: (_it, r) => formatINR(r.gstAmount) },
    { key: "total", label: "Total (₹)", align: "right", get: (_it, r) => formatINR(r.total) },
  ];
  return cols.filter(Boolean) as Col[];
}

function taxRows(totals: BillTotals): { label: string; value: number }[] {
  const rows = [{ label: "Subtotal", value: totals.subtotal }];
  if (totals.intraState) rows.push({ label: "CGST", value: totals.cgst }, { label: "SGST", value: totals.sgst });
  else rows.push({ label: "IGST", value: totals.igst });
  rows.push({ label: "Round Off", value: totals.roundOff });
  return rows;
}

function metaItems(bill: Bill): { label: string; value: string }[] {
  return [
    { label: "Invoice No.", value: bill.invoiceNo || "—" },
    { label: "Date", value: fmtDate(bill.invoiceDate) || "—" },
    { label: "Delivery Note / Challan", value: bill.deliveryNote || "—" },
    { label: "Place of Supply", value: stateLabel(bill.placeOfSupplyCode) || "—" },
    { label: "Payment Terms", value: bill.paymentTerms || "—" },
    { label: "Due Date", value: fmtDate(bill.dueDate) || "—" },
  ];
}

interface TableTheme {
  headBg?: string;
  headColor: string;
  headUpper?: boolean;
  headBorderBottom?: string;
  cellDivider?: string;
  rowLine?: string;
  outer?: string;
  zebra?: [string, string];
}

function ItemsTable({ cols, items, rows, theme }: { cols: Col[]; items: LineItem[]; rows: ItemTotals[]; theme: TableTheme }) {
  return (
    <table className="w-full border-collapse text-[10px]" style={{ border: theme.outer ? `1px solid ${theme.outer}` : undefined }}>
      <thead>
        <tr style={{ backgroundColor: theme.headBg, color: theme.headColor, borderBottom: theme.headBorderBottom }}>
          {cols.map((c, ci) => (
            <th
              key={c.key}
              className={`p-1 font-bold ${alignCls(c.align)} ${theme.headUpper ? "uppercase tracking-wide text-[8px]" : ""}`}
              style={{ borderRight: theme.cellDivider && ci < cols.length - 1 ? `1px solid ${theme.cellDivider}` : undefined }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={cols.length} className="p-3 text-center text-gray-400">No items yet</td>
          </tr>
        ) : (
          items.map((it, i) => {
            const r = rows[i];
            const bg = theme.zebra ? theme.zebra[i % 2] : undefined;
            return (
              <tr key={it.id} className="align-top" style={{ backgroundColor: bg, borderTop: theme.rowLine ? `1px solid ${theme.rowLine}` : undefined }}>
                {cols.map((c, ci) => (
                  <td key={c.key} className={`p-1 ${alignCls(c.align)}`} style={{ borderRight: theme.cellDivider && ci < cols.length - 1 ? `1px solid ${theme.cellDivider}` : undefined }}>
                    {c.get(it, r, i)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function SignOff({ profile, align = "left" }: { profile: CompanyProfile; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "flex flex-col items-end text-right" : ""}>
      <p className="font-bold">For {profile.name}</p>
      {profile.invoice.showSignature && profile.signature ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.signature} alt="Signature" className="my-1 h-12 object-contain" />
      ) : (
        <div className="h-9" />
      )}
      <p>Authorised Signatory</p>
    </div>
  );
}

interface Ctx {
  bill: Bill;
  totals: BillTotals;
  profile: CompanyProfile;
  accent: string;
  ship: Bill["billTo"];
  cols: Col[];
  meta: { label: string; value: string }[];
  tax: { label: string; value: number }[];
}

const logoEl = (profile: CompanyProfile, cls: string) =>
  profile.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.logo} alt={profile.name} className={cls} />
  ) : null;

// Seller GSTIN / address / contact for the header-led layouts (banner, premium),
// where the body carries no company block. Mirrors the identity the classic
// letterhead prints so the buyer can always see the GSTIN, address and contact.
// `cls` sets the colour/scale so each header keeps its palette (on-accent vs. on-dark).
function HeaderSellerLines({ profile, cls }: { profile: CompanyProfile; cls: string }) {
  return (
    <div className={`mt-1 ${cls}`}>
      <p>GSTIN: {profile.gstin}</p>
      <p>{profile.regOffice}</p>
      {profile.branchOffice && <p>{profile.branchOffice}</p>}
      <p>Phone {profile.phone} · Email {profile.email}</p>
    </div>
  );
}

// 1 · CLASSIC — original layout
function ClassicInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const bc = "#9ca3af";
  const partyHeadBg = tint(accent, 0.94);
  const grandBg = tint(accent, 0.85);
  return (
    <div className="flex min-h-[1123px] flex-col p-6 text-[11px] leading-snug">
      <div className="mb-2 flex flex-col items-center text-center">
        {logoEl(profile, "mb-1 h-14 object-contain")}
        <h1 className="text-2xl font-bold leading-tight" style={{ color: accent, ...nameCss(profile.invoice.name) }}>{profile.name}</h1>
        <p className="text-xs" style={{ color: MUTED }}>{profile.tagline}</p>
        <p className="mt-1 text-base font-bold">TAX INVOICE</p>
      </div>

      <div className="flex border" style={{ borderColor: bc }}>
        <div className="w-[55%] border-r p-2" style={{ borderColor: bc }}>
          <p className="font-bold">{profile.name}</p>
          <p>{profile.tagline}</p>
          <p>Proprietor: {profile.proprietor}</p>
          <p>GSTIN: {profile.gstin}</p>
          <p>Registered Office: {profile.regOffice}</p>
          {profile.branchOffice && <p>Branch Office: {profile.branchOffice}</p>}
          <p>Phone: {profile.phone} &nbsp; Email: {profile.email}</p>
        </div>
        <div className="grid w-[45%] grid-cols-2 gap-2 p-2">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="text-[9px] uppercase tracking-wide text-gray-500">{m.label}</div>
              <div className="font-semibold">{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex border border-t-0" style={{ borderColor: bc }}>
        {[
          { title: "Bill To / Buyer", p: bill.billTo },
          { title: "Ship To / Consignee", p: ship },
        ].map((col, i) => (
          <div key={col.title} className={`w-1/2 ${i === 0 ? "border-r" : ""}`} style={{ borderColor: bc }}>
            <div className="border-b p-1 font-bold" style={{ borderColor: bc, backgroundColor: partyHeadBg }}>{col.title}</div>
            <div className="min-h-[70px] p-2">
              <p className="font-semibold">{col.p.name || "—"}</p>
              <p className="whitespace-pre-line">{partyAddress(col.p)}</p>
              <p>GSTIN/UIN: {col.p.gstin || "—"}</p>
              <p>State &amp; Code: {stateLabel(col.p.stateCode) || "—"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-t-0" style={{ borderColor: bc }}>
        <ItemsTable cols={cols} items={bill.items} rows={totals.rows} theme={{ headBg: SLATE, headColor: "#fff", cellDivider: "#e5e7eb", rowLine: "#e5e7eb" }} />
      </div>

      <div className="flex border border-t-0" style={{ borderColor: bc }}>
        <div className="w-[58%] border-r p-2" style={{ borderColor: bc }}>
          <p className="font-bold">Amount in words:</p>
          <p>{totals.amountInWords}</p>
        </div>
        <div className="w-[42%]">
          {tax.map((t) => (
            <div key={t.label} className="flex border-b" style={{ borderColor: bc }}>
              <div className="w-[55%] border-r p-1" style={{ borderColor: bc }}>{t.label}</div>
              <div className="w-[45%] p-1 text-right">₹ {formatINR(t.value)}</div>
            </div>
          ))}
          <div className="flex font-bold" style={{ backgroundColor: grandBg }}>
            <div className="w-[55%] border-r p-1" style={{ borderColor: bc }}>Grand Total</div>
            <div className="w-[45%] p-1 text-right">₹ {formatINR(totals.grandTotal)}</div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex border" style={{ borderColor: bc }}>
        {profile.invoice.showBankDetails && (
          <div className="w-1/2 border-r p-2" style={{ borderColor: bc }}>
            <p className="font-bold">Bank Details</p>
            <p>Bank: {profile.bank.name}</p>
            <p>Branch: {profile.bank.branch}</p>
            <p>A/c No.: {profile.bank.accountNo}</p>
            <p>IFSC: {profile.bank.ifsc}</p>
          </div>
        )}
        <div className={`${profile.invoice.showBankDetails ? "w-1/2" : "w-full"} p-2`}>
          {profile.invoice.showDeclaration && (
            <>
              <p className="font-bold">Declaration</p>
              <p className="mb-2">{profile.declaration}</p>
            </>
          )}
          <SignOff profile={profile} />
        </div>
      </div>
    </div>
  );
}

// 2 · BANNER
function BannerInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const onAccent = contrastText(accent);
  const bodyMeta = meta.slice(2);
  return (
    <div className="flex min-h-[1123px] flex-col text-[11px] leading-snug">
      <div className="flex items-center justify-between p-5" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="flex max-w-[62%] items-center gap-3">
          {logoEl(profile, "h-12 object-contain")}
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={nameCss(profile.invoice.name)}>{profile.name}</h1>
            <p className="text-xs opacity-85">{profile.tagline}</p>
            <HeaderSellerLines profile={profile} cls="text-[9px] leading-snug opacity-85" />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-widest">INVOICE</p>
          <p className="text-xs">No: {bill.invoiceNo || "—"}</p>
          <p className="text-xs">Date: {fmtDate(bill.invoiceDate) || "—"}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex flex-wrap">
          {bodyMeta.map((m) => (
            <div key={m.label} className="w-1/4 py-0.5">
              <div className="text-[9px] text-gray-500">{m.label}</div>
              <div className="font-semibold">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-3 flex gap-3">
          {[
            { title: "Bill To", p: bill.billTo },
            { title: "Ship To", p: ship },
          ].map((col) => (
            <div key={col.title} className="w-1/2 p-2" style={{ backgroundColor: tint(accent, 0.92), borderLeft: `3px solid ${accent}` }}>
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>{col.title}</p>
              <p className="font-semibold">{col.p.name || "—"}</p>
              <p className="whitespace-pre-line">{partyAddress(col.p)}</p>
              <p>GSTIN/UIN: {col.p.gstin || "—"}</p>
              <p>State: {stateLabel(col.p.stateCode) || "—"}</p>
            </div>
          ))}
        </div>

        <ItemsTable cols={cols} items={bill.items} rows={totals.rows} theme={{ headBg: accent, headColor: onAccent, rowLine: "#e5e7eb", zebra: ["#ffffff", tint(accent, 0.96)] }} />

        <div className="mt-3 flex justify-between">
          <div className="w-[52%]">
            <p className="text-[9px] uppercase tracking-wide text-gray-500">Amount in words</p>
            <p className="font-semibold">{totals.amountInWords}</p>
          </div>
          <div className="w-[42%]">
            {tax.map((t) => (
              <div key={t.label} className="flex justify-between py-0.5">
                <span className="text-gray-500">{t.label}</span>
                <span>₹ {formatINR(t.value)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between rounded-sm p-1.5 font-bold" style={{ backgroundColor: accent, color: onAccent }}>
              <span>Grand Total</span>
              <span>₹ {formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto flex justify-between border-t border-gray-200 pt-2">
          <div className="w-[55%]">
            {profile.invoice.showBankDetails && (
              <>
                <p className="font-bold">Bank Details</p>
                <p>{profile.bank.name} · {profile.bank.branch}</p>
                <p>A/c {profile.bank.accountNo} · IFSC {profile.bank.ifsc}</p>
              </>
            )}
            {profile.invoice.showDeclaration && <p className={profile.invoice.showBankDetails ? "mt-1" : ""}>{profile.declaration}</p>}
          </div>
          <SignOff profile={profile} align="right" />
        </div>
      </div>
    </div>
  );
}

// 3 · MINIMAL
function MinimalInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const hair = "#e3e6ea";
  const labelCls = "text-[9px] uppercase tracking-widest text-gray-500";
  return (
    <div className="flex min-h-[1123px] flex-col p-10 text-[11px] leading-snug">
      <div className="mb-2.5 h-[3px] w-12" style={{ backgroundColor: accent }} />
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          {logoEl(profile, "h-11 object-contain")}
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={nameCss(profile.invoice.name)}>{profile.name}</h1>
            <p className="text-xs text-gray-500">{profile.tagline}</p>
          </div>
        </div>
        <p className="text-lg uppercase tracking-[0.3em] text-gray-400">Invoice</p>
      </div>

      <div className="my-3 border-b" style={{ borderColor: hair }} />

      <div className="flex justify-between">
        <div className="w-[32%]">
          <p className={labelCls}>From</p>
          <p className="font-semibold">{profile.name}</p>
          <p className="text-gray-500">GSTIN: {profile.gstin}</p>
          <p className="text-gray-500">{profile.regOffice}</p>
          <p className="text-gray-500">{profile.phone}</p>
          <p className="text-gray-500">{profile.email}</p>
        </div>
        <div className="w-[32%]">
          <p className={labelCls}>Billed to</p>
          <p className="font-semibold">{bill.billTo.name || "—"}</p>
          <p className="whitespace-pre-line text-gray-500">{partyAddress(bill.billTo)}</p>
          <p className="text-gray-500">GSTIN: {bill.billTo.gstin || "—"}</p>
          <p className="text-gray-500">{stateLabel(bill.billTo.stateCode) || "—"}</p>
        </div>
        <div className="w-[30%]">
          {meta.map((m) => (
            <div key={m.label} className="flex justify-between py-0.5">
              <span className="text-gray-500">{m.label}</span>
              <span className="font-semibold">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {!bill.shipSameAsBill && (
        <div className="mt-2.5">
          <p className={labelCls}>Shipped to</p>
          <p className="font-semibold">{ship.name || "—"} <span className="font-normal text-gray-500">{partyAddress(ship)}</span></p>
        </div>
      )}

      <div className="mt-5">
        <ItemsTable cols={cols} items={bill.items} rows={totals.rows} theme={{ headColor: "#6b7280", headUpper: true, headBorderBottom: `1px solid ${DARK}`, rowLine: hair }} />
      </div>

      <div className="mt-3.5 flex justify-end">
        <div className="w-[42%]">
          {tax.map((t) => (
            <div key={t.label} className="flex justify-between py-0.5">
              <span className="text-gray-500">{t.label}</span>
              <span>₹ {formatINR(t.value)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1" style={{ borderColor: DARK }}>
            <span className="text-sm font-bold">Grand Total</span>
            <span className="text-sm font-bold" style={{ color: accent }}>₹ {formatINR(totals.grandTotal)}</span>
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-gray-500">{totals.amountInWords}</p>

      <div className="mt-auto flex justify-between border-t pt-2" style={{ borderColor: hair }}>
        <div className="w-[55%] text-gray-500">
          {profile.invoice.showBankDetails && (
            <>
              <p className={labelCls}>Payment</p>
              <p>{profile.bank.name} · A/c {profile.bank.accountNo}</p>
              <p>IFSC {profile.bank.ifsc} · {profile.bank.branch}</p>
            </>
          )}
          {profile.invoice.showDeclaration && <p className="mt-1 text-gray-500">{profile.declaration}</p>}
        </div>
        <SignOff profile={profile} align="right" />
      </div>
    </div>
  );
}

// 4 · SIDEBAR
function SidebarInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const onAccent = contrastText(accent);
  const grandBg = tint(accent, 0.88);
  const railLabel = "mt-2 text-[9px] uppercase tracking-wide opacity-80";
  return (
    <div className="flex min-h-[1123px]">
      <div className="w-[150px] shrink-0 p-4" style={{ backgroundColor: accent, color: onAccent }}>
        {logoEl(profile, "mb-2 h-12 object-contain")}
        <h1 className="text-base font-bold leading-tight" style={nameCss(profile.invoice.name)}>{profile.name}</h1>
        <p className="text-[10px] opacity-85">{profile.tagline}</p>
        <p className={railLabel}>GSTIN</p>
        <p className="text-[10px]">{profile.gstin}</p>
        <p className={railLabel}>Office</p>
        <p className="text-[10px]">{profile.regOffice}</p>
        {profile.branchOffice && <p className="mt-0.5 text-[10px]">{profile.branchOffice}</p>}
        <p className={railLabel}>Contact</p>
        <p className="text-[10px]">{profile.phone}</p>
        <p className="text-[10px]">{profile.email}</p>
        {profile.invoice.showBankDetails && (
          <>
            <p className={railLabel}>Bank</p>
            <p className="text-[10px]">{profile.bank.name}</p>
            <p className="text-[10px]">A/c {profile.bank.accountNo}</p>
            <p className="text-[10px]">IFSC {profile.bank.ifsc}</p>
            <p className="text-[10px]">{profile.bank.branch}</p>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 text-[11px] leading-snug">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold tracking-wide" style={{ color: accent }}>TAX INVOICE</h2>
          <div className="text-right text-gray-500">
            {meta.slice(0, 2).map((m) => (
              <p key={m.label}>{m.label} <span className="font-semibold text-gray-900">{m.value}</span></p>
            ))}
          </div>
        </div>
        <div className="mb-3 mt-2 border-b-2" style={{ borderColor: accent }} />

        <div className="mb-3 flex justify-between">
          {[
            { title: "Bill To", p: bill.billTo },
            { title: "Ship To", p: ship },
          ].map((col) => (
            <div key={col.title} className="w-[48%]">
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: accent }}>{col.title}</p>
              <p className="font-semibold">{col.p.name || "—"}</p>
              <p className="whitespace-pre-line">{partyAddress(col.p)}</p>
              <p>GSTIN/UIN: {col.p.gstin || "—"}</p>
              <p>State: {stateLabel(col.p.stateCode) || "—"}</p>
            </div>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap">
          {meta.slice(2).map((m) => (
            <div key={m.label} className="w-1/4">
              <div className="text-[9px] text-gray-500">{m.label}</div>
              <div className="font-semibold">{m.value}</div>
            </div>
          ))}
        </div>

        <ItemsTable cols={cols} items={bill.items} rows={totals.rows} theme={{ headColor: accent, headUpper: true, headBorderBottom: `1.5px solid ${accent}`, rowLine: "#e5e7eb" }} />

        <div className="mt-3 flex justify-end">
          <div className="w-[46%]">
            {tax.map((t) => (
              <div key={t.label} className="flex justify-between py-0.5">
                <span className="text-gray-500">{t.label}</span>
                <span>₹ {formatINR(t.value)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between p-1.5 font-bold" style={{ backgroundColor: grandBg }}>
              <span>Grand Total</span>
              <span>₹ {formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-gray-500"><span className="font-semibold">In words: </span>{totals.amountInWords}</p>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div className="w-[55%] text-gray-500">
            {profile.invoice.showDeclaration && <p>{profile.declaration}</p>}
          </div>
          <SignOff profile={profile} align="right" />
        </div>
      </div>
    </div>
  );
}

// 5 · PREMIUM
function PremiumInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const micro = "mb-0.5 text-[9px] font-bold uppercase tracking-wide";
  const bodyMeta = meta.slice(2);
  return (
    <div className="flex min-h-[1123px] flex-col text-[11px] leading-snug">
      <div className="flex items-center justify-between p-5" style={{ backgroundColor: SLATE }}>
        <div className="flex max-w-[60%] items-center gap-3">
          {logoEl(profile, "h-12 object-contain")}
          <div>
            <h1 className="text-2xl font-bold leading-tight text-white" style={nameCss(profile.invoice.name)}>{profile.name}</h1>
            <p className="text-xs tracking-wide text-white">{profile.tagline}</p>
            <HeaderSellerLines profile={profile} cls="text-[9px] leading-snug text-gray-300" />
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-widest text-white">TAX INVOICE</p>
          <p className="text-xs text-gray-300">No: {bill.invoiceNo || "—"}</p>
          <p className="text-xs text-gray-300">Date: {fmtDate(bill.invoiceDate) || "—"}</p>
        </div>
      </div>
      <div className="h-[3px]" style={{ backgroundColor: accent }} />

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex justify-between">
          <div className="w-[34%]">
            <p className={micro} style={{ color: accent }}>Bill To</p>
            <p className="font-semibold">{bill.billTo.name || "—"}</p>
            <p className="whitespace-pre-line text-gray-500">{partyAddress(bill.billTo)}</p>
            <p className="text-gray-500">GSTIN: {bill.billTo.gstin || "—"}</p>
            <p className="text-gray-500">{stateLabel(bill.billTo.stateCode) || "—"}</p>
          </div>
          <div className="w-[34%]">
            <p className={micro} style={{ color: accent }}>Ship To</p>
            <p className="font-semibold">{ship.name || "—"}</p>
            <p className="whitespace-pre-line text-gray-500">{partyAddress(ship)}</p>
            <p className="text-gray-500">GSTIN: {ship.gstin || "—"}</p>
            <p className="text-gray-500">{stateLabel(ship.stateCode) || "—"}</p>
          </div>
          <div className="w-[26%]">
            {bodyMeta.map((m) => (
              <div key={m.label} className="mb-0.5">
                <div className="text-[9px] text-gray-500">{m.label}</div>
                <div className="font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <ItemsTable cols={cols} items={bill.items} rows={totals.rows} theme={{ headBg: SLATE, headColor: "#fff", headUpper: true, rowLine: "#e5e7eb" }} />

        <div className="mt-3.5 flex justify-between">
          <div className="w-1/2">
            <p className={micro} style={{ color: accent }}>Amount in words</p>
            <p className="font-semibold">{totals.amountInWords}</p>
          </div>
          <div className="w-[44%]">
            {tax.map((t) => (
              <div key={t.label} className="flex justify-between py-0.5">
                <span className="text-gray-500">{t.label}</span>
                <span>₹ {formatINR(t.value)}</span>
              </div>
            ))}
            <div className="mt-1.5 flex items-center justify-between p-2" style={{ backgroundColor: SLATE }}>
              <span className="text-[9px] font-bold uppercase tracking-wide text-white">Amount Due</span>
              <span className="text-base font-bold text-white">₹ {formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto flex justify-between border-t border-gray-200 pt-2">
          <div className="w-[55%]">
            {profile.invoice.showBankDetails && (
              <>
                <p className={micro} style={{ color: accent }}>Bank Details</p>
                <p className="text-gray-500">{profile.bank.name} · A/c {profile.bank.accountNo}</p>
                <p className="text-gray-500">IFSC {profile.bank.ifsc} · {profile.bank.branch}</p>
              </>
            )}
            {profile.invoice.showDeclaration && <p className="mt-1 text-gray-500">{profile.declaration}</p>}
          </div>
          <SignOff profile={profile} align="right" />
        </div>
      </div>
    </div>
  );
}

export default function InvoicePreview({ bill, totals, profile }: { bill: Bill; totals: BillTotals; profile: CompanyProfile }) {
  const spec = getTemplate(bill.template ?? profile.template);
  const accent = bill.accentColor || profile.accentColor;
  const ship = bill.shipSameAsBill ? bill.billTo : bill.shipTo;
  const ctx: Ctx = { bill, totals, profile, accent, ship, cols: buildCols(profile), meta: metaItems(bill), tax: taxRows(totals) };

  const layout =
    spec.id === "banner" ? <BannerInvoice {...ctx} /> :
    spec.id === "minimal" ? <MinimalInvoice {...ctx} /> :
    spec.id === "sidebar" ? <SidebarInvoice {...ctx} /> :
    spec.id === "premium" ? <PremiumInvoice {...ctx} /> :
    <ClassicInvoice {...ctx} />;

  return <div className="print-area mx-auto w-full max-w-[794px] overflow-hidden bg-white text-gray-900 shadow-sm">{layout}</div>;
}
