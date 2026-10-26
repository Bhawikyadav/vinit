# VM Enterprises — GST Billing

A GST tax-invoice billing app (Next.js 16 + React 19 + Tailwind v4) for **VM Enterprises · Fire Safety & Solutions**. Create invoices with a fixed company header, live CGST/SGST/IGST calculation, PDF export, and a searchable history of every bill.

> 📋 Design decisions, storage trade-offs, and research are in **[`docs/GST-BILLING-RESEARCH.md`](docs/GST-BILLING-RESEARCH.md)**.

## Run it

```bash
npm run dev     # http://localhost:3000
```

- **`/gstbill`** — create a bill (header is fixed; add line items; totals calculate live).
- **`/gstbill/history`** — list, search, re-open, duplicate, re-download, delete; Export/Import JSON backup.

## Features

- Fixed company header (edit once in `src/lib/company.ts`).
- Line items: description, HSN/SAC, qty, unit, rate, GST% → auto taxable / GST / total.
- Auto **intra-state (CGST+SGST)** vs **inter-state (IGST)** based on Place of Supply.
- Amount in words (Indian lakh/crore), round-off, auto invoice numbers (`VM/2026-27/001`).
- **Download PDF** (`@react-pdf/renderer`, real text + ₹ symbol) and **Print / Save as PDF**.

## Storage

- **Default:** browser (`localStorage`) — works immediately, this device only. Use **Export Backup** regularly.
- **Cloud sync (multi-device):** free **MongoDB Atlas**. Copy `.env.example` → `.env.local`, fill in `MONGODB_URI`, set `NEXT_PUBLIC_USE_CLOUD=1`, restart.

```
src/
  lib/        company.ts · types.ts · states.ts · gst.ts · storage.ts · mongodb.ts · pdf/invoicePdf.tsx
  components/ InvoicePreview.tsx
  app/
    gstbill/page.tsx · gstbill/history/page.tsx
    api/bills/route.ts · api/bills/[id]/route.ts   (cloud sync, active only with MONGODB_URI)
```

## Deploy

Push to GitHub → import on **Vercel** (free). For cloud sync, add `MONGODB_URI`, `MONGODB_DB`, `NEXT_PUBLIC_USE_CLOUD=1` as Vercel environment variables.
