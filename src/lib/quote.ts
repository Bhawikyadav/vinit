// Quotation engine: totals, quote-number series, number helpers, and the
// quote → tax-invoice conversion. Reuses the money/words helpers from gst.ts.

import { COMPANY } from "./company";
import { amountInWords, financialYear, round2 } from "./gst";
import {
  emptyParty,
  type Bill,
  type CompanyProfile,
  type LineItem,
  type Quote,
  type QuoteItem,
  type QuoteTotals,
} from "./types";

// Parse a string as a plain non-negative number ("7600" → 7600), else null.
// Free-text cells like "750/mtr" or "As per requirement" return null, which is
// how the form knows to leave the line Amount for manual entry.
export function asNumber(s: string): number | null {
  const t = (s ?? "").trim();
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Indian-grouped amount, decimals only when present (e.g. 1,52,000 / 1,234.50).
export function formatAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export function computeQuote(q: Quote): QuoteTotals {
  const itemsTotal = round2(
    q.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
  );
  const freight = round2(Number(q.freight) || 0);
  const total = round2(itemsTotal + freight);
  const gstPercent = Number(q.gstPercent) || 0;
  const gstAmount = round2((total * gstPercent) / 100);
  const withGst = round2(total + gstAmount);
  return {
    itemsTotal,
    freight,
    total,
    gstPercent,
    gstAmount,
    withGst,
    amountInWords: amountInWords(total),
  };
}

// Next quote number for the current financial year, e.g. VM/Q/2026-27/001.
// Kept in a series of its own so it never collides with invoice numbers.
export function nextQuoteNo(
  existing: string[],
  date: Date = new Date(),
  invoicePrefix: string = COMPANY.invoicePrefix,
): string {
  const fy = financialYear(date);
  const prefix = `${invoicePrefix}/Q/${fy}/`;
  let max = 0;
  for (const no of existing) {
    if (no && no.startsWith(prefix)) {
      const seq = parseInt(no.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// Convert a quotation into a tax invoice. Each quote line's Amount becomes the
// invoice line's taxable value (so pre-GST figures match), and GST is then
// added on top at the quote's gstPercent. The caller assigns the invoice number.
export function quoteToBill(q: Quote, profile: CompanyProfile): Bill {
  const now = new Date();
  const gstRate = Number(q.gstPercent) || 18;

  const items: LineItem[] = q.items
    .filter((it) => it.productName.trim() !== "" || (Number(it.amount) || 0) !== 0)
    .map((it) => {
      const amount = round2(Number(it.amount) || 0);
      const qn = asNumber(it.qty);
      // Pick qty/rate so that qty × rate === amount, whatever the source text was.
      const qty = qn && qn > 0 ? qn : 1;
      const rate = round2(amount / qty);
      return {
        id: crypto.randomUUID(),
        description: it.productName.trim(),
        hsnSac: "",
        qty,
        unit: it.unit || "Nos",
        rate,
        discount: 0,
        gstRate,
      };
    });

  if ((Number(q.freight) || 0) > 0) {
    items.push({
      id: crypto.randomUUID(),
      description: "Freight",
      hsnSac: "",
      qty: 1,
      unit: "Nos",
      rate: round2(Number(q.freight) || 0),
      discount: 0,
      gstRate,
    });
  }

  if (items.length === 0) {
    items.push({
      id: crypto.randomUUID(),
      description: "",
      hsnSac: "",
      qty: 1,
      unit: "Nos",
      rate: 0,
      discount: 0,
      gstRate,
    });
  }

  return {
    id: crypto.randomUUID(),
    invoiceNo: "", // caller sets via nextInvoiceNo()
    invoiceDate: now.toISOString().slice(0, 10),
    deliveryNote: "",
    placeOfSupplyCode: profile.stateCode,
    paymentTerms: "",
    dueDate: "",
    billTo: {
      ...emptyParty(),
      name: q.buyerName,
      address: q.buyerAddress,
      stateCode: profile.stateCode,
    },
    shipTo: emptyParty(),
    shipSameAsBill: true,
    items,
    manualRoundOff: false,
    roundOff: 0,
    template: profile.template,
    accentColor: profile.accentColor,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// A fresh, empty quotation seeded with generic, industry-neutral defaults. The
// subject/heading are editable per quote, so any company can tailor them.
export function blankQuote(quoteNo: string): Quote {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    quoteNo,
    quoteDate: now.toISOString().slice(0, 10),
    validUntil: "",
    subject: "Quotation cum Proposal",
    heading: "Financial Costing for the below items:",
    buyerName: "",
    buyerAddress: "",
    items: [blankQuoteItem()],
    freight: 0,
    gstPercent: 18,
    terms:
      "GST @ 18% extra on the above amount.\nBill on actual basis on the above rates.",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function blankQuoteItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    productName: "",
    qty: "1",
    unit: "Each",
    rate: "",
    amount: 0,
  };
}

// Terms stored as one-per-line text → trimmed, non-empty lines for rendering.
export function termLines(terms: string): string[] {
  return terms
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
