// PDF rendering for a quotation using @react-pdf/renderer.
// Imported dynamically from the client so it stays out of the server bundle.

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
import { formatAmount, termLines } from "../quote";
import type { CompanyProfile, Quote, QuoteTotals } from "../types";

// Roboto includes the ₹ (U+20B9) glyph; the default Helvetica does not.
Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});

const C = {
  red: "#c0392b",
  border: "#6b7280",
  light: "#f3f4f6",
  text: "#111827",
  muted: "#4b5563",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    color: C.text,
    padding: 28,
    lineHeight: 1.4,
  },
  logo: { height: 44, objectFit: "contain", alignSelf: "center", marginBottom: 4 },
  companyName: { fontSize: 22, fontWeight: "bold", color: C.red, textAlign: "center" },
  tagline: { fontSize: 10, fontWeight: "bold", textAlign: "center", color: C.red, marginBottom: 2 },
  addr: { fontSize: 8, textAlign: "center", color: C.muted },
  rule: { borderBottomWidth: 1, borderColor: C.border, marginVertical: 3 },

  bold: { fontWeight: "bold" },
  right: { textAlign: "right" },
  underline: { textDecoration: "underline" },
  onBand: { color: "#ffffff" }, // white text for the black header/total bands

  // buyer + date
  buyerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  buyerLeft: { width: "62%" },
  buyerRight: { width: "36%", textAlign: "right" },

  subject: { marginTop: 12, fontWeight: "bold", textDecoration: "underline" },
  heading: { marginTop: 8, fontWeight: "bold" },

  // table
  table: { marginTop: 6, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row" },
  headRow: { flexDirection: "row", backgroundColor: C.light },
  th: { fontWeight: "bold", padding: 4, borderRightWidth: 1, borderColor: C.border, fontSize: 8.5 },
  thLast: { fontWeight: "bold", padding: 4, fontSize: 8.5 },
  td: { padding: 4, borderRightWidth: 1, borderColor: C.border, fontSize: 8.5 },
  tdLast: { padding: 4, fontSize: 8.5 },
  bodyRow: { flexDirection: "row", borderTopWidth: 1, borderColor: C.border, minHeight: 18 },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderColor: C.border, backgroundColor: C.light },

  words: { marginTop: 6, fontSize: 8.5 },

  terms: { marginTop: 14 },
  termsTitle: { fontWeight: "bold", textDecoration: "underline" },
  termLine: { flexDirection: "row", marginTop: 2 },
  termNum: { width: 16 },

  sign: { marginTop: 36, textAlign: "right" },
  note: { marginTop: 10, fontSize: 7.5, color: C.muted, textAlign: "center" },
});

// Column widths (must sum to 100)
const COLS = {
  sl: "6%",
  name: "38%",
  qty: "14%",
  unit: "10%",
  rate: "16%",
  amount: "16%",
};

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

function QuoteDocument({
  quote,
  totals,
  profile,
}: {
  quote: Quote;
  totals: QuoteTotals;
  profile: CompanyProfile;
}) {
  const terms = termLines(quote.terms);
  const accent = profile.accentColor || C.red;
  const bandBg = "#000000"; // black header + total bands (accent still used for the title)
  return (
    <Document title={`Quotation ${quote.quoteNo}`}>
      <Page size="A4" style={s.page}>
        {/* Letterhead */}
        {profile.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={profile.logo} style={s.logo} />
        ) : null}
        <Text style={[s.companyName, { color: accent }]}>{profile.name}</Text>
        <Text style={[s.tagline, { color: accent }]}>{profile.tagline}</Text>
        <Text style={s.addr}>Work Office: {profile.branchOffice}</Text>
        <Text style={s.addr}>Reg. Office: {profile.regOffice}</Text>
        <View style={s.rule} />
        <Text style={s.addr}>
          Ph: {profile.phone}    Email: {profile.email}
        </Text>

        {/* Buyer + date */}
        <View style={s.buyerRow}>
          <View style={s.buyerLeft}>
            <Text style={s.bold}>M/s  {quote.buyerName || "—"}</Text>
            <Text>{quote.buyerAddress}</Text>
          </View>
          <View style={s.buyerRight}>
            <Text style={s.bold}>Date: {fmtDate(quote.quoteDate) || "—"}</Text>
            <Text style={{ color: C.muted }}>Quotation No: {quote.quoteNo}</Text>
            {quote.validUntil ? (
              <Text style={{ color: C.muted }}>Valid until: {fmtDate(quote.validUntil)}</Text>
            ) : null}
          </View>
        </View>

        <Text style={s.subject}>Sub: - {quote.subject}</Text>
        <Text style={s.heading}>{quote.heading}</Text>

        {/* Items table */}
        <View style={s.table}>
          <View style={[s.headRow, { backgroundColor: bandBg }]}>
            <Text style={[s.th, s.onBand, { width: COLS.sl }]}>S.No.</Text>
            <Text style={[s.th, s.onBand, { width: COLS.name }]}>Product Name</Text>
            <Text style={[s.th, s.onBand, { width: COLS.qty, textAlign: "center" }]}>Qty</Text>
            <Text style={[s.th, s.onBand, { width: COLS.unit, textAlign: "center" }]}>Unit</Text>
            <Text style={[s.th, s.onBand, { width: COLS.rate, textAlign: "center" }]}>Rate</Text>
            <Text style={[s.thLast, s.onBand, { width: COLS.amount, textAlign: "right" }]}>Amount</Text>
          </View>
          {quote.items.map((it, i) => (
            <View style={s.bodyRow} key={it.id}>
              <Text style={[s.td, { width: COLS.sl, textAlign: "center" }]}>{i + 1}</Text>
              <Text style={[s.td, { width: COLS.name }]}>{it.productName}</Text>
              <Text style={[s.td, { width: COLS.qty, textAlign: "center" }]}>{it.qty}</Text>
              <Text style={[s.td, { width: COLS.unit, textAlign: "center" }]}>{it.unit}</Text>
              <Text style={[s.td, { width: COLS.rate, textAlign: "center" }]}>{it.rate}</Text>
              <Text style={[s.tdLast, { width: COLS.amount, textAlign: "right" }]}>{formatAmount(it.amount)}</Text>
            </View>
          ))}
          {totals.freight > 0 ? (
            <View style={s.bodyRow}>
              <Text style={[s.td, { width: COLS.sl }]}> </Text>
              <Text style={[s.td, { width: COLS.name }]}>Freight</Text>
              <Text style={[s.td, { width: COLS.qty }]}> </Text>
              <Text style={[s.td, { width: COLS.unit }]}> </Text>
              <Text style={[s.td, { width: COLS.rate }]}> </Text>
              <Text style={[s.tdLast, { width: COLS.amount, textAlign: "right" }]}>{formatAmount(totals.freight)}</Text>
            </View>
          ) : null}
          <View style={[s.totalRow, { backgroundColor: bandBg }]}>
            <Text style={[s.td, s.bold, s.onBand, { width: `${6 + 38 + 14 + 10 + 16}%` }]}>Total</Text>
            <Text style={[s.tdLast, s.bold, s.onBand, { width: COLS.amount, textAlign: "right" }]}>
              ₹ {formatAmount(totals.total)}
            </Text>
          </View>
        </View>

        <Text style={s.words}>
          <Text style={s.bold}>Amount in words: </Text>
          {totals.amountInWords}
        </Text>

        {/* Terms */}
        {terms.length > 0 ? (
          <View style={s.terms}>
            <Text style={s.termsTitle}>Terms &amp; Conditions:</Text>
            {terms.map((t, i) => (
              <View style={s.termLine} key={i}>
                <Text style={s.termNum}>{i + 1}.</Text>
                <Text style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Spacer: pushes the signature to the bottom so the quote fills the page */}
        <View style={{ flexGrow: 1 }} />

        {/* Signature */}
        <View style={s.sign}>
          <Text style={s.bold}>For {profile.name}</Text>
          <Text style={{ marginTop: 22 }}>Authorised Signatory</Text>
        </View>

        <Text style={s.note}>
          This is a quotation, not a tax invoice — prices are valid subject to the terms above.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateQuotePdfBlob(
  quote: Quote,
  totals: QuoteTotals,
  profile: CompanyProfile,
): Promise<Blob> {
  return pdf(<QuoteDocument quote={quote} totals={totals} profile={profile} />).toBlob();
}
