// PDF rendering for an invoice using @react-pdf/renderer.
// Imported dynamically from the client so it stays out of the server bundle.
//
// Each template id is a genuinely different page architecture (grid / banner /
// minimal / sidebar / premium), NOT a recolour of one body. A shared, columns-
// driven ItemsTable + the meta/tax data helpers keep the GST content identical
// across all five; only the surrounding chrome changes. The on-screen A4
// preview (src/components/InvoicePreview.tsx) mirrors these layouts exactly.

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { formatINR } from "../gst";
import { stateLabel } from "../states";
import { getTemplate, contrastText, tint } from "../templates";
import { colWidths } from "../invoiceColumns";
import type { Bill, BillTotals, CompanyProfile, LineItem, ItemTotals } from "../types";

// Roboto includes the ₹ (U+20B9) glyph; the default Helvetica does not.
Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

const DARK = "#111827";
const SLATE = "#1f2937";
const MUTED = "#4b5563";

const s = StyleSheet.create({
  base: { fontFamily: "Roboto", fontSize: 8, color: DARK, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  bold: { fontWeight: "bold" },
  grow: { flexGrow: 1 },
});

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

type Align = "left" | "right" | "center";
interface Col {
  key: string;
  label: string;
  w: string;
  align: Align;
  get: (it: LineItem, r: ItemTotals, i: number) => string;
}

// The item columns are identical across every template — build them once from
// the profile's show/hide toggles and the scaled widths.
function buildCols(profile: CompanyProfile, W: Record<string, string>): Col[] {
  const cols: (Col | false)[] = [
    { key: "sl", label: "Sl", w: W.sl, align: "center", get: (_it, _r, i) => String(i + 1) },
    { key: "desc", label: "Description of Goods / Services", w: W.desc, align: "left", get: (it) => it.description },
    { key: "hsn", label: "HSN/SAC", w: W.hsn, align: "center", get: (it) => it.hsnSac },
    { key: "qty", label: "Qty", w: W.qty, align: "right", get: (it) => (it.qty ? String(it.qty) : "") },
    profile.invoice.showUnit && { key: "unit", label: "Unit", w: W.unit, align: "center", get: (it) => it.unit },
    { key: "rate", label: "Rate (₹)", w: W.rate, align: "right", get: (it) => formatINR(it.rate) },
    profile.invoice.showDiscount && { key: "disc", label: "Disc (₹)", w: W.disc, align: "right", get: (it) => (it.discount ? formatINR(it.discount) : "—") },
    { key: "taxable", label: "Taxable (₹)", w: W.taxable, align: "right", get: (_it, r) => formatINR(r.taxable) },
    { key: "gstp", label: "GST %", w: W.gstp, align: "right", get: (it) => `${it.gstRate}%` },
    { key: "gstamt", label: "GST Amt (₹)", w: W.gstamt, align: "right", get: (_it, r) => formatINR(r.gstAmount) },
    { key: "total", label: "Total (₹)", w: W.total, align: "right", get: (_it, r) => formatINR(r.total) },
  ];
  return cols.filter(Boolean) as Col[];
}

// Subtotal + tax breakup + round-off (NOT the grand total — each layout renders
// that as its own emphasised element).
function taxRows(totals: BillTotals): { label: string; value: number }[] {
  const rows = [{ label: "Subtotal", value: totals.subtotal }];
  if (totals.intraState) {
    rows.push({ label: "CGST", value: totals.cgst }, { label: "SGST", value: totals.sgst });
  } else {
    rows.push({ label: "IGST", value: totals.igst });
  }
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

// ---------------------------------------------------------------------------
// Shared, themeable item table (flex-based; react-pdf has no real <table>).
// ---------------------------------------------------------------------------
interface TableTheme {
  headBg?: string;
  headColor: string;
  headUpper?: boolean;
  headBorderBottom?: { w: number; color: string };
  headDivider?: string;
  cellDivider?: string;
  rowLine?: string;
  outer?: string;
  zebra?: [string, string];
  fontSize?: number;
  headFontSize?: number;
  minRowH?: number;
}

function ItemsTable({
  cols,
  items,
  rows,
  theme,
}: {
  cols: Col[];
  items: LineItem[];
  rows: ItemTotals[];
  theme: TableTheme;
}) {
  const fs = theme.fontSize ?? 7.5;
  const body = (
    <>
      <View
        style={[
          s.row,
          theme.headBg ? { backgroundColor: theme.headBg } : {},
          theme.headBorderBottom
            ? { borderBottomWidth: theme.headBorderBottom.w, borderBottomColor: theme.headBorderBottom.color }
            : {},
        ]}
      >
        {cols.map((c, ci) => (
          <Text
            key={c.key}
            style={[
              { padding: 4, fontSize: theme.headFontSize ?? 7.5, fontWeight: "bold", width: c.w, color: theme.headColor, textAlign: c.align },
              theme.headUpper ? { textTransform: "uppercase", letterSpacing: 0.4 } : {},
              theme.headDivider && ci < cols.length - 1 ? { borderRightWidth: 1, borderRightColor: theme.headDivider } : {},
            ]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {items.map((it, i) => {
        const r = rows[i];
        const bg = theme.zebra ? theme.zebra[i % 2] : undefined;
        return (
          <View
            key={it.id}
            style={[
              { flexDirection: "row", minHeight: theme.minRowH ?? 20 },
              theme.rowLine ? { borderBottomWidth: 1, borderBottomColor: theme.rowLine } : {},
              bg ? { backgroundColor: bg } : {},
            ]}
          >
            {cols.map((c, ci) => (
              <Text
                key={c.key}
                style={[
                  { padding: 4, fontSize: fs, width: c.w, textAlign: c.align },
                  theme.cellDivider && ci < cols.length - 1 ? { borderRightWidth: 1, borderRightColor: theme.cellDivider } : {},
                ]}
              >
                {c.get(it, r, i)}
              </Text>
            ))}
          </View>
        );
      })}
    </>
  );
  if (theme.outer) {
    return <View style={{ borderWidth: 1, borderColor: theme.outer }}>{body}</View>;
  }
  return <View>{body}</View>;
}

// Shared sign-off (For <company> / signature image / Authorised Signatory).
function SignOff({ profile, align = "left" }: { profile: CompanyProfile; align?: Align }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={{ fontWeight: "bold" }}>For {profile.name}</Text>
      {profile.invoice.showSignature && profile.signature ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={profile.signature} style={{ height: 34, objectFit: "contain", marginVertical: 2 }} />
      ) : (
        <View style={{ height: 24 }} />
      )}
      <Text>Authorised Signatory</Text>
    </View>
  );
}

function BankBlock({ profile }: { profile: CompanyProfile }) {
  return (
    <View>
      <Text style={s.bold}>Bank Details</Text>
      <Text>Bank: {profile.bank.name}</Text>
      <Text>Branch: {profile.bank.branch}</Text>
      <Text>A/c No.: {profile.bank.accountNo}</Text>
      <Text>IFSC: {profile.bank.ifsc}</Text>
    </View>
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

// ===========================================================================
// 1 · CLASSIC — the original VM Enterprises tax invoice, preserved verbatim:
// centred letterhead, boxed meta, dark table header, full borders.
// ===========================================================================
function ClassicInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const bc = "#9ca3af";
  const partyHeadBg = tint(accent, 0.94);
  const grandBg = tint(accent, 0.85);
  return (
    <Page size="A4" style={[s.base, { padding: 24 }]}>
      {/* Centred letterhead */}
      <View style={{ marginBottom: 6, alignItems: "center" }}>
        {profile.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginBottom: 3 }} />
        ) : null}
        <Text style={{ fontSize: 18, lineHeight: 1.2, fontWeight: "bold", color: accent }}>{profile.name}</Text>
        <Text style={{ fontSize: 9, color: MUTED }}>{profile.tagline}</Text>
        <Text style={{ fontSize: 12, lineHeight: 1.2, fontWeight: "bold", marginTop: 2 }}>TAX INVOICE</Text>
      </View>

      {/* Company + invoice meta */}
      <View style={[s.row, { borderWidth: 1, borderColor: bc }]}>
        <View style={{ width: "55%", padding: 6, borderRightWidth: 1, borderColor: bc }}>
          <Text style={s.bold}>{profile.name}</Text>
          <Text>{profile.tagline}</Text>
          <Text>Proprietor: {profile.proprietor}</Text>
          <Text>GSTIN: {profile.gstin}</Text>
          <Text>Registered Office: {profile.regOffice}</Text>
          {profile.branchOffice ? <Text>Branch Office: {profile.branchOffice}</Text> : null}
          <Text>Phone: {profile.phone}   Email: {profile.email}</Text>
        </View>
        <View style={{ width: "45%", padding: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {meta.map((m) => (
              <View key={m.label} style={{ width: "50%", marginBottom: 6 }}>
                <Text style={{ color: MUTED }}>{m.label}</Text>
                <Text style={s.bold}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Bill To / Ship To */}
      <View style={[s.row, { borderWidth: 1, borderTopWidth: 0, borderColor: bc }]}>
        {[
          { title: "Bill To / Buyer", p: bill.billTo },
          { title: "Ship To / Consignee", p: ship },
        ].map((col, i) => (
          <View key={col.title} style={{ width: "50%", borderRightWidth: i === 0 ? 1 : 0, borderColor: bc }}>
            <Text style={{ padding: 4, fontWeight: "bold", borderBottomWidth: 1, borderColor: bc, backgroundColor: partyHeadBg }}>{col.title}</Text>
            <View style={{ padding: 6, minHeight: 56 }}>
              <Text style={s.bold}>{col.p.name || "—"}</Text>
              <Text>{col.p.address}</Text>
              <Text>GSTIN/UIN: {col.p.gstin || "—"}</Text>
              <Text>State &amp; Code: {stateLabel(col.p.stateCode) || "—"}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Items */}
      <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: bc }}>
        <ItemsTable
          cols={cols}
          items={bill.items}
          rows={totals.rows}
          theme={{ headBg: SLATE, headColor: "#ffffff", cellDivider: "#e5e7eb", rowLine: "#e5e7eb", minRowH: 20 }}
        />
      </View>

      {/* Amount in words + totals */}
      <View style={[s.row, { borderWidth: 1, borderTopWidth: 0, borderColor: bc }]}>
        <View style={{ width: "58%", padding: 6, borderRightWidth: 1, borderColor: bc }}>
          <Text style={s.bold}>Amount in words:</Text>
          <Text>{totals.amountInWords}</Text>
        </View>
        <View style={{ width: "42%" }}>
          {tax.map((t) => (
            <View key={t.label} style={[s.row, { borderBottomWidth: 1, borderColor: bc }]}>
              <Text style={{ width: "55%", padding: 4, borderRightWidth: 1, borderColor: bc }}>{t.label}</Text>
              <Text style={{ width: "45%", padding: 4, textAlign: "right" }}>₹ {formatINR(t.value)}</Text>
            </View>
          ))}
          <View style={[s.row, { backgroundColor: grandBg }]}>
            <Text style={{ width: "55%", padding: 4, borderRightWidth: 1, borderColor: bc, fontWeight: "bold" }}>Grand Total</Text>
            <Text style={{ width: "45%", padding: 4, textAlign: "right", fontWeight: "bold" }}>₹ {formatINR(totals.grandTotal)}</Text>
          </View>
        </View>
      </View>

      <View style={s.grow} />

      {/* Footer */}
      <View style={[s.row, { borderWidth: 1, borderColor: bc, marginTop: 10 }]}>
        {profile.invoice.showBankDetails ? (
          <View style={{ width: "50%", padding: 6, borderRightWidth: 1, borderColor: bc }}>
            <BankBlock profile={profile} />
          </View>
        ) : null}
        <View style={{ width: profile.invoice.showBankDetails ? "50%" : "100%", padding: 6 }}>
          {profile.invoice.showDeclaration ? (
            <>
              <Text style={s.bold}>Declaration</Text>
              <Text style={{ marginBottom: 6 }}>{profile.declaration}</Text>
            </>
          ) : null}
          <SignOff profile={profile} />
        </View>
      </View>
    </Page>
  );
}

// ===========================================================================
// 2 · BANNER — full-width accent header, borderless zebra table, totals card.
// ===========================================================================
function BannerInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const onAccent = contrastText(accent);
  const soft = "#6b7280";
  const bodyMeta = meta.slice(2); // No./Date live in the banner
  return (
    <Page size="A4" style={[s.base, { padding: 0 }]}>
      {/* Banner */}
      <View style={{ backgroundColor: accent, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", maxWidth: "62%" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginRight: 10 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 18, lineHeight: 1.2, fontWeight: "bold", color: onAccent }}>{profile.name}</Text>
            <Text style={{ fontSize: 9, color: onAccent, opacity: 0.85 }}>{profile.tagline}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 20, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 2, color: onAccent }}>INVOICE</Text>
          <Text style={{ fontSize: 9, color: onAccent }}>No: {bill.invoiceNo || "—"}</Text>
          <Text style={{ fontSize: 9, color: onAccent }}>Date: {fmtDate(bill.invoiceDate) || "—"}</Text>
        </View>
      </View>

      <View style={{ padding: 24, flexGrow: 1 }}>
        {/* Meta strip */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
          {bodyMeta.map((m) => (
            <View key={m.label} style={{ width: "25%", paddingVertical: 2 }}>
              <Text style={{ color: soft, fontSize: 7 }}>{m.label}</Text>
              <Text style={s.bold}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Parties */}
        <View style={[s.row, { marginBottom: 12 }]}>
          {[
            { title: "Bill To", p: bill.billTo },
            { title: "Ship To", p: ship },
          ].map((col, i) => (
            <View key={col.title} style={{ width: "50%", paddingRight: i === 0 ? 12 : 0 }}>
              <View style={{ backgroundColor: tint(accent, 0.92), borderLeftWidth: 3, borderLeftColor: accent, padding: 8 }}>
                <Text style={{ color: accent, fontWeight: "bold", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>{col.title}</Text>
                <Text style={s.bold}>{col.p.name || "—"}</Text>
                <Text>{col.p.address}</Text>
                <Text>GSTIN/UIN: {col.p.gstin || "—"}</Text>
                <Text>State: {stateLabel(col.p.stateCode) || "—"}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Items */}
        <ItemsTable
          cols={cols}
          items={bill.items}
          rows={totals.rows}
          theme={{ headBg: accent, headColor: onAccent, rowLine: "#e5e7eb", zebra: ["#ffffff", tint(accent, 0.96)], minRowH: 20 }}
        />

        {/* Words + totals card */}
        <View style={[s.row, { marginTop: 12, justifyContent: "space-between" }]}>
          <View style={{ width: "52%" }}>
            <Text style={{ color: soft, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.6 }}>Amount in words</Text>
            <Text style={s.bold}>{totals.amountInWords}</Text>
          </View>
          <View style={{ width: "42%" }}>
            {tax.map((t) => (
              <View key={t.label} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                <Text style={{ color: soft }}>{t.label}</Text>
                <Text>₹ {formatINR(t.value)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: accent, padding: 6, marginTop: 4, borderRadius: 2 }}>
              <Text style={{ color: onAccent, fontWeight: "bold" }}>Grand Total</Text>
              <Text style={{ color: onAccent, fontWeight: "bold" }}>₹ {formatINR(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={s.grow} />

        {/* Footer */}
        <View style={[s.row, { marginTop: 16, justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 }]}>
          <View style={{ width: "55%" }}>
            {profile.invoice.showBankDetails ? <BankBlock profile={profile} /> : null}
            {profile.invoice.showDeclaration ? (
              <View style={{ marginTop: profile.invoice.showBankDetails ? 6 : 0 }}>
                <Text style={s.bold}>Declaration</Text>
                <Text>{profile.declaration}</Text>
              </View>
            ) : null}
          </View>
          <SignOff profile={profile} align="right" />
        </View>
      </View>
    </Page>
  );
}

// ===========================================================================
// 3 · MINIMAL — airy letter, hairline rules, no boxes.
// ===========================================================================
function MinimalInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const hair = "#e3e6ea";
  const soft = "#6b7280";
  const label = { color: soft, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.8 };
  return (
    <Page size="A4" style={[s.base, { padding: 40 }]}>
      <View style={{ height: 3, backgroundColor: accent, width: 48, marginBottom: 10 }} />
      {/* Letterhead */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 32, objectFit: "contain", marginRight: 8 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 15, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 0.3 }}>{profile.name}</Text>
            <Text style={{ fontSize: 8.5, color: soft }}>{profile.tagline}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, lineHeight: 1.2, color: soft, textTransform: "uppercase", letterSpacing: 3 }}>Invoice</Text>
      </View>

      <View style={{ borderBottomWidth: 1, borderColor: hair, marginVertical: 12 }} />

      {/* Meta + parties, as clean columns */}
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={{ width: "32%" }}>
          <Text style={label}>From</Text>
          <Text style={s.bold}>{profile.name}</Text>
          <Text style={{ color: soft }}>GSTIN: {profile.gstin}</Text>
          <Text style={{ color: soft }}>{profile.regOffice}</Text>
          <Text style={{ color: soft }}>{profile.phone}</Text>
        </View>
        <View style={{ width: "32%" }}>
          <Text style={label}>Billed to</Text>
          <Text style={s.bold}>{bill.billTo.name || "—"}</Text>
          <Text style={{ color: soft }}>{bill.billTo.address}</Text>
          <Text style={{ color: soft }}>GSTIN: {bill.billTo.gstin || "—"}</Text>
          <Text style={{ color: soft }}>{stateLabel(bill.billTo.stateCode) || "—"}</Text>
        </View>
        <View style={{ width: "30%" }}>
          {meta.map((m) => (
            <View key={m.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 0.5 }}>
              <Text style={{ color: soft }}>{m.label}</Text>
              <Text style={s.bold}>{m.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Ship-to, only when different */}
      {!bill.shipSameAsBill ? (
        <View style={{ marginTop: 10 }}>
          <Text style={label}>Shipped to</Text>
          <Text style={s.bold}>{ship.name || "—"}  <Text style={{ color: soft, fontWeight: "normal" }}>{ship.address}</Text></Text>
        </View>
      ) : null}

      {/* Items — hairline only */}
      <View style={{ marginTop: 18 }}>
        <ItemsTable
          cols={cols}
          items={bill.items}
          rows={totals.rows}
          theme={{ headColor: soft, headUpper: true, headBorderBottom: { w: 1, color: DARK }, rowLine: hair, minRowH: 22, fontSize: 8 }}
        />
      </View>

      {/* Totals — plain right-aligned */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }}>
        <View style={{ width: "42%" }}>
          {tax.map((t) => (
            <View key={t.label} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
              <Text style={{ color: soft }}>{t.label}</Text>
              <Text>₹ {formatINR(t.value)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: DARK, marginTop: 4, paddingTop: 4 }}>
            <Text style={{ fontWeight: "bold", fontSize: 10 }}>Grand Total</Text>
            <Text style={{ fontWeight: "bold", fontSize: 10, color: accent }}>₹ {formatINR(totals.grandTotal)}</Text>
          </View>
        </View>
      </View>

      <Text style={{ color: soft, marginTop: 10 }}>{totals.amountInWords}</Text>

      <View style={s.grow} />

      <View style={{ borderTopWidth: 1, borderColor: hair, marginTop: 16, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ width: "55%", color: soft }}>
          {profile.invoice.showBankDetails ? (
            <>
              <Text style={label}>Payment</Text>
              <Text>{profile.bank.name} · A/c {profile.bank.accountNo}</Text>
              <Text>IFSC {profile.bank.ifsc} · {profile.bank.branch}</Text>
            </>
          ) : null}
          {profile.invoice.showDeclaration ? <Text style={{ color: soft, marginTop: 4 }}>{profile.declaration}</Text> : null}
        </View>
        <SignOff profile={profile} align="right" />
      </View>
    </Page>
  );
}

// ===========================================================================
// 4 · SIDEBAR — full-height accent rail (brand + bank) + content column.
// ===========================================================================
function SidebarInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const onAccent = contrastText(accent);
  const soft = "#6b7280";
  const railLabel = { color: onAccent, opacity: 0.8, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.6, marginTop: 8 };
  const grandBg = tint(accent, 0.88);
  return (
    <Page size="A4" style={[s.base, { padding: 0, flexDirection: "row" }]}>
      {/* Rail */}
      <View style={{ width: 150, backgroundColor: accent, padding: 16 }}>
        {profile.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginBottom: 8 }} />
        ) : null}
        <Text style={{ color: onAccent, fontSize: 15, lineHeight: 1.2, fontWeight: "bold" }}>{profile.name}</Text>
        <Text style={{ color: onAccent, opacity: 0.85, fontSize: 8 }}>{profile.tagline}</Text>

        <Text style={railLabel}>GSTIN</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.gstin}</Text>

        <Text style={railLabel}>Office</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.regOffice}</Text>
        {profile.branchOffice ? <Text style={{ color: onAccent, fontSize: 8, marginTop: 2 }}>{profile.branchOffice}</Text> : null}

        <Text style={railLabel}>Contact</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.phone}</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.email}</Text>

        {profile.invoice.showBankDetails ? (
          <>
            <Text style={railLabel}>Bank</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>{profile.bank.name}</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>A/c {profile.bank.accountNo}</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>IFSC {profile.bank.ifsc}</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>{profile.bank.branch}</Text>
          </>
        ) : null}
      </View>

      {/* Content */}
      <View style={{ flexGrow: 1, padding: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ fontSize: 22, lineHeight: 1.1, fontWeight: "bold", letterSpacing: 1, color: accent }}>TAX INVOICE</Text>
          <View style={{ alignItems: "flex-end" }}>
            {meta.slice(0, 2).map((m) => (
              <Text key={m.label} style={{ color: soft }}>
                {m.label} <Text style={[s.bold, { color: DARK }]}>{m.value}</Text>
              </Text>
            ))}
          </View>
        </View>

        <View style={{ borderBottomWidth: 2, borderColor: accent, marginTop: 8, marginBottom: 12 }} />

        {/* Meta remainder + Bill To */}
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>
          <View style={{ width: "48%" }}>
            <Text style={{ color: accent, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "bold", marginBottom: 2 }}>Bill To</Text>
            <Text style={s.bold}>{bill.billTo.name || "—"}</Text>
            <Text>{bill.billTo.address}</Text>
            <Text>GSTIN/UIN: {bill.billTo.gstin || "—"}</Text>
            <Text>State: {stateLabel(bill.billTo.stateCode) || "—"}</Text>
          </View>
          <View style={{ width: "48%" }}>
            <Text style={{ color: accent, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "bold", marginBottom: 2 }}>Ship To</Text>
            <Text style={s.bold}>{ship.name || "—"}</Text>
            <Text>{ship.address}</Text>
            <Text>GSTIN/UIN: {ship.gstin || "—"}</Text>
            <Text>State: {stateLabel(ship.stateCode) || "—"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
          {meta.slice(2).map((m) => (
            <View key={m.label} style={{ width: "25%" }}>
              <Text style={{ color: soft, fontSize: 7 }}>{m.label}</Text>
              <Text style={s.bold}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Items */}
        <ItemsTable
          cols={cols}
          items={bill.items}
          rows={totals.rows}
          theme={{ headColor: accent, headUpper: true, headBorderBottom: { w: 1.5, color: accent }, rowLine: "#e5e7eb", minRowH: 20 }}
        />

        {/* Totals */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
          <View style={{ width: "46%" }}>
            {tax.map((t) => (
              <View key={t.label} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                <Text style={{ color: soft }}>{t.label}</Text>
                <Text>₹ {formatINR(t.value)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: grandBg, padding: 6, marginTop: 4 }}>
              <Text style={s.bold}>Grand Total</Text>
              <Text style={s.bold}>₹ {formatINR(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>
        <Text style={{ color: soft, marginTop: 8 }}>
          <Text style={s.bold}>In words: </Text>
          {totals.amountInWords}
        </Text>

        <View style={s.grow} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
          <View style={{ width: "55%", color: soft }}>
            {profile.invoice.showDeclaration ? <Text style={{ color: soft }}>{profile.declaration}</Text> : null}
          </View>
          <SignOff profile={profile} align="right" />
        </View>
      </View>
    </Page>
  );
}

// ===========================================================================
// 5 · PREMIUM — dark header block, uppercase labels, reversed total block.
// ===========================================================================
function PremiumInvoice({ bill, totals, profile, accent, ship, cols, meta, tax }: Ctx) {
  const soft = "#6b7280";
  const micro = { color: accent, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.8, fontWeight: "bold" as const, marginBottom: 2 };
  const bodyMeta = meta.slice(2);
  return (
    <Page size="A4" style={[s.base, { padding: 0 }]}>
      {/* Dark header */}
      <View style={{ backgroundColor: SLATE, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", maxWidth: "60%" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginRight: 10 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 18, lineHeight: 1.2, fontWeight: "bold", color: "#ffffff" }}>{profile.name}</Text>
            <Text style={{ fontSize: 9, color: "#ffffff", letterSpacing: 0.5 }}>{profile.tagline}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 2, color: "#ffffff" }}>TAX INVOICE</Text>
          <Text style={{ fontSize: 9, color: "#d1d5db" }}>No: {bill.invoiceNo || "—"}</Text>
          <Text style={{ fontSize: 9, color: "#d1d5db" }}>Date: {fmtDate(bill.invoiceDate) || "—"}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: accent }} />

      <View style={{ padding: 24, flexGrow: 1 }}>
        {/* Parties + meta */}
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>
          <View style={{ width: "34%" }}>
            <Text style={micro}>Bill To</Text>
            <Text style={s.bold}>{bill.billTo.name || "—"}</Text>
            <Text style={{ color: soft }}>{bill.billTo.address}</Text>
            <Text style={{ color: soft }}>GSTIN: {bill.billTo.gstin || "—"}</Text>
            <Text style={{ color: soft }}>{stateLabel(bill.billTo.stateCode) || "—"}</Text>
          </View>
          <View style={{ width: "34%" }}>
            <Text style={micro}>Ship To</Text>
            <Text style={s.bold}>{ship.name || "—"}</Text>
            <Text style={{ color: soft }}>{ship.address}</Text>
            <Text style={{ color: soft }}>GSTIN: {ship.gstin || "—"}</Text>
            <Text style={{ color: soft }}>{stateLabel(ship.stateCode) || "—"}</Text>
          </View>
          <View style={{ width: "26%" }}>
            {bodyMeta.map((m) => (
              <View key={m.label} style={{ marginBottom: 2 }}>
                <Text style={{ color: soft, fontSize: 7 }}>{m.label}</Text>
                <Text style={s.bold}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Items */}
        <ItemsTable
          cols={cols}
          items={bill.items}
          rows={totals.rows}
          theme={{ headBg: SLATE, headColor: "#ffffff", headUpper: true, rowLine: "#e5e7eb", minRowH: 22, fontSize: 8 }}
        />

        {/* Totals — reversed focal block */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
          <View style={{ width: "50%" }}>
            <Text style={micro}>Amount in words</Text>
            <Text style={s.bold}>{totals.amountInWords}</Text>
          </View>
          <View style={{ width: "44%" }}>
            {tax.map((t) => (
              <View key={t.label} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                <Text style={{ color: soft }}>{t.label}</Text>
                <Text>₹ {formatINR(t.value)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: SLATE, padding: 8, marginTop: 6 }}>
              <Text style={{ color: "#ffffff", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "bold" }}>Amount Due</Text>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "bold" }}>₹ {formatINR(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={s.grow} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 }}>
          <View style={{ width: "55%" }}>
            {profile.invoice.showBankDetails ? (
              <>
                <Text style={micro}>Bank Details</Text>
                <Text style={{ color: soft }}>{profile.bank.name} · A/c {profile.bank.accountNo}</Text>
                <Text style={{ color: soft }}>IFSC {profile.bank.ifsc} · {profile.bank.branch}</Text>
              </>
            ) : null}
            {profile.invoice.showDeclaration ? <Text style={{ color: soft, marginTop: 4 }}>{profile.declaration}</Text> : null}
          </View>
          <SignOff profile={profile} align="right" />
        </View>
      </View>
    </Page>
  );
}

function InvoiceDocument({ bill, totals, profile }: { bill: Bill; totals: BillTotals; profile: CompanyProfile }) {
  const spec = getTemplate(bill.template ?? profile.template);
  const accent = bill.accentColor || profile.accentColor;
  const ship = bill.shipSameAsBill ? bill.billTo : bill.shipTo;
  const W = colWidths(profile.invoice.showUnit, profile.invoice.showDiscount);
  const ctx: Ctx = {
    bill,
    totals,
    profile,
    accent,
    ship,
    cols: buildCols(profile, W),
    meta: metaItems(bill),
    tax: taxRows(totals),
  };
  return (
    <Document title={`Invoice ${bill.invoiceNo}`}>
      {spec.id === "banner" ? (
        <BannerInvoice {...ctx} />
      ) : spec.id === "minimal" ? (
        <MinimalInvoice {...ctx} />
      ) : spec.id === "sidebar" ? (
        <SidebarInvoice {...ctx} />
      ) : spec.id === "premium" ? (
        <PremiumInvoice {...ctx} />
      ) : (
        <ClassicInvoice {...ctx} />
      )}
    </Document>
  );
}

export async function generatePdfBlob(
  bill: Bill,
  totals: BillTotals,
  profile: CompanyProfile,
): Promise<Blob> {
  return pdf(<InvoiceDocument bill={bill} totals={totals} profile={profile} />).toBlob();
}
