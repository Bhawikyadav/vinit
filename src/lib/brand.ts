// The PRODUCT brand — the app itself. Shown on the auth pages, the home header
// and the browser tab. This is deliberately separate from each signed-in
// company's own identity (name / logo / GSTIN), which lives in CompanyProfile
// and is different for every tenant. Never put a customer company name here.

export const BRAND = {
  name: "Bill Maker",
  tagline: "GST Billing & Quotations",
} as const;
