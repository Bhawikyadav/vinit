// Pure aggregation for the sales dashboard. No UI, no fetching — give it the
// bills + quotes already loaded by the storage layer and a period, get back
// everything the dashboard renders. Reuses computeBill / computeQuote so the
// numbers match the invoices and quotations exactly.
//
// Metrics are invoiced-revenue only: an invoice is a sale the moment it exists
// (there is no paid/unpaid status in the data model), so "Total Sales" is the
// sum of invoice grand totals and "GST Collected" is the GST on those invoices.

import type { Bill, Quote } from "./types";
import { computeBill } from "./gst";
import { computeQuote } from "./quote";

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

export type PeriodKey = "thisMonth" | "lastMonth" | "thisFY" | "last12m";

export interface Period {
  key: PeriodKey;
  label: string;
  start: Date; // inclusive, local midnight
  end: Date; // exclusive, local midnight
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Indian financial year starts 1 April. Returns the start year of the FY that
// `d` falls in (e.g. any date from Apr 2026 to Mar 2027 → 2026).
function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function makePeriod(key: PeriodKey, now: Date = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "thisMonth":
      return { key, label: `${MONTHS[m]} ${y}`, start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    case "lastMonth": {
      const s = new Date(y, m - 1, 1);
      return { key, label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`, start: s, end: new Date(y, m, 1) };
    }
    case "thisFY": {
      const fy = fyStartYear(now);
      return { key, label: `FY ${fy}–${String((fy + 1) % 100).padStart(2, "0")}`, start: new Date(fy, 3, 1), end: new Date(fy + 1, 3, 1) };
    }
    case "last12m":
      return { key, label: "Last 12 months", start: new Date(y, m - 11, 1), end: new Date(y, m + 1, 1) };
  }
}

export const PERIOD_KEYS: PeriodKey[] = ["thisMonth", "lastMonth", "thisFY", "last12m"];

// The comparable window immediately before `p`, used for delta-vs-previous.
function previousPeriod(p: Period): { start: Date; end: Date } {
  const span = p.end.getTime() - p.start.getTime();
  return { start: new Date(p.start.getTime() - span), end: new Date(p.start.getTime()) };
}

// yyyy-mm-dd → local Date, or null for blank/garbage.
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function inWindow(d: Date | null, start: Date, end: Date): boolean {
  return d !== null && d.getTime() >= start.getTime() && d.getTime() < end.getTime();
}

// ---------------------------------------------------------------------------
// Shapes the dashboard consumes
// ---------------------------------------------------------------------------

export interface TrendPoint {
  label: string; // axis tick ("Oct 9", "Oct")
  value: number; // invoiced ₹ in this bucket
}

export interface TopEntry {
  name: string;
  value: number; // ₹
  count: number; // invoices or units
}

export interface InvoiceRow {
  id: string;
  no: string;
  customer: string;
  date: string; // raw yyyy-mm-dd
  amount: number; // grand total
}

export interface QuoteRow {
  id: string;
  no: string;
  customer: string;
  date: string;
  amount: number; // pre-GST total
  validUntil: string;
  expiringSoon: boolean; // valid, but within the next 7 days
  expired: boolean;
}

// A pending private follow-up reminder, surfaced on the dashboard. Not period-
// limited — a reminder is about the future, independent of the sales window.
export interface FollowUpRow {
  id: string; // the bill id (links back to the invoice)
  no: string; // invoice number
  customer: string;
  date: string; // yyyy-mm-dd follow-up date
  note: string; // private reason, "" if none
  amount: number; // the invoice grand total, for context
}

export interface Delta {
  pct: number; // signed fraction, e.g. 0.127 = +12.7%
  prev: number;
}

export interface DashboardStats {
  sales: { total: number; count: number; avg: number; delta: Delta | null };
  gst: { total: number; cgst: number; sgst: number; igst: number; delta: Delta | null };
  invoices: { count: number; delta: Delta | null };
  quotes: { count: number; pipelineValue: number; expiringSoon: number };
  split: { intra: number; inter: number }; // sales by place of supply
  trend: TrendPoint[];
  bucket: "day" | "month";
  recentInvoices: InvoiceRow[];
  recentQuotes: QuoteRow[];
  topCustomers: TopEntry[];
  topItems: TopEntry[];
  followUps: FollowUpRow[]; // pending reminders, soonest/overdue first
  hasInvoices: boolean;
  hasQuotes: boolean;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

function delta(cur: number, prev: number): Delta | null {
  if (prev <= 0) return null;
  return { pct: (cur - prev) / prev, prev };
}

const DAY = 86_400_000;

export function computeStats(
  bills: Bill[],
  quotes: Quote[],
  period: Period,
  // The signed-in company's own GST state — drives CGST+SGST (intra) vs IGST
  // (inter). Pass the live profile.stateCode; blank until a company sets it.
  homeStateCode: string = "",
  now: Date = new Date(),
): DashboardStats {
  const prev = previousPeriod(period);

  // --- Invoices in the current + previous windows ---
  const curBills = bills.filter((b) => inWindow(parseDate(b.invoiceDate), period.start, period.end));
  const prevBills = bills.filter((b) => inWindow(parseDate(b.invoiceDate), prev.start, prev.end));

  let salesTotal = 0, gstTotal = 0, cgst = 0, sgst = 0, igst = 0, intra = 0, inter = 0;
  for (const b of curBills) {
    const t = computeBill(b, homeStateCode);
    salesTotal += t.grandTotal;
    gstTotal += t.totalGst;
    cgst += t.cgst;
    sgst += t.sgst;
    igst += t.igst;
    if (t.intraState) intra += t.grandTotal;
    else inter += t.grandTotal;
  }
  const prevSales = prevBills.reduce((s, b) => s + computeBill(b).grandTotal, 0);
  const prevGst = prevBills.reduce((s, b) => s + computeBill(b).totalGst, 0);

  // --- Trend buckets: daily for short spans, monthly for long ones ---
  const spanDays = Math.round((period.end.getTime() - period.start.getTime()) / DAY);
  const bucket: "day" | "month" = spanDays <= 45 ? "day" : "month";
  const trend: TrendPoint[] = [];
  // Never plot past "now": for an in-progress period (this month, this FY) the
  // window runs to its calendar end, but future buckets would just trail at ₹0.
  // Cap the loops at today (daily) / the current month (monthly) so the line
  // always ends at the present date. Past periods are unaffected.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayLimit = Math.min(period.end.getTime(), todayStart + DAY);
  const monthLimit = Math.min(period.end.getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime());
  if (bucket === "day") {
    const buckets = new Map<number, number>();
    for (const b of curBills) {
      const d = parseDate(b.invoiceDate)!;
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      buckets.set(key, (buckets.get(key) ?? 0) + computeBill(b).grandTotal);
    }
    for (let t = period.start.getTime(); t < dayLimit; t += DAY) {
      const d = new Date(t);
      trend.push({ label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, value: buckets.get(t) ?? 0 });
    }
  } else {
    const buckets = new Map<string, number>();
    for (const b of curBills) {
      const d = parseDate(b.invoiceDate)!;
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, (buckets.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0) + computeBill(b).grandTotal);
    }
    const cursor = new Date(period.start);
    while (cursor.getTime() < monthLimit) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      trend.push({ label: MONTHS[cursor.getMonth()], value: buckets.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // --- Top customers (by invoiced ₹) over the period ---
  const custMap = new Map<string, TopEntry>();
  for (const b of curBills) {
    const name = b.billTo.name.trim() || "Unnamed";
    const e = custMap.get(name) ?? { name, value: 0, count: 0 };
    e.value += computeBill(b).grandTotal;
    e.count += 1;
    custMap.set(name, e);
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.value - a.value).slice(0, 5);

  // --- Top items / services (by taxable ₹) over the period ---
  const itemMap = new Map<string, TopEntry>();
  for (const b of curBills) {
    for (const it of b.items) {
      const name = it.description.trim();
      if (!name) continue;
      const line = Math.max(0, it.qty * it.rate - it.discount);
      const e = itemMap.get(name) ?? { name, value: 0, count: 0 };
      e.value += line;
      e.count += it.qty;
      itemMap.set(name, e);
    }
  }
  const topItems = [...itemMap.values()].sort((a, b) => b.value - a.value).slice(0, 5);

  // --- Recent activity: latest overall, not period-limited ---
  const byDateDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const recentInvoices: InvoiceRow[] = [...bills]
    .sort((a, b) => byDateDesc(a.invoiceDate || a.createdAt, b.invoiceDate || b.createdAt))
    .slice(0, 5)
    .map((b) => ({ id: b.id, no: b.invoiceNo, customer: b.billTo.name || "—", date: b.invoiceDate, amount: computeBill(b).grandTotal }));

  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const quoteRow = (q: Quote): QuoteRow => {
    const vu = parseDate(q.validUntil);
    const vt = vu ? vu.getTime() : null;
    return {
      id: q.id,
      no: q.quoteNo,
      customer: q.buyerName || "—",
      date: q.quoteDate,
      amount: computeQuote(q).total,
      validUntil: q.validUntil,
      expired: vt !== null && vt < todayMid,
      expiringSoon: vt !== null && vt >= todayMid && vt <= todayMid + 7 * DAY,
    };
  };
  const recentQuotes: QuoteRow[] = [...quotes]
    .sort((a, b) => byDateDesc(a.quoteDate || a.createdAt, b.quoteDate || b.createdAt))
    .slice(0, 5)
    .map(quoteRow);

  // --- Follow-up reminders: every pending one, soonest (incl. overdue) first.
  // Independent of the sales period — a reminder is about the next order, not the
  // window being viewed. yyyy-mm-dd sorts chronologically as plain strings.
  const followUps: FollowUpRow[] = bills
    .filter((b) => (b.followUpDate ?? "") !== "" && !b.followUpDone)
    .sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : a.followUpDate! > b.followUpDate! ? 1 : 0))
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      no: b.invoiceNo,
      customer: b.billTo.name || "—",
      date: b.followUpDate!,
      note: b.followUpNote || "",
      amount: computeBill(b, homeStateCode).grandTotal,
    }));

  // Pipeline: value of quotes raised in the period that haven't expired.
  const curQuotes = quotes.filter((q) => inWindow(parseDate(q.quoteDate), period.start, period.end));
  const liveQuotes = curQuotes.map(quoteRow).filter((q) => !q.expired);
  const pipelineValue = liveQuotes.reduce((s, q) => s + q.amount, 0);
  const expiringSoon = quotes.map(quoteRow).filter((q) => q.expiringSoon).length;

  return {
    sales: { total: salesTotal, count: curBills.length, avg: curBills.length ? salesTotal / curBills.length : 0, delta: delta(salesTotal, prevSales) },
    gst: { total: gstTotal, cgst, sgst, igst, delta: delta(gstTotal, prevGst) },
    invoices: { count: curBills.length, delta: delta(curBills.length, prevBills.length) },
    quotes: { count: curQuotes.length, pipelineValue, expiringSoon },
    split: { intra, inter },
    trend,
    bucket,
    recentInvoices,
    recentQuotes,
    topCustomers,
    topItems,
    followUps,
    hasInvoices: bills.length > 0,
    hasQuotes: quotes.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (Indian grouping + compact for big headline numbers)
// ---------------------------------------------------------------------------

// Full rupee figure with Indian digit grouping, no paise: "₹1,31,368".
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// Compact for headline KPIs: ₹3.4L, ₹1.2Cr, ₹61.5K, ₹820.
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return "₹" + trim(n / 1e7) + "Cr";
  if (a >= 1e5) return "₹" + trim(n / 1e5) + "L";
  if (a >= 1e3) return "₹" + trim(n / 1e3) + "K";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("en-IN");
}

// Signed percent for deltas: "+12.7%", "−4.0%".
export function pct(fraction: number): string {
  const sign = fraction > 0 ? "+" : fraction < 0 ? "−" : "";
  return `${sign}${Math.abs(fraction * 100).toFixed(1)}%`;
}
