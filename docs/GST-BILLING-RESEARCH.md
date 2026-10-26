# GST Billing Module — Research & Plan

> **Project:** `vinit` (Next.js 16 app) — a GST billing page/route for **VM Enterprises (Fire Safety & Solutions)**, modelled on apps like Vyapar.
> **Date:** 2026-10-24
> **Status:** Research complete. Nothing built yet — this doc is for you to review before we start coding.

---

## 0. What you asked for (your points, restated)

1. A **`/gstbill` page/route** — a proper billing screen.
2. The **company header stays fixed** — you should never re-type VM Enterprises' details, GSTIN, bank details etc.
3. Enter **item name, price (rate), GST, final price**, and get a **total at the bottom** — like the invoice template you shared.
4. **Not too complex**, but a proper, correct output that matches your format.
5. **Save each bill as a PDF.**
6. **Access all past bills** you've cut (a history list).
7. **How to store it** — use **Google Drive (5TB)** that you already have, or **MongoDB**, or something else? Must be **free**.
8. Research **how other people solve this**, including **public GitHub repos**, and write it all into this `.md`.

Short answer to each is in the **TL;DR** below; the detailed reasoning + sources are in the numbered sections.

---

## 1. TL;DR — The Recommendation

| Decision | Recommendation | Why |
|---|---|---|
| **Fixed header** | Store once as a **Company Profile** (a config/settings record). Pre-filled on every bill. | One business, details rarely change. |
| **PDF generation** | **`@react-pdf/renderer`** (real text PDF, embeds the ₹ font, works in-browser and on Vercel). Add a secondary **Print → Save as PDF** button for convenience. | Proven by the closest repo (Dewiride). No headless browser needed. |
| **What to store** | Store the **bill DATA (small JSON)**, not the PDF file. **Regenerate the PDF on demand.** | A 100,000-bill archive is still well under 1 GB. The PDF is just a *view* of the data. |
| **Where to store (Phase 1)** | **Local-first** in the browser (**IndexedDB**) + **Export/Import JSON backup**. 100% free, no server, works offline. | Fastest to ship; matches the proven Dewiride model; zero cost. |
| **Where to store (Phase 2, when needed)** | **MongoDB Atlas free tier** (512 MB ≈ 150k+ invoices) *or* **Supabase free tier** (Postgres + storage + login). | Needed only when you want to open bills from **multiple devices** (phone + laptop). |
| **Google Drive 5TB** | **Not** the primary store (no search, awkward, OAuth hassle, service-account quota trap). Use it as an **optional PDF backup/archive** via Google sign-in. | Invoice data is tiny; Drive's size is irrelevant. Good as a safety copy only. |
| **Access all bills** | A **`/gstbill/history`** page listing saved bills with search by number/date/buyer; click to re-open, re-print, or re-download. | — |
| **Hosting** | **Vercel free (Hobby)** tier for the Next.js app. | Free, zero-config for Next.js. |
| **e-Invoicing (govt IRN/QR)** | **Not required** for you (only mandatory above ₹5 crore turnover). | Keeps it simple — a normal Tax Invoice is compliant. |

**The one question that decides the architecture:** *Will you cut bills from only one computer, or from multiple devices (e.g., laptop + phone)?*
- **One device →** go local-first (Phase 1 only). Simplest, free, done.
- **Multiple devices →** add a free cloud database (Phase 2).

My suggestion: **build Phase 1 first** (it's quick and free), use it, and we add cloud sync only if/when you actually feel the need.

---

## 2. Point 1 & 2 — The bill page and the fixed header

### 2.1 The fixed header (never type it again)
Your company details are constant, so they live in **one place** — a `companyProfile` object — and are auto-rendered on every invoice. We'll seed it from your template:

```
VM ENTERPRISES — Fire Safety & Solutions
Proprietor: Vinit Yadav
GSTIN: 08ASRPY0599D1ZZ            (08 = Rajasthan)
Registered Office: Near Baba Lal Mandir, Village Mahtawas, Teh. Mandhan, Kotputli, Rajasthan
Branch Office:     F-286, Phase 2, New Palam Vihar, Gurgaon (Haryana) – 122017
Phone: 93550 16555   Email: Vmfiresolutions@gmail.com
Bank: State Bank of India, Branch: Mandhan, Distt. Alwar 301704
A/c No.: 45338059048   IFSC: SBIN0031464
```

Two ways to store it:
- **Simplest:** a `companyProfile.ts` config constant in the code. Changing bank details = one-line edit + redeploy.
- **Better (recommended):** a single editable **Settings** record (in IndexedDB / DB). You can update phone, bank, logo etc. from a Settings screen without touching code. We can even add your logo later.

### 2.2 The bill entry screen
A single screen with three zones, matching your template exactly:

1. **Invoice meta** (top-right of your template): Invoice No. (auto-generated, see §4), Date, Delivery Note/Challan, Place of Supply, Payment Terms, Due Date.
2. **Bill To / Ship To**: Buyer name, address, GSTIN/UIN, State & Code. "Ship To" optional (copy-from-Bill-To checkbox).
3. **Line items table** — you type a row and it auto-calculates. Columns match your template 1:1:

| Sl | Description of Goods/Services | HSN/SAC | Qty | Unit | Rate (₹) | Taxable Value (₹) | GST % | GST Amount (₹) | Total (₹) |
|----|-------------------------------|---------|-----|------|----------|-------------------|-------|----------------|-----------|

You type **Description, HSN/SAC, Qty, Unit, Rate, GST %**. The app computes **Taxable Value, GST Amount, Total** live. Add/remove rows freely (your template shows 6 but we won't hard-cap it).

4. **Totals block** (bottom-right): Subtotal, CGST, SGST, IGST (if inter-state), Round Off, **Grand Total**, plus **Amount in words**.
5. **Footer**: Bank Details + Declaration + Authorised Signatory (all from the fixed profile).

This is a faithful rebuild of your two template images — same sections, same wording.

---

## 3. Point 3 — GST calculation logic (the maths, done right)

Per-row:
```
Taxable Value = Qty × Rate            (minus item discount, if we add discounts later)
GST Amount     = Taxable Value × (GST% / 100)
Row Total      = Taxable Value + GST Amount
```

Tax split depends on **Place of Supply vs your state (Rajasthan, code 08)** — this is the standard CGST/SGST vs IGST rule and is exactly how the reference repo (Dewiride) does it:

| Situation | Tax applied |
|---|---|
| **Intra-state** — buyer in Rajasthan (state code 08) | **CGST = GST/2** and **SGST = GST/2** |
| **Inter-state** — buyer in any other state (e.g., Haryana 06) | **IGST = full GST** |

> Each half is computed from the taxable value independently (not by halving a rounded total), so the printed CGST and SGST always match to the paisa.

Invoice totals:
```
Subtotal    = Σ Taxable Value
Total GST   = Σ GST Amount     (shown split as CGST+SGST or IGST)
Round Off   = nearest rupee adjustment
Grand Total = Subtotal + Total GST + Round Off
```

**Amount in words** uses the **Indian numbering system** (lakh/crore), e.g. "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Only". Small utility — Dewiride includes one we can mirror.

**GSTIN validation (nice-to-have):** a GSTIN encodes its state in the first 2 digits and has a checksum last digit. We can validate the buyer's GSTIN and auto-fill their State & Code — Dewiride already does this and it's easy to replicate.

---

## 4. Point 5 — Generating & saving the PDF

### 4.1 The options, compared

| Approach | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| **`@react-pdf/renderer`** | You describe the PDF layout in React-like components; it outputs a real PDF. | Real **selectable text**, small files, embeds ₹/Unicode fonts, **runs in the browser** (no server), works on **Vercel** with no setup. | PDF layout is its own mini-layout system (not your HTML/CSS); slight learning curve. | ✅ **Recommended.** This is what the closest repo uses. |
| **`window.print()` + print CSS** | Style the invoice for print, user clicks Print and chooses "Save as PDF". | Zero libraries, pixel-perfect from your HTML, trivial. | Relies on the browser's print dialog; margins vary by browser; **can't auto-save a file** to storage/Drive. | ✅ **Add as a secondary button** — great quick MVP + a natural "print paper copy" path. |
| **Puppeteer (headless Chrome)** | Server renders your actual HTML page → PDF. | **Most pixel-perfect**, reuses your exact HTML/CSS. | Heavy (ships a browser), needs server/serverless chromium workarounds on Vercel. | ⚠️ Overkill here. Only if we later need server-side bulk PDF export. |
| **`jsPDF` + `html2canvas`** | Screenshots the DOM into an image, puts the image in a PDF. | Easy. | Produces an **image-based PDF** — blurry text, not selectable, large files. Bad for invoices. | ❌ Avoid. |

### 4.2 Recommendation
- **Primary:** a **"Download PDF"** button using **`@react-pdf/renderer`** — consistent file, selectable text, proper ₹ symbol, works offline and on Vercel.
- **Secondary:** a **"Print / Save as PDF"** button (`window.print()` + print CSS) for a paper copy or quick save.

### 4.3 Do we even store the PDF?
Mostly **no**. Because the PDF is generated from the bill data, we **regenerate it on demand** whenever you open a past bill. This means:
- No blob storage bill (saves space + money).
- The PDF is always consistent with the stored data.
- *Optional:* keep an immutable archived copy in **Google Drive** for the 6-year retention requirement (see §6).

---

## 5. Point 7 — Where & how to store the bills (the big question)

### 5.1 The key reframe: two different needs
There are two separate things people confuse:

- **(A) Bill records** — structured JSON (invoice no, date, buyer, line items, totals). This needs a **database** so you can list/search/re-open them. **Tiny** — a few KB each.
- **(B) PDF files** — the rendered documents. This needs **file storage** — *but we avoid it by regenerating from (A).*

So the real question is only: **where do the small JSON records live?**

> Size reality check: a bill is ~2–5 KB of JSON. **100,000 bills ≈ 300 MB.** Your entire archive fits in a free 512 MB database. **Your 5 TB Drive is massively more than needed** — size is not the deciding factor at all.

### 5.2 The storage options, compared

| Option | What it is | Free tier | Best for | Watch-outs |
|---|---|---|---|---|
| **IndexedDB** (browser) | Built-in browser database on *your device*. | Free, unlimited-ish, no account. | **Phase 1 / single device.** Fastest, offline, private. | Data lives in **one browser only**. Clearing site data / switching device = gone unless you **export a backup**. |
| **MongoDB Atlas (M0)** | Hosted cloud document DB. | **512 MB**, ~150k+ invoices, free forever. | Document data like invoices; you mentioned it. | **No backups** on free tier; cluster **pauses after 30 days idle** (you just resume it). |
| **Supabase (Free)** | Hosted Postgres + file storage + auth, all-in-one. | **500 MB DB + 1 GB storage + login (50k users) + 2 projects.** | When you also want **login** and a bit of file storage bundled. | **No backups** on free tier; project **pauses after ~7 days idle** (shorter than Atlas). |
| **Firebase Firestore** | Google's hosted NoSQL + 5 GB file storage + auth. | ~1 GB DB + 5 GB Storage + Auth. | Google ecosystem, realtime. | Vendor lock-in; pricing model different (per-read/write). |
| **Cloudflare R2 / Backblaze B2** | Cheap object (file) storage. | R2 10 GB, B2 10 GB free. | *Only if* we decided to store PDF files (we don't need to). | Not a queryable DB. |
| **Google Drive (your 5 TB)** | Your personal cloud drive, via Drive API. | You already have 5 TB. | **Optional PDF archive/backup.** | **Not a database** (no query/search); OAuth setup; **service-account quota trap** — see §5.4. |

### 5.3 Google Drive vs MongoDB — direct answer
- **As the primary store: MongoDB (or Supabase) wins, not Drive.** Drive can't query/search bills, every read is an API call, and it's awkward to list/filter. A database is the right tool for "show me all bills, search by buyer/date".
- **Drive's role: an optional backup.** Since you already have 5 TB, a nice safety net is to **also** push a copy of each generated PDF (and/or a JSON export) into a `VM-Enterprises/Invoices/2026/` folder in your Drive. That gives you an off-device, long-term archive for the **6-year retention rule** (§6) without paying anyone.
- **You don't have to choose today.** Phase 1 (IndexedDB) needs neither. We can bolt on MongoDB/Supabase *and/or* Drive backup later without rewriting the app.

### 5.4 ⚠️ Google Drive gotcha you must know
If we integrate Drive the "easy" server way (a **service account**), uploads **fail** with `storageQuotaExceeded` / "Service Accounts do not have storage quota" — **even though your Drive has 5 TB free.** Service accounts get **0 bytes** of their own quota. ([GitHub issue](https://github.com/openclaw/openclaw/issues/20427), [Google dev forum](https://discuss.google.dev/t/storagequotaexceeded-the-users-drive-storage-quota-has-been-exceeded-for-service-account/104375))

**The correct way:** use **OAuth — you sign in with your Google account once**, the app gets a token, and files are uploaded **as you**, counting against *your* 5 TB. That's the only clean path for a personal Drive (shared drives / domain delegation need Google Workspace, which is more setup). So: Drive backup = doable, but it's the OAuth flow, planned as a Phase 2+ add-on, not the first thing.

---

## 6. Compliance notes (so the bills are actually valid & safe)

- **Record retention: 6 years (72 months).** GST invoices must be kept for 72 months from the due date of the annual return (Companies Act can push some records to 8 years). ([Vertex](https://www.vertexinc.com/resources/resource-library/indias-e-invoicing-regulations-explained-scope-formats-and-penalties), [AIAccountant](https://www.aiaccountant.com/blog/financial-records-management-india), [LegalSuvidha](https://legalsuvidha.com/blog/data-retention-policies-in-e-invoicing))
  → **Implication:** don't rely on IndexedDB *alone* for years of records. Use **Export backups** and/or a cloud DB + the **Drive archive**. This is the strongest reason to eventually add an off-device copy.
- **e-Invoicing (government IRN + QR via the IRP portal): NOT required for you.** It's mandatory only for businesses above **₹5 crore** aggregate turnover. ([TaxGuru](https://taxguru.in/goods-and-service-tax/invoicing-gst-digital-tax-record.html), [Palians](https://palians.com/gst-invoice/blog/post.php?slug=e-invoicing-threshold-gst-india-2026)) A normal **Tax Invoice** (what your template is) is fully compliant for a small proprietorship.
- **Mandatory invoice fields** — your template already includes all of them: supplier name/address/GSTIN, a **consecutive unique invoice number** (max 16 chars), date, buyer details + GSTIN, HSN/SAC, description, qty, unit, rate, taxable value, tax rate & amount (CGST/SGST/IGST), **Place of Supply**, total, and signature. ✅
- **Invoice numbering must be sequential & unique.** We'll auto-generate (e.g., `VM/2026-27/001`) with an atomic counter, and make it editable if you ever need to correct it.

---

## 7. Point 6 — Access all past bills (history)

A **`/gstbill/history`** page:
- Lists every saved bill: Invoice No · Date · Buyer · Grand Total · (status).
- **Search/filter** by invoice no, buyer name, or date range.
- Each row → **Open** (view), **Re-download PDF**, **Print**, **Duplicate** (handy for repeat customers), **Edit** (before it's finalised).
- Reads from the same store as creation (IndexedDB in Phase 1; cloud DB in Phase 2).

This is exactly how Dewiride and Vyapar behave — history is just a list view over the saved records.

---

## 8. Point 8 — Public repos researched (how others solve it)

| Repo | Stack | PDF | Storage | History | License | Fit for us |
|---|---|---|---|---|---|---|
| **[Dewiride Invoice Generator](https://github.com/Dewiride-Open-Source/Dewiride-Invoice-Generator)** | **Next.js 16 + React 19 + Tailwind v4** | `@react-pdf/renderer` | **IndexedDB** (browser), export/import | **Yes** | **MIT** | ⭐ **Closest match — same stack as our app.** Correct GST intra/inter logic, amount-in-words, GSTIN checksum, UPI QR. Best reference to learn from. |
| **[BillForge](https://github.com/Vaibhav-Samdani/BillForge-gst-invoice)** | Next.js 15 + React + Zustand + shadcn/ui | React PDF renderer | Not specified (client) | Partial / upcoming | MIT | Good UI reference; history still "upcoming". |
| **[invoify](https://github.com/al1abb/invoify)** | Next.js + TS + shadcn/ui | 13 templates | — | — | Check | Great **general** invoice UI, but **not GST-specific** — verify tax handling. |
| **[Free GST Billing Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software)** | React + Node PWA (offline) | jsPDF + html2canvas | File-based JSON | Yes | Check | Feature-rich (credit notes, proforma) but **not Next.js** and uses the image-PDF approach we avoid. |
| **[saurabhsingh3198/gst-invoice-generator](https://github.com/saurabhsingh3198/gst-invoice-generator)** | React + TS (client) | client-side | client | — | Check | Simple GST generator; reverse-charge support. |
| Topic hubs | — | — | — | — | — | [github.com/topics/gst-invoice](https://github.com/topics/gst-invoice), [github.com/topics/gst-billing](https://github.com/topics/gst-billing) |

**Conclusion from the repos:** the mainstream, free, no-cost pattern for exactly your needs is **Next.js + `@react-pdf/renderer` + browser storage (IndexedDB) + export/import**, with an optional cloud DB for multi-device. Dewiride proves this whole stack works on Next.js 16/React 19 — the same versions we just scaffolded. We'll build our own (tailored to your template) but can lean on its approach for the GST maths, amount-in-words, and PDF rendering.

> ⚠️ Before copying any code from these repos, we'll check each one's **LICENSE** and recent activity. MIT repos (Dewiride, BillForge) allow reuse with attribution.

---

## 9. Recommended architecture

### Phase 1 — Local-first MVP (free, fast, no server) ✅ start here
```
Next.js app (Vercel free)
 ├─ /gstbill            → create a bill (fixed header + line items + live GST)
 ├─ /gstbill/history    → list / search / re-open past bills
 ├─ /gstbill/settings   → edit company profile, bank details, logo
 ├─ Storage: IndexedDB (on your device)
 ├─ PDF: @react-pdf/renderer  (+ Print button)
 └─ Backup: "Export all" / "Import" JSON button  (your safety net)
```
- **Cost: ₹0.** No database bill, no server, works offline.
- **Good for:** one computer. Covers every point you listed.

### Phase 2 — Cloud sync (only when you need multi-device) — optional
```
+ MongoDB Atlas (free)  or  Supabase (free)   → bills accessible from any device
+ Simple login (so only you can create bills)
+ Optional: "Backup PDF to Google Drive" (OAuth as you → your 5 TB)
```
- **Cost: still ₹0** on free tiers (watch the idle-pause + no-backup caveats in §5.2).

**My recommendation:** build **Phase 1** now, use it for real, and we add **Phase 2** only if you find yourself needing bills on your phone or want the Drive archive. The code is structured so Phase 2 is an add-on, not a rewrite.

---

## 10. Proposed build plan

1. **Company profile + settings** — seed VM Enterprises' fixed details (header, bank, declaration).
2. **Bill form UI** — invoice meta, Bill To/Ship To, line-item table with live GST maths.
3. **GST engine** — taxable/GST/total per row, CGST/SGST vs IGST, round-off, grand total, amount-in-words.
4. **Invoice preview** — pixel-match to your template (both pages).
5. **PDF** — `@react-pdf/renderer` "Download PDF" + `window.print()` "Print".
6. **Save + History** — persist to IndexedDB; `/history` list with search + re-open/duplicate/re-download.
7. **Backup** — Export/Import all bills as JSON.
8. **(Phase 2)** cloud DB + login + optional Drive archive.

---

## 11. Open questions for you

1. **One device or multiple?** (decides Phase 1 vs Phase 1+2) — *my default: start Phase 1.*
2. **Invoice number format** you want — e.g., `VM/2026-27/001`? Should it reset each financial year?
3. **Logo:** do you have the VM Enterprises logo image to put on the invoice?
4. **Discounts / multiple GST rates per bill:** do your bills ever need per-item discounts, or items at different GST % in one bill? (The design already supports per-row GST %.)
5. **Default GST %** for fire-safety items (e.g., 18%?) and common **HSN/SAC** codes you reuse — so we can pre-fill.
6. **Login needed?** If the deployed site is public, do you want a password so only you can create bills?

---

## 12. Sources

**Public repos / GST invoicing**
- Dewiride Invoice Generator — https://github.com/Dewiride-Open-Source/Dewiride-Invoice-Generator
- BillForge — https://github.com/Vaibhav-Samdani/BillForge-gst-invoice
- invoify — https://github.com/al1abb/invoify
- Free GST Billing Software — https://github.com/IamRamgarhia/Free-GST-Billing-Software
- saurabhsingh3198/gst-invoice-generator — https://github.com/saurabhsingh3198/gst-invoice-generator
- GitHub topics — https://github.com/topics/gst-invoice · https://github.com/topics/gst-billing

**PDF generation**
- Puppeteer vs @react-pdf/renderer (production comparison) — https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg
- React → PDF with Next.js + Puppeteer — https://dev.to/jordykoppen/turning-react-apps-into-pdfs-with-nextjs-nodejs-and-puppeteer-mfi
- React PDF generation in 2026 — https://viprasol.com/blog/react-pdf-generation/
- Node PDF libraries 2025 — https://pdfnoodle.com/blog/popular-libraries-2025-for-pdf-generation-using-node-js

**Storage / databases (free tiers)**
- MongoDB Atlas pricing — https://www.mongodb.com/pricing
- MongoDB Atlas free tier limits — https://agentdeals.dev/vendor/mongodb-atlas · https://soloproductoffice.com/archive/mongodb-atlas-free-tier-shared-cluster-limits/
- Best free database tiers 2026 — https://freetier.co/articles/best-free-database-free-tiers-2026
- MongoDB vs Supabase — https://solodevstack.com/blog/mongodb-vs-supabase-solo-developers
- DBaaS platforms 2026 — https://guptadeepak.com/tools/top-5-database-as-a-service-platforms-2026/

**Google Drive API gotcha**
- Service account zero storage quota (GitHub issue) — https://github.com/openclaw/openclaw/issues/20427
- StorageQuotaExceeded for service account (Google dev forum) — https://discuss.google.dev/t/storagequotaexceeded-the-users-drive-storage-quota-has-been-exceeded-for-service-account/104375
- Drive API usage limits — https://developers.google.com/workspace/drive/api/guides/limits

**GST compliance (retention / e-invoicing threshold)**
- India e-invoicing regulations (Vertex) — https://www.vertexinc.com/resources/resource-library/indias-e-invoicing-regulations-explained-scope-formats-and-penalties
- Record retention in India — https://www.aiaccountant.com/blog/financial-records-management-india
- Data retention for e-invoicing — https://legalsuvidha.com/blog/data-retention-policies-in-e-invoicing
- e-Invoicing threshold 2026 — https://palians.com/gst-invoice/blog/post.php?slug=e-invoicing-threshold-gst-india-2026
- e-Invoice as digital tax record (TaxGuru) — https://taxguru.in/goods-and-service-tax/invoicing-gst-digital-tax-record.html
- GST invoicing guide (Busy) — https://busy.in/gst/a-guide-to-invoicing-under-gst/

> *Note: free-tier limits and tax thresholds change over time and several sources are secondary blogs. Verify current MongoDB/Supabase limits on their own sites, and confirm the ₹5 crore e-invoicing threshold against a current CBIC notification, before relying on them.*
