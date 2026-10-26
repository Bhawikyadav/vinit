// PDF rendering for a quotation using @react-pdf/renderer.
// Imported dynamically from the client so it stays out of the server bundle.
//
// Five layouts, picked independently of the invoice via profile.quoteTemplate
// (or quote.template snapshot): classic (the original VM Enterprises quote) /
// banner / minimal / sidebar / premium. A quotation shows NO GST in the line
// math — the total is the pre-tax figure; GST is only a note in the terms.
// Mirrors src/components/QuotePreview.tsx exactly.

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
import { getTemplate, contrastText, tint } from "../templates";
import type { CompanyProfile, Quote, QuoteTotals } from "../types";

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
const GREY = "#6b7280";

const s = StyleSheet.create({
  base: { fontFamily: "Roboto", fontSize: 9, color: DARK, lineHeight: 1.4 },
  bold: { fontWeight: "bold" },
  row: { flexDirection: "row" },
  grow: { flexGrow: 1 },
  note: { marginTop: 10, fontSize: 7.5, color: MUTED, textAlign: "center" },
});

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB");
}

// Column widths as percentages (sum 100). When Unit is hidden its share folds
// into Product Name so the table still fills the width.
function quoteCols(showUnit: boolean) {
  const c = { sl: 6, name: 38, qty: 14, unit: 10, rate: 16, amount: 16 };
  if (!showUnit) {
    c.name += c.unit;
    c.unit = 0;
  }
  return c;
}
const pc = (n: number) => `${n}%`;

interface TableTheme {
  headBg?: string;
  headColor: string;
  headUpper?: boolean;
  headBorderBottom?: { w: number; color: string };
  cellDivider?: string;
  rowLine?: string;
  outer?: string;
  zebra?: [string, string];
  totalBg?: string;
  totalColor?: string;
  totalBorderTop?: { w: number; color: string };
}

interface QCtx {
  quote: Quote;
  totals: QuoteTotals;
  profile: CompanyProfile;
  accent: string;
  terms: string[];
  showUnit: boolean;
}

// Shared, themeable quotation items table (header + rows + freight + total).
function QItemsTable({ quote, totals, showUnit, theme }: { quote: Quote; totals: QuoteTotals; showUnit: boolean; theme: TableTheme }) {
  const cols = quoteCols(showUnit);
  const totalLabelW = pc(cols.sl + cols.name + cols.qty + cols.unit + cols.rate);
  const cd = (ci: number, last: number) => (theme.cellDivider && ci < last ? { borderRightWidth: 1, borderRightColor: theme.cellDivider } : {});
  const head: { label: string; w: string; align: "left" | "center" | "right" }[] = [
    { label: "S.No.", w: pc(cols.sl), align: "center" },
    { label: "Product Name", w: pc(cols.name), align: "left" },
    { label: "Qty", w: pc(cols.qty), align: "center" },
    ...(showUnit ? [{ label: "Unit", w: pc(cols.unit), align: "center" as const }] : []),
    { label: "Rate", w: pc(cols.rate), align: "center" },
    { label: "Amount", w: pc(cols.amount), align: "right" },
  ];
  return (
    <View style={[{ marginTop: 6 }, theme.outer ? { borderWidth: 1, borderColor: theme.outer } : {}]}>
      {/* Header */}
      <View
        style={[
          s.row,
          theme.headBg ? { backgroundColor: theme.headBg } : {},
          theme.headBorderBottom ? { borderBottomWidth: theme.headBorderBottom.w, borderBottomColor: theme.headBorderBottom.color } : {},
        ]}
      >
        {head.map((h, ci) => (
          <Text
            key={h.label}
            style={[
              { padding: 4, fontSize: 8.5, fontWeight: "bold", width: h.w, color: theme.headColor, textAlign: h.align },
              theme.headUpper ? { textTransform: "uppercase", letterSpacing: 0.4 } : {},
              cd(ci, head.length - 1),
            ]}
          >
            {h.label}
          </Text>
        ))}
      </View>
      {/* Items */}
      {quote.items.map((it, i) => {
        const bg = theme.zebra ? theme.zebra[i % 2] : undefined;
        const cells = [
          { v: String(i + 1), w: pc(cols.sl), align: "center" as const },
          { v: it.productName, w: pc(cols.name), align: "left" as const },
          { v: it.qty, w: pc(cols.qty), align: "center" as const },
          ...(showUnit ? [{ v: it.unit, w: pc(cols.unit), align: "center" as const }] : []),
          { v: it.rate, w: pc(cols.rate), align: "center" as const },
          { v: formatAmount(it.amount), w: pc(cols.amount), align: "right" as const },
        ];
        return (
          <View key={it.id} style={[s.row, { minHeight: 18 }, theme.rowLine ? { borderTopWidth: 1, borderTopColor: theme.rowLine } : {}, bg ? { backgroundColor: bg } : {}]}>
            {cells.map((c, ci) => (
              <Text key={ci} style={[{ padding: 4, fontSize: 8.5, width: c.w, textAlign: c.align }, cd(ci, cells.length - 1)]}>
                {c.v}
              </Text>
            ))}
          </View>
        );
      })}
      {/* Freight */}
      {totals.freight > 0 ? (
        <View style={[s.row, theme.rowLine ? { borderTopWidth: 1, borderTopColor: theme.rowLine } : {}]}>
          <Text style={[{ padding: 4, fontSize: 8.5, fontWeight: "bold", width: totalLabelW }]}>Freight</Text>
          <Text style={[{ padding: 4, fontSize: 8.5, width: pc(cols.amount), textAlign: "right" }]}>{formatAmount(totals.freight)}</Text>
        </View>
      ) : null}
      {/* Total */}
      <View
        style={[
          s.row,
          theme.totalBg ? { backgroundColor: theme.totalBg } : {},
          theme.totalBorderTop ? { borderTopWidth: theme.totalBorderTop.w, borderTopColor: theme.totalBorderTop.color } : theme.rowLine ? { borderTopWidth: 1, borderTopColor: theme.rowLine } : {},
        ]}
      >
        <Text style={[{ padding: 4, fontSize: 9, fontWeight: "bold", width: totalLabelW, color: theme.totalColor ?? DARK }]}>Total</Text>
        <Text style={[{ padding: 4, fontSize: 9, fontWeight: "bold", width: pc(cols.amount), textAlign: "right", color: theme.totalColor ?? DARK }]}>
          ₹ {formatAmount(totals.total)}
        </Text>
      </View>
    </View>
  );
}

function Terms({ terms, accent, dark }: { terms: string[]; accent?: string; dark?: boolean }) {
  if (terms.length === 0) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[s.bold, accent ? { color: accent, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 8 } : { textDecoration: "underline" }]}>
        {accent ? "Terms & Conditions" : "Terms & Conditions:"}
      </Text>
      {terms.map((t, i) => (
        <View key={i} style={[s.row, { marginTop: 2 }]}>
          <Text style={{ width: 16, color: dark ? GREY : DARK }}>{i + 1}.</Text>
          <Text style={{ flex: 1, color: dark ? GREY : DARK }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function QSignOff({ profile, align = "right" }: { profile: CompanyProfile; align?: "left" | "right" }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={s.bold}>For {profile.name}</Text>
      {profile.quote.showSignature && profile.signature ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={profile.signature} style={{ height: 40, objectFit: "contain", marginVertical: 3 }} />
      ) : (
        <View style={{ height: 22 }} />
      )}
      <Text>Authorised Signatory</Text>
    </View>
  );
}

function QBank({ profile }: { profile: CompanyProfile }) {
  if (!profile.quote.showBankDetails) return <View />;
  return (
    <View style={{ width: "50%" }}>
      <Text style={s.bold}>Bank Details</Text>
      <Text>Bank: {profile.bank.name}</Text>
      <Text>Branch: {profile.bank.branch}</Text>
      <Text>A/c No.: {profile.bank.accountNo}</Text>
      <Text>IFSC: {profile.bank.ifsc}</Text>
    </View>
  );
}

// ===========================================================================
// 1 · CLASSIC — original VM Enterprises quotation (centred letterhead, black
// header/total bands). Preserved verbatim.
// ===========================================================================
function ClassicQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  return (
    <Page size="A4" style={[s.base, { padding: 28 }]}>
      {profile.logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={profile.logo} style={{ height: 44, objectFit: "contain", alignSelf: "center", marginBottom: 4 }} />
      ) : null}
      <Text style={{ fontSize: 22, lineHeight: 1.2, fontWeight: "bold", color: accent, textAlign: "center" }}>{profile.name}</Text>
      <Text style={{ fontSize: 10, fontWeight: "bold", textAlign: "center", color: DARK, marginBottom: 2 }}>{profile.tagline}</Text>
      <Text style={{ fontSize: 8, textAlign: "center", color: MUTED }}>Work Office: {profile.branchOffice}</Text>
      <Text style={{ fontSize: 8, textAlign: "center", color: MUTED }}>Reg. Office: {profile.regOffice}</Text>
      <View style={{ borderBottomWidth: 1, borderColor: GREY, marginVertical: 3 }} />
      <Text style={{ fontSize: 8, textAlign: "center", color: MUTED }}>Ph: {profile.phone}    Email: {profile.email}</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
        <View style={{ width: "62%" }}>
          <Text style={s.bold}>M/s  {quote.buyerName || "—"}</Text>
          <Text>{quote.buyerAddress}</Text>
        </View>
        <View style={{ width: "36%", textAlign: "right" }}>
          <Text style={s.bold}>Date: {fmtDate(quote.quoteDate) || "—"}</Text>
          <Text style={{ color: MUTED }}>Quotation No: {quote.quoteNo}</Text>
          {quote.validUntil ? <Text style={{ color: MUTED }}>Valid until: {fmtDate(quote.validUntil)}</Text> : null}
        </View>
      </View>

      <Text style={{ marginTop: 12, fontWeight: "bold", textDecoration: "underline" }}>Sub: - {quote.subject}</Text>
      <Text style={{ marginTop: 8, fontWeight: "bold" }}>{quote.heading}</Text>

      <QItemsTable quote={quote} totals={totals} showUnit={showUnit} theme={{ headBg: "#000000", headColor: "#ffffff", cellDivider: GREY, rowLine: GREY, outer: GREY, totalBg: "#000000", totalColor: "#ffffff" }} />

      <Text style={{ marginTop: 6, fontSize: 8.5 }}>
        <Text style={s.bold}>Amount in words: </Text>
        {totals.amountInWords}
      </Text>

      <Terms terms={terms} />

      <View style={s.grow} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 36 }}>
        <QBank profile={profile} />
        <QSignOff profile={profile} />
      </View>

      <Text style={s.note}>This is a quotation, not a tax invoice — prices are valid subject to the terms above.</Text>
    </Page>
  );
}

// ===========================================================================
// 2 · BANNER
// ===========================================================================
function BannerQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const onAccent = contrastText(accent);
  return (
    <Page size="A4" style={[s.base, { padding: 0 }]}>
      <View style={{ backgroundColor: accent, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", maxWidth: "62%" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 42, objectFit: "contain", marginRight: 10 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 19, lineHeight: 1.2, fontWeight: "bold", color: onAccent }}>{profile.name}</Text>
            <Text style={{ fontSize: 9, color: onAccent, opacity: 0.85 }}>{profile.tagline}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 18, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 2, color: onAccent }}>QUOTATION</Text>
          <Text style={{ fontSize: 9, color: onAccent }}>No: {quote.quoteNo || "—"}</Text>
          <Text style={{ fontSize: 9, color: onAccent }}>Date: {fmtDate(quote.quoteDate) || "—"}</Text>
        </View>
      </View>

      <View style={{ padding: 24, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: "62%" }}>
            <Text style={{ color: GREY, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.6 }}>Quotation for</Text>
            <Text style={s.bold}>M/s {quote.buyerName || "—"}</Text>
            <Text>{quote.buyerAddress}</Text>
          </View>
          {quote.validUntil ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: GREY, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.6 }}>Valid until</Text>
              <Text style={s.bold}>{fmtDate(quote.validUntil)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ marginTop: 12, fontWeight: "bold", color: accent }}>Sub: {quote.subject}</Text>
        <Text style={{ marginTop: 4, fontWeight: "bold" }}>{quote.heading}</Text>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} theme={{ headBg: accent, headColor: onAccent, rowLine: "#e5e7eb", zebra: ["#ffffff", tint(accent, 0.96)], totalBg: accent, totalColor: onAccent }} />

        <Text style={{ marginTop: 6, fontSize: 8.5 }}>
          <Text style={s.bold}>Amount in words: </Text>
          {totals.amountInWords}
        </Text>

        <Terms terms={terms} accent={accent} />

        <View style={s.grow} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 }}>
          <QBank profile={profile} />
          <QSignOff profile={profile} />
        </View>
        <Text style={s.note}>This is a quotation, not a tax invoice — prices are valid subject to the terms above.</Text>
      </View>
    </Page>
  );
}

// ===========================================================================
// 3 · MINIMAL
// ===========================================================================
function MinimalQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const hair = "#e3e6ea";
  const label = { color: GREY, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.8 };
  return (
    <Page size="A4" style={[s.base, { padding: 40 }]}>
      <View style={{ height: 3, backgroundColor: accent, width: 48, marginBottom: 10 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 34, objectFit: "contain", marginRight: 8 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 16, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 0.3 }}>{profile.name}</Text>
            <Text style={{ fontSize: 8.5, color: GREY }}>{profile.tagline}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, lineHeight: 1.2, color: GREY, textTransform: "uppercase", letterSpacing: 3 }}>Quotation</Text>
      </View>

      <View style={{ borderBottomWidth: 1, borderColor: hair, marginVertical: 12 }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ width: "60%" }}>
          <Text style={label}>Quotation for</Text>
          <Text style={s.bold}>M/s {quote.buyerName || "—"}</Text>
          <Text style={{ color: GREY }}>{quote.buyerAddress}</Text>
        </View>
        <View style={{ width: "36%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={label}>No.</Text>
            <Text style={s.bold}>{quote.quoteNo}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={label}>Date</Text>
            <Text style={s.bold}>{fmtDate(quote.quoteDate) || "—"}</Text>
          </View>
          {quote.validUntil ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={label}>Valid until</Text>
              <Text style={s.bold}>{fmtDate(quote.validUntil)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={{ marginTop: 12, fontWeight: "bold" }}>{quote.subject}</Text>
      <Text style={{ marginTop: 2, color: GREY }}>{quote.heading}</Text>

      <QItemsTable quote={quote} totals={totals} showUnit={showUnit} theme={{ headColor: GREY, headUpper: true, headBorderBottom: { w: 1, color: DARK }, rowLine: hair, totalBorderTop: { w: 1, color: DARK } }} />

      <Text style={{ marginTop: 8, color: GREY }}>{totals.amountInWords}</Text>

      <Terms terms={terms} />

      <View style={s.grow} />

      <View style={{ borderTopWidth: 1, borderColor: hair, marginTop: 16, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ width: "55%" }}>
          {profile.quote.showBankDetails ? (
            <>
              <Text style={label}>Payment</Text>
              <Text style={{ color: GREY }}>{profile.bank.name} · A/c {profile.bank.accountNo}</Text>
              <Text style={{ color: GREY }}>IFSC {profile.bank.ifsc}</Text>
            </>
          ) : null}
        </View>
        <QSignOff profile={profile} />
      </View>
    </Page>
  );
}

// ===========================================================================
// 4 · SIDEBAR
// ===========================================================================
function SidebarQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const onAccent = contrastText(accent);
  const grandBg = tint(accent, 0.88);
  const railLabel = { color: onAccent, opacity: 0.8, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.6, marginTop: 8 };
  return (
    <Page size="A4" style={[s.base, { padding: 0, flexDirection: "row" }]}>
      <View style={{ width: 150, backgroundColor: accent, padding: 16 }}>
        {profile.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={profile.logo} style={{ height: 40, objectFit: "contain", marginBottom: 8 }} />
        ) : null}
        <Text style={{ color: onAccent, fontSize: 15, lineHeight: 1.2, fontWeight: "bold" }}>{profile.name}</Text>
        <Text style={{ color: onAccent, opacity: 0.85, fontSize: 8 }}>{profile.tagline}</Text>
        <Text style={railLabel}>Office</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.branchOffice}</Text>
        <Text style={{ color: onAccent, fontSize: 8, marginTop: 2 }}>{profile.regOffice}</Text>
        <Text style={railLabel}>Contact</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.phone}</Text>
        <Text style={{ color: onAccent, fontSize: 8 }}>{profile.email}</Text>
        {profile.quote.showBankDetails ? (
          <>
            <Text style={railLabel}>Bank</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>{profile.bank.name}</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>A/c {profile.bank.accountNo}</Text>
            <Text style={{ color: onAccent, fontSize: 8 }}>IFSC {profile.bank.ifsc}</Text>
          </>
        ) : null}
      </View>

      <View style={{ flexGrow: 1, padding: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ fontSize: 22, lineHeight: 1.1, fontWeight: "bold", letterSpacing: 1, color: accent }}>QUOTATION</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: GREY }}>No. <Text style={[s.bold, { color: DARK }]}>{quote.quoteNo}</Text></Text>
            <Text style={{ color: GREY }}>Date <Text style={[s.bold, { color: DARK }]}>{fmtDate(quote.quoteDate) || "—"}</Text></Text>
            {quote.validUntil ? <Text style={{ color: GREY }}>Valid until <Text style={[s.bold, { color: DARK }]}>{fmtDate(quote.validUntil)}</Text></Text> : null}
          </View>
        </View>
        <View style={{ borderBottomWidth: 2, borderColor: accent, marginTop: 8, marginBottom: 12 }} />

        <Text style={{ color: accent, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "bold" }}>Quotation for</Text>
        <Text style={s.bold}>M/s {quote.buyerName || "—"}</Text>
        <Text>{quote.buyerAddress}</Text>

        <Text style={{ marginTop: 10, fontWeight: "bold" }}>Sub: {quote.subject}</Text>
        <Text style={{ marginTop: 2, color: MUTED }}>{quote.heading}</Text>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} theme={{ headColor: accent, headUpper: true, headBorderBottom: { w: 1.5, color: accent }, rowLine: "#e5e7eb", totalBg: grandBg }} />

        <Text style={{ marginTop: 8, color: MUTED }}>
          <Text style={s.bold}>In words: </Text>
          {totals.amountInWords}
        </Text>

        <Terms terms={terms} accent={accent} />

        <View style={s.grow} />

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
          <QSignOff profile={profile} />
        </View>
      </View>
    </Page>
  );
}

// ===========================================================================
// 5 · PREMIUM
// ===========================================================================
function PremiumQuote({ quote, totals, profile, accent, terms, showUnit }: QCtx) {
  const micro = { color: accent, fontSize: 7, textTransform: "uppercase" as const, letterSpacing: 0.8, fontWeight: "bold" as const, marginBottom: 2 };
  return (
    <Page size="A4" style={[s.base, { padding: 0 }]}>
      <View style={{ backgroundColor: SLATE, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", maxWidth: "60%" }}>
          {profile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={profile.logo} style={{ height: 42, objectFit: "contain", marginRight: 10 }} />
          ) : null}
          <View>
            <Text style={{ fontSize: 19, lineHeight: 1.2, fontWeight: "bold", color: "#ffffff" }}>{profile.name}</Text>
            <Text style={{ fontSize: 9, color: "#ffffff", letterSpacing: 0.5 }}>{profile.tagline}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, lineHeight: 1.2, fontWeight: "bold", letterSpacing: 2, color: "#ffffff" }}>QUOTATION</Text>
          <Text style={{ fontSize: 9, color: "#d1d5db" }}>No: {quote.quoteNo || "—"}</Text>
          <Text style={{ fontSize: 9, color: "#d1d5db" }}>Date: {fmtDate(quote.quoteDate) || "—"}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: accent }} />

      <View style={{ padding: 24, flexGrow: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: "62%" }}>
            <Text style={micro}>Quotation for</Text>
            <Text style={s.bold}>M/s {quote.buyerName || "—"}</Text>
            <Text style={{ color: MUTED }}>{quote.buyerAddress}</Text>
          </View>
          {quote.validUntil ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={micro}>Valid until</Text>
              <Text style={s.bold}>{fmtDate(quote.validUntil)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ marginTop: 12, fontWeight: "bold" }}>Sub: {quote.subject}</Text>
        <Text style={{ marginTop: 2, color: MUTED }}>{quote.heading}</Text>

        <QItemsTable quote={quote} totals={totals} showUnit={showUnit} theme={{ headBg: SLATE, headColor: "#ffffff", headUpper: true, rowLine: "#e5e7eb", totalBg: SLATE, totalColor: "#ffffff" }} />

        <Text style={{ marginTop: 8, color: MUTED }}>
          <Text style={s.bold}>Amount in words: </Text>
          {totals.amountInWords}
        </Text>

        <Terms terms={terms} accent={accent} dark />

        <View style={s.grow} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 }}>
          <QBank profile={profile} />
          <QSignOff profile={profile} />
        </View>
      </View>
    </Page>
  );
}

function QuoteDocument({ quote, totals, profile }: { quote: Quote; totals: QuoteTotals; profile: CompanyProfile }) {
  const spec = getTemplate(quote.template ?? profile.quoteTemplate);
  const accent = quote.accentColor || profile.accentColor || "#c0392b";
  const ctx: QCtx = { quote, totals, profile, accent, terms: termLines(quote.terms), showUnit: profile.quote.showUnit };
  return (
    <Document title={`Quotation ${quote.quoteNo}`}>
      {spec.id === "banner" ? (
        <BannerQuote {...ctx} />
      ) : spec.id === "minimal" ? (
        <MinimalQuote {...ctx} />
      ) : spec.id === "sidebar" ? (
        <SidebarQuote {...ctx} />
      ) : spec.id === "premium" ? (
        <PremiumQuote {...ctx} />
      ) : (
        <ClassicQuote {...ctx} />
      )}
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
