// Default company profile for VM Enterprises.
//
// This is the SEED / fallback. The live profile is editable from the Settings
// page and stored via the storage layer (localStorage now, cloud later).
// Code that just needs a default still imports COMPANY.

import type { CompanyProfile } from "./types";

export const DEFAULT_PROFILE: CompanyProfile = {
  name: "VM ENTERPRISES",
  tagline: "FIRE SAFETY & SOLUTIONS",
  proprietor: "Vinit Yadav",
  gstin: "08ASRPY0599D1ZZ",
  stateCode: "08", // Rajasthan — decides CGST+SGST (intra) vs IGST (inter)
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
  invoicePrefix: "VM", // invoice numbers look like VM/2026-27/001
  logo: "",
  signature: "",
  accentColor: "#c0392b",
  units: ["Nos", "Pcs", "Set", "Kg", "Mtr", "Ltr", "Box", "Hour", "Service"],
  template: "classic", // invoice layout — the original VM Enterprises look
  quoteTemplate: "classic", // quotation layout — picked independently in Settings
  // Invoice shows everything by default (matches the original fixed layout).
  invoice: {
    showUnit: true,
    showDiscount: true,
    showSignature: true,
    showBankDetails: true,
    showDeclaration: true,
  },
  // Quotation shows the stamp when one is uploaded; bank details are opt-in so
  // the default quote keeps its original, cleaner look.
  quote: {
    showUnit: true,
    showSignature: true,
    showBankDetails: false,
  },
};

// Backward-compatible alias used as the default where the live profile isn't loaded.
export const COMPANY = DEFAULT_PROFILE;
