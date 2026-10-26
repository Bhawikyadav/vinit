// PDF rendering for an invoice using @react-pdf/renderer.
// Imported dynamically from the client so it stays out of the server bundle.
// Layout varies by template (classic / modern / minimal) and accent colour.

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
import type { Bill, BillTotals, CompanyProfile } from "../types";

// Roboto includes the ₹ (U+20B9) glyph; the default Helvetica does not.
Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 8, color: "#111827", padding: 24, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  bold: { fontWeight: "bold" },
  topLeft: { width: "55%", padding: 6, borderRightWidth: 1 },
  topRight: { width: "45%", padding: 6 },
  label: { color: "#4b5563" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metaCell: { width: "48%" },
  partyHeader: { padding: 4, fontWeight: "bold", borderBottomWidth: 1 },
  partyBody: { padding: 6, minHeight: 56 },
  half: { width: "50%" },
  th: { padding: 4, fontSize: 7.5, fontWeight: "bold" },
  td: { padding: 4, borderRightWidth: 1, fontSize: 7.5 },
  tdLast: { padding: 4, fontSize: 7.5 },
  itemRow: { flexDirection: "row", borderBottomWidth: 1, minHeight: 20 },
  wordsBox: { width: "58%", padding: 6, borderRightWidth: 1 },
  totalsBox: { width: "42%" },
  totLine: { flexDirection: "row", borderBottomWidth: 1 },
  totLabel: { width: "55%", padding: 4, borderRightWidth: 1 },
  totValue: { width: "45%", padding: 4, textAlign: "right" },
  footer: { flexDirection: "row", marginTop: 10, borderWidth: 1 },
  footerCell: { width: "50%", padding: 6 },
  sign: { marginTop: 28, fontWeight: "bold" },
});

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

function InvoiceDocument({
  bill,
  totals,
  profile,
}: {
  bill: Bill;
  totals: BillTotals;
  profile: CompanyProfile;
}) {
  const spec = getTemplate(bill.template ?? profile.template);
  const accent = bill.accentColor || profile.accentColor;
  const ship = bill.shipSameAsBill ? bill.billTo : bill.shipTo;

  const W = colWidths(profile.showUnit, profile.showDiscount);
  const bc = spec.borders === "full" ? "#9ca3af" : "#d1d5db";
  const rowBc = "#e5e7eb";
  const headBg = spec.tableHead === "dark" ? "#1f2937" : spec.tableHead === "accent" ? accent : "#f3f4f6";
  const headText = spec.tableHead === "light" ? "#111827" : spec.tableHead === "accent" ? contrastText(accent) : "#ffffff";
  const bandBg = tint(accent, 0.9);
  const grandBg = tint(accent, 0.85);
  const partyHeadBg = tint(accent, 0.94);
  const titleColor = spec.id === "modern" ? accent : "#111827";

  const border = { borderColor: bc };
  const th = (label: string, w: string, align: "left" | "right" | "center" = "left") => (
    <Text
      style={[
        s.th,
        {
          width: w,
          backgroundColor: headBg,
          color: headText,
          textAlign: align,
          borderBottomWidth: spec.tableHead === "light" ? 1 : 0,
          borderBottomColor: bc,
        },
      ]}
    >
      {label}
    </Text>
  );

  const header =
    spec.headerLayout === "centered" ? (
      <View
        style={[
          { marginBottom: 6, alignItems: "center" },
          spec.headerBand ? { backgroundColor: bandBg, padding: 8, borderRadius: 3 } : {},
        ]}
      >
        {profile.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginBottom: 3 }} />
        ) : null}
        <Text style={{ fontSize: 18, fontWeight: "bold", color: accent }}>{profile.name}</Text>
        <Text style={{ fontSize: 9, color: "#4b5563" }}>{profile.tagline}</Text>
        <Text style={{ fontSize: 12, fontWeight: "bold", marginTop: 2, color: titleColor }}>TAX INVOICE</Text>
      </View>
    ) : (
      <View
        style={[
          { marginBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
          spec.headerBand ? { backgroundColor: bandBg, padding: 8, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: accent } : {},
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 36, objectFit: "contain", marginRight: 8 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: accent }}>{profile.name}</Text>
            <Text style={{ fontSize: 9, color: "#4b5563" }}>{profile.tagline}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "bold", color: titleColor }}>TAX INVOICE</Text>
      </View>
    );

  return (
    <Document title={`Invoice ${bill.invoiceNo}`}>
      <Page size="A4" style={s.page}>
        {header}

        {/* Company + invoice meta */}
        <View style={[s.row, { borderWidth: 1 }, border]}>
          <View style={[s.topLeft, border]}>
            <Text style={s.bold}>{profile.name}</Text>
            <Text>{profile.tagline}</Text>
            <Text>Proprietor: {profile.proprietor}</Text>
            <Text>GSTIN: {profile.gstin}</Text>
            <Text>Registered Office: {profile.regOffice}</Text>
            {profile.branchOffice ? <Text>Branch Office: {profile.branchOffice}</Text> : null}
            <Text>Phone: {profile.phone}   Email: {profile.email}</Text>
          </View>
          <View style={s.topRight}>
            <View style={s.metaRow}>
              <View style={s.metaCell}>
                <Text style={s.label}>Invoice No.</Text>
                <Text style={s.bold}>{bill.invoiceNo}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Date</Text>
                <Text style={s.bold}>{fmtDate(bill.invoiceDate)}</Text>
              </View>
            </View>
            <View style={s.metaRow}>
              <View style={s.metaCell}>
                <Text style={s.label}>Delivery Note / Challan</Text>
                <Text>{bill.deliveryNote || "—"}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Place of Supply</Text>
                <Text>{stateLabel(bill.placeOfSupplyCode) || "—"}</Text>
              </View>
            </View>
            <View style={s.metaRow}>
              <View style={s.metaCell}>
                <Text style={s.label}>Payment Terms</Text>
                <Text>{bill.paymentTerms || "—"}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Due Date</Text>
                <Text>{fmtDate(bill.dueDate) || "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bill To / Ship To */}
        <View style={[s.row, { borderWidth: 1, borderTopWidth: 0 }, border]}>
          <View style={[s.half, { borderRightWidth: 1 }, border]}>
            <Text style={[s.partyHeader, border, { backgroundColor: partyHeadBg }]}>Bill To / Buyer</Text>
            <View style={s.partyBody}>
              <Text style={s.bold}>{bill.billTo.name || "—"}</Text>
              <Text>{bill.billTo.address}</Text>
              <Text>GSTIN/UIN: {bill.billTo.gstin || "—"}</Text>
              <Text>State &amp; Code: {stateLabel(bill.billTo.stateCode) || "—"}</Text>
            </View>
          </View>
          <View style={s.half}>
            <Text style={[s.partyHeader, border, { backgroundColor: partyHeadBg }]}>Ship To / Consignee</Text>
            <View style={s.partyBody}>
              <Text style={s.bold}>{ship.name || "—"}</Text>
              <Text>{ship.address}</Text>
              <Text>GSTIN/UIN: {ship.gstin || "—"}</Text>
              <Text>State &amp; Code: {stateLabel(ship.stateCode) || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={[{ borderWidth: 1, borderTopWidth: 0 }, border]}>
          <View style={s.row}>
            {th("Sl", W.sl, "center")}
            {th("Description of Goods / Services", W.desc, "left")}
            {th("HSN/SAC", W.hsn, "center")}
            {th("Qty", W.qty, "center")}
            {profile.showUnit ? th("Unit", W.unit, "center") : null}
            {th("Rate (₹)", W.rate, "right")}
            {profile.showDiscount ? th("Disc (₹)", W.disc, "right") : null}
            {th("Taxable (₹)", W.taxable, "right")}
            {th("GST %", W.gstp, "right")}
            {th("GST Amt (₹)", W.gstamt, "right")}
            {th("Total (₹)", W.total, "right")}
          </View>
          {bill.items.map((it, i) => {
            const r = totals.rows[i];
            return (
              <View style={[s.itemRow, { borderBottomColor: rowBc }]} key={it.id}>
                <Text style={[s.td, { width: W.sl, borderColor: rowBc }]}>{i + 1}</Text>
                <Text style={[s.td, { width: W.desc, borderColor: rowBc }]}>{it.description}</Text>
                <Text style={[s.td, { width: W.hsn, borderColor: rowBc }]}>{it.hsnSac}</Text>
                <Text style={[s.td, { width: W.qty, borderColor: rowBc, textAlign: "right" }]}>{it.qty || ""}</Text>
                {profile.showUnit ? (
                  <Text style={[s.td, { width: W.unit, borderColor: rowBc }]}>{it.unit}</Text>
                ) : null}
                <Text style={[s.td, { width: W.rate, borderColor: rowBc, textAlign: "right" }]}>{formatINR(it.rate)}</Text>
                {profile.showDiscount ? (
                  <Text style={[s.td, { width: W.disc, borderColor: rowBc, textAlign: "right" }]}>{it.discount ? formatINR(it.discount) : "—"}</Text>
                ) : null}
                <Text style={[s.td, { width: W.taxable, borderColor: rowBc, textAlign: "right" }]}>{formatINR(r.taxable)}</Text>
                <Text style={[s.td, { width: W.gstp, borderColor: rowBc, textAlign: "right" }]}>{it.gstRate}%</Text>
                <Text style={[s.td, { width: W.gstamt, borderColor: rowBc, textAlign: "right" }]}>{formatINR(r.gstAmount)}</Text>
                <Text style={[s.tdLast, { width: W.total, textAlign: "right" }]}>{formatINR(r.total)}</Text>
              </View>
            );
          })}
        </View>

        {/* Amount in words + totals */}
        <View style={[s.row, { borderWidth: 1, borderTopWidth: 0 }, border]}>
          <View style={[s.wordsBox, border]}>
            <Text style={s.bold}>Amount in words:</Text>
            <Text>{totals.amountInWords}</Text>
          </View>
          <View style={s.totalsBox}>
            <View style={[s.totLine, border]}>
              <Text style={[s.totLabel, border]}>Subtotal</Text>
              <Text style={s.totValue}>₹ {formatINR(totals.subtotal)}</Text>
            </View>
            {totals.intraState ? (
              <>
                <View style={[s.totLine, border]}>
                  <Text style={[s.totLabel, border]}>CGST</Text>
                  <Text style={s.totValue}>₹ {formatINR(totals.cgst)}</Text>
                </View>
                <View style={[s.totLine, border]}>
                  <Text style={[s.totLabel, border]}>SGST</Text>
                  <Text style={s.totValue}>₹ {formatINR(totals.sgst)}</Text>
                </View>
              </>
            ) : (
              <View style={[s.totLine, border]}>
                <Text style={[s.totLabel, border]}>IGST</Text>
                <Text style={s.totValue}>₹ {formatINR(totals.igst)}</Text>
              </View>
            )}
            <View style={[s.totLine, border]}>
              <Text style={[s.totLabel, border]}>Round Off</Text>
              <Text style={s.totValue}>₹ {formatINR(totals.roundOff)}</Text>
            </View>
            <View style={[s.row, { backgroundColor: grandBg }]}>
              <Text style={[s.totLabel, border, s.bold]}>Grand Total</Text>
              <Text style={[s.totValue, s.bold]}>₹ {formatINR(totals.grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Spacer: pushes the footer to the bottom so the invoice fills the page */}
        <View style={{ flexGrow: 1 }} />

        {/* Footer: bank + declaration */}
        <View style={[s.footer, border]}>
          <View style={[s.footerCell, { borderRightWidth: 1 }, border]}>
            <Text style={s.bold}>Bank Details</Text>
            <Text>Bank: {profile.bank.name}</Text>
            <Text>Branch: {profile.bank.branch}</Text>
            <Text>A/c No.: {profile.bank.accountNo}</Text>
            <Text>IFSC: {profile.bank.ifsc}</Text>
          </View>
          <View style={s.footerCell}>
            <Text style={s.bold}>Declaration</Text>
            <Text>{profile.declaration}</Text>
            <Text style={{ marginTop: 12, fontWeight: "bold" }}>For {profile.name}</Text>
            {profile.signature ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={profile.signature} style={{ height: 36, objectFit: "contain", marginTop: 2, marginBottom: 2 }} />
            ) : (
              <View style={{ height: 24 }} />
            )}
            <Text>Authorised Signatory</Text>
          </View>
        </View>
      </Page>
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
