// Default company profile — the BLANK template every new company starts from.
//
// This used to carry VM Enterprises' real details, which meant every brand-new
// account silently rendered VM's name, GSTIN and bank account until it was
// edited. That is wrong for a multi-company product: a new company must start
// with its OWN identity and empty, safe-to-share defaults. So DEFAULT_PROFILE is
// now neutral — only the structural defaults (units, templates, column toggles,
// a generic declaration) are pre-filled; all identity fields are blank.
//
// The live, per-company profile is stored per account (settings/_id = userId)
// and edited from the Settings page. Code that just needs structural defaults
// still imports COMPANY (an alias of DEFAULT_PROFILE).

import type { CompanyProfile } from "./types";

export const DEFAULT_PROFILE: CompanyProfile = {
  // ---- Identity: blank on a fresh company; filled during onboarding/Settings.
  name: "",
  tagline: "",
  proprietor: "",
  gstin: "",
  stateCode: "", // set at signup (drives CGST+SGST intra vs IGST inter-state)
  stateName: "",
  regOffice: "",
  branchOffice: "",
  phone: "",
  email: "",
  bank: { name: "", branch: "", accountNo: "", ifsc: "" },
  // ---- Generic structural defaults (safe for any company) ----
  declaration:
    "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
  invoicePrefix: "INV", // invoice numbers look like INV/2026-27/001
  logo: "",
  signature: "",
  accentColor: "#1d4ed8", // neutral professional blue (each company can change it)
  units: ["Nos", "Pcs", "Set", "Kg", "Mtr", "Ltr", "Box", "Hour", "Service"],
  template: "classic",
  quoteTemplate: "classic",
  invoice: {
    showUnit: true,
    showDiscount: true,
    showSignature: true,
    showBankDetails: true,
    showDeclaration: true,
    name: { fontSize: 0, fontWeight: 0, italic: false },
  },
  quote: {
    showUnit: true,
    showTotal: true,
    showSignature: true,
    showBankDetails: false,
    name: { fontSize: 0, fontWeight: 0, italic: false },
  },
};

// Backward-compatible alias used as the default where the live profile isn't
// loaded (e.g. structural fallbacks in the GST/quote engines).
export const COMPANY = DEFAULT_PROFILE;

// VM Enterprises' real profile, kept so the original owner can restore it in one
// click from Settings (gated by NEXT_PUBLIC_VM_OWNER) — it is NOT the default
// for new companies. See src/app/gstbill/settings/page.tsx.
export const VM_PROFILE: CompanyProfile = {
  name: "VM ENTERPRISES",
  tagline: "FIRE SAFETY & SOLUTIONS",
  proprietor: "Vinit Yadav",
  gstin: "08ASRPY0599D1ZZ",
  stateCode: "08", // Rajasthan
  stateName: "Rajasthan",
  regOffice:
    "Near Baba Lal Mandir, Village Mahtawas, Teh. Mandhan, Kotputli, Rajasthan",
  branchOffice: "F-286, Phase 2, New Palam Vihar, Gurgaon (Haryana) – 122017",
  phone: "93550 16555",
  email: "Vmfiresolutions@gmail.com",
  bank: {
    name: "State Bank of India",
    branch: "Mandhan, Distt. Alwar 301704",
    accountNo: "45338059048",
    ifsc: "SBIN0031464",
  },
  declaration:
    "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
  invoicePrefix: "VM",
  logo: "",
  signature: "",
  accentColor: "#c0392b",
  units: ["Nos", "Pcs", "Set", "Kg", "Mtr", "Ltr", "Box", "Hour", "Service"],
  template: "classic",
  quoteTemplate: "classic",
  invoice: {
    showUnit: true,
    showDiscount: true,
    showSignature: true,
    showBankDetails: true,
    showDeclaration: true,
    name: { fontSize: 0, fontWeight: 0, italic: false },
  },
  quote: {
    showUnit: true,
    showTotal: true,
    showSignature: true,
    showBankDetails: false,
    name: { fontSize: 0, fontWeight: 0, italic: false },
  },
};
