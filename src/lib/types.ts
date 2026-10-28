// Core data shapes for a GST bill.

// The document layouts. Each is a genuinely different page architecture
// (see src/lib/templates.ts), not a recolour of one body. "classic" is the
// original VM Enterprises layout, kept intact; the other four are new. The same
// ids are offered for both the invoice and the quotation, but each document is
// picked independently (profile.template vs profile.quoteTemplate).
export type TemplateId = "classic" | "banner" | "minimal" | "sidebar" | "premium";

// Per-document typography override for the company-name heading on the printed
// letterhead. Each field's "unset" value (0 / 0 / false) means "leave the chosen
// template's built-in styling alone", so the default profile changes nothing.
export interface NameStyle {
  fontSize: number; // px on the printed document; 0 = template default
  fontWeight: number; // 400–800; 0 = template default
  italic: boolean; // false = template default (upright)
}

// What to show / hide on a printed INVOICE. Edited from the "Invoice" tab in
// Settings; the brand assets they reference (signature image, bank details) live
// on the common CompanyProfile and are shared with the quotation.
export interface InvoiceDisplay {
  showUnit: boolean; // the Unit column
  showDiscount: boolean; // the Disc column
  showSignature: boolean; // the uploaded signature / stamp image
  showBankDetails: boolean; // the Bank Details block
  showDeclaration: boolean; // the Declaration text
  name: NameStyle; // company-name heading styling on the invoice
}

// What to show / hide on a printed QUOTATION ("Quotation" tab in Settings). A
// quotation has no discount column, so that toggle is absent here.
export interface QuoteDisplay {
  showUnit: boolean; // the Unit column
  showTotal: boolean; // the grand Total row at the foot of the items table
  showSignature: boolean; // the uploaded signature / stamp image
  showBankDetails: boolean; // print the Bank Details block (off by default)
  name: NameStyle; // company-name heading styling on the quotation
}

export interface CompanyProfile {
  // ---- Common company identity & assets (shared by both documents) ----
  name: string;
  tagline: string;
  proprietor: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  regOffice: string;
  branchOffice: string;
  phone: string;
  email: string;
  bank: { name: string; branch: string; accountNo: string; ifsc: string };
  declaration: string;
  invoicePrefix: string;
  logo: string; // data URL ("data:image/...") or "" if none
  signature: string; // signature/stamp image, data URL or "" if none
  accentColor: string; // brand color, hex (e.g. "#c0392b") — used on both docs
  units: string[]; // selectable units in the item form
  // ---- Per-document template settings ----
  template: TemplateId; // INVOICE layout (grid / banner / minimal / sidebar / premium)
  quoteTemplate: TemplateId; // QUOTATION layout — chosen independently of the invoice
  invoice: InvoiceDisplay; // what the invoice shows / hides
  quote: QuoteDisplay; // what the quotation shows / hides
}

export interface Party {
  name: string;
  address: string;
  addressLine2?: string; // optional second address line, for long addresses
  gstin: string;
  stateCode: string; // GST state code, e.g. "08"
}

// A saved customer in the user's party directory — a superset of Party (the
// billing identity reused on every document) plus an id, an optional contact
// phone, and timestamps. Scoped to the owner in the `customers` collection. The
// Bill To / Ship To name fields autocomplete against it, and saving an invoice
// captures its buyer back into it so the directory builds itself.
export interface Customer {
  id: string;
  name: string;
  address: string;
  gstin: string;
  stateCode: string; // GST state code, e.g. "08"
  phone: string; // optional contact number, "" if none
  createdAt: string;
  updatedAt: string;
}

// A saved product/service in the user's catalog — the reusable fields of a line
// item (name, HSN/SAC, default unit, price, GST rate). The invoice "Description"
// and quotation "Product Name" fields autocomplete against it, and picking one
// fills those fields. Edits made on a document are LOCAL to that document — the
// catalog is only ever changed on the Products page, and (unlike customers)
// invoices never capture products back into it. Owner-scoped in `products`.
export interface Product {
  id: string;
  name: string;
  hsnSac: string; // HSN/SAC code — used on invoices; quotations ignore it
  unit: string; // default unit, e.g. "Nos"
  rate: number; // default price (₹), pre-tax
  gstRate: number; // default GST % — used on invoices; quotations ignore it
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  hsnSac: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number; // flat ₹ off this line, applied before GST
  gstRate: number; // percentage, e.g. 18
}

export interface Bill {
  id: string;
  invoiceNo: string;
  invoiceDate: string; // yyyy-mm-dd
  deliveryNote: string;
  placeOfSupplyCode: string; // GST state code; drives intra/inter-state tax
  paymentTerms: string;
  dueDate: string; // yyyy-mm-dd or ""
  billTo: Party;
  shipTo: Party;
  shipSameAsBill: boolean;
  items: LineItem[];
  manualRoundOff: boolean;
  roundOff: number;
  // Snapshot of the template/accent used when this bill was created, so a past
  // bill keeps its look even if the default is later changed. Falls back to the
  // profile default when absent.
  template?: TemplateId;
  accentColor?: string;
  // ---- Private follow-up reminder (NEVER printed on the invoice or PDF) ----
  // A date to chase the customer for the next order — surfaced only to the owner,
  // on the dashboard. All optional so older bills stay valid.
  followUpDate?: string; // yyyy-mm-dd, or "" / absent for none
  followUpNote?: string; // optional private reason ("AMC renewal", "next refill")
  followUpDone?: boolean; // true once actioned/dismissed from the dashboard
  createdAt: string;
  updatedAt: string;
}

export interface ItemTotals {
  taxable: number;
  gstAmount: number;
  total: number;
}

export interface BillTotals {
  rows: ItemTotals[];
  subtotal: number;
  totalGst: number;
  cgst: number;
  sgst: number;
  igst: number;
  intraState: boolean;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

export function emptyParty(): Party {
  return { name: "", address: "", addressLine2: "", gstin: "", stateCode: "" };
}

// The buyer/consignee address as rendered on a document: the two optional lines
// joined by a newline. Templates print it in a pre-line / <Text> context, so the
// break shows; empty lines are dropped so a one-line address stays one line.
export function partyAddress(p: Party): string {
  return [p.address, p.addressLine2].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Quotation (pre-sale "Quotation cum Proposal").
//
// Unlike a tax invoice, a quotation shows NO GST in the line math — the total
// is the pre-tax amount and GST is only a note in the terms ("GST 18% extra").
// Qty and Rate are free text so rows like qty "As per requirement" / rate
// "750/mtr" are possible; Amount is the ₹ figure for the line (auto = qty×rate
// when both are plain numbers, otherwise entered by hand).
// ---------------------------------------------------------------------------

export interface QuoteItem {
  id: string;
  productName: string;
  qty: string; // free text: "20" or "As per requirement"
  unit: string;
  rate: string; // free text: "7600" or "750/mtr"
  amount: number; // ₹ for this line (pre-GST)
}

export interface Quote {
  id: string;
  quoteNo: string; // separate series, e.g. VM/Q/2026-27/001
  quoteDate: string; // yyyy-mm-dd
  validUntil: string; // yyyy-mm-dd or ""
  subject: string; // "Fire Safety Quotation cum Proposal"
  heading: string; // "Financial Costing for …"
  buyerName: string; // M/s …
  buyerAddress: string; // multi-line
  items: QuoteItem[];
  freight: number; // shown as its own row before the total
  gstPercent: number; // used for the "GST % extra" note + invoice conversion (not added to the shown total)
  terms: string; // multi-line, one term per line
  // Snapshot of the template/accent used when this quote was created, so a past
  // quote keeps its look even if the default is later changed. Falls back to the
  // profile default (quoteTemplate / accentColor) when absent. Mirrors Bill.
  template?: TemplateId;
  accentColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteTotals {
  itemsTotal: number; // sum of item amounts
  freight: number;
  total: number; // itemsTotal + freight — the pre-GST figure shown on the quote
  gstPercent: number;
  gstAmount: number; // form-only hint, never printed on the quote
  withGst: number; // form-only hint
  amountInWords: string; // words for `total`
}
