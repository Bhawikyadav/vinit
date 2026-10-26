// GST calculation engine + Indian amount-in-words + currency formatting.

import { COMPANY } from "./company";
import type { Bill, LineItem, BillTotals, ItemTotals } from "./types";

export const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function computeItem(item: LineItem): ItemTotals {
  const gross = (Number(item.qty) || 0) * (Number(item.rate) || 0);
  const discount = Number(item.discount) || 0;
  const taxable = round2(Math.max(0, gross - discount));
  const gstAmount = round2((taxable * (Number(item.gstRate) || 0)) / 100);
  const total = round2(taxable + gstAmount);
  return { taxable, gstAmount, total };
}

export function computeBill(
  bill: Bill,
  // The supplier's own GST state code — i.e. THIS company's home state. Pass the
  // live profile.stateCode so the CGST+SGST (intra) vs IGST (inter) split is
  // correct for every company, not just VM's Rajasthan. Falls back to the
  // structural default only when a profile hasn't loaded yet.
  homeStateCode: string = COMPANY.stateCode,
): BillTotals {
  const placeCode = bill.placeOfSupplyCode || bill.billTo.stateCode;
  // Intra-state when the place of supply is the supplier's own state. An empty
  // home state (brand-new company that hasn't set it) can't be intra-state, so
  // it defaults to IGST until the company sets its state in Settings.
  const intraState = Boolean(homeStateCode) && placeCode === homeStateCode;

  const rows = bill.items.map(computeItem);
  const subtotal = round2(rows.reduce((s, r) => s + r.taxable, 0));
  const totalGst = round2(rows.reduce((s, r) => s + r.gstAmount, 0));

  // Split each half from the total so CGST + SGST always equals the total GST.
  const cgst = intraState ? round2(totalGst / 2) : 0;
  const sgst = intraState ? round2(totalGst - cgst) : 0;
  const igst = intraState ? 0 : totalGst;

  const preRound = round2(subtotal + totalGst);
  const roundOff = bill.manualRoundOff
    ? Number(bill.roundOff) || 0
    : round2(Math.round(preRound) - preRound);
  const grandTotal = round2(preRound + roundOff);

  return {
    rows,
    subtotal,
    totalGst,
    cgst,
    sgst,
    igst,
    intraState,
    roundOff,
    grandTotal,
    amountInWords: amountInWords(grandTotal),
  };
}

// ---- Currency formatting (Indian grouping, e.g. 1,23,456.00) ----
export function formatINR(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---- Amount in words (Indian numbering: lakh / crore) ----
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o ? `${t} ${ONES[o]}` : t;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h) s += `${ONES[h]} Hundred`;
  if (r) s += `${s ? " " : ""}${below100(r)}`;
  return s;
}

export function numToWordsIndian(num: number): string {
  if (num <= 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numToWordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (num) parts.push(below1000(num));
  return parts.join(" ").trim();
}

export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  let s = `Rupees ${numToWordsIndian(rupees)}`;
  if (paise > 0) s += ` and ${numToWordsIndian(paise)} Paise`;
  return `${s} Only`;
}

// ---- Indian financial year helper, e.g. 2026-27 ----
export function financialYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1; // FY starts April (month index 3)
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endShort}`;
}

// Build the next invoice number from existing ones for the current FY.
// Format: VM/2026-27/001
export function nextInvoiceNo(
  existing: string[],
  date: Date = new Date(),
  invoicePrefix: string = COMPANY.invoicePrefix,
): string {
  const fy = financialYear(date);
  const prefix = `${invoicePrefix}/${fy}/`;
  let max = 0;
  for (const no of existing) {
    if (no && no.startsWith(prefix)) {
      const seq = parseInt(no.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
