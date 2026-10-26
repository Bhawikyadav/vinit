// The dashboard's data panels, all built on Panel so the grid reads as one
// system. Amounts use tabular-nums (they sit in columns); the headline KPI
// numbers live in StatTile with proportional figures.

import Link from "next/link";
import type { ReactNode } from "react";
import type { CompanyProfile } from "@/lib/types";
import type { DashboardStats, InvoiceRow, QuoteRow, TopEntry } from "@/lib/stats";
import { inr } from "@/lib/stats";
import Panel, { EmptyState, ViewAll } from "./Panel";
import { IconPlus } from "./icons";

function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

type Tone = "pos" | "warn" | "faint" | "neutral";
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    pos: "bg-pos-weak text-pos",
    warn: "bg-warn-weak text-warn",
    faint: "bg-surface-2 text-faint",
    neutral: "bg-surface-2 text-muted",
  };
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------

export function RecentInvoices({ rows, className }: { rows: InvoiceRow[]; className?: string }) {
  return (
    <Panel title="Recent invoices" action={<ViewAll href="/gstbill/history" />} className={className} bodyClassName="py-1.5">
      {rows.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          hint="Your latest tax invoices will appear here."
          cta={
            <Link href="/gstbill" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">
              <IconPlus className="h-4 w-4" /> New invoice
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-hair">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/gstbill?id=${encodeURIComponent(r.id)}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{r.customer}</span>
                  <span className="block truncate text-xs text-faint tabular-nums">{r.no || "—"}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-ink">{inr(r.amount)}</span>
                  <span className="block text-xs text-faint tabular-nums">{fmtDate(r.date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function QuotationsPanel({ rows, pipelineValue, expiring, className }: { rows: QuoteRow[]; pipelineValue: number; expiring: number; className?: string }) {
  const quoteStatus = (q: QuoteRow) =>
    !q.validUntil ? <Pill tone="neutral">Open</Pill>
    : q.expired ? <Pill tone="faint">Expired</Pill>
    : q.expiringSoon ? <Pill tone="warn">Expiring soon</Pill>
    : <Pill tone="pos">Valid</Pill>;

  return (
    <Panel title="Quotations" action={<ViewAll href="/quotation/history" />} className={className} bodyClassName="py-1.5">
      {rows.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          hint="Quote prices pre-GST and convert to an invoice in one click."
          cta={
            <Link href="/quotation" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">
              <IconPlus className="h-4 w-4" /> New quotation
            </Link>
          }
        />
      ) : (
        <>
          <p className="px-1 pb-2 pt-1 text-xs text-muted">
            <span className="font-semibold tabular-nums text-ink">{inr(pipelineValue)}</span> in live pipeline
            {expiring > 0 ? <> · <span className="font-medium text-warn">{expiring} expiring soon</span></> : null}
          </p>
          <ul className="divide-y divide-hair">
            {rows.map((q) => (
              <li key={q.id}>
                <Link href={`/quotation?id=${encodeURIComponent(q.id)}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{q.customer}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-ink">{inr(q.amount)}</span>
                      {quoteStatus(q)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-faint tabular-nums">{fmtDate(q.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function GstBreakup({ gst, split, className }: { gst: DashboardStats["gst"]; split: DashboardStats["split"]; className?: string }) {
  const rows: [string, number][] = [["CGST", gst.cgst], ["SGST", gst.sgst], ["IGST", gst.igst]];
  const salesTotal = split.intra + split.inter;
  const intraPct = salesTotal > 0 ? (split.intra / salesTotal) * 100 : 0;

  return (
    <Panel title="GST & tax" className={className}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Output GST this period</span>
        <span className="text-xl font-semibold tabular-nums text-ink">{inr(gst.total)}</span>
      </div>

      <dl className="mt-4 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{inr(v)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-faint">
          <span>Place of supply</span>
          <span className="tabular-nums">{Math.round(intraPct)}% intra · {100 - Math.round(intraPct)}% inter</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${Math.round(intraPct)} percent intra-state sales`}>
          <div className="h-full bg-[#2a78d6]" style={{ width: `${intraPct}%` }} />
          <div className="h-full bg-[#199e70]" style={{ width: `${100 - intraPct}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2a78d6]" />Intra-state</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#199e70]" />Inter-state</span>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function TopList({ title, entries, unit, emptyHint, className }: { title: string; entries: TopEntry[]; unit: string; emptyHint: string; className?: string }) {
  const max = entries[0]?.value || 1;
  return (
    <Panel title={title} className={className} bodyClassName="py-3">
      {entries.length === 0 ? (
        <EmptyState title="Nothing to rank yet" hint={emptyHint} />
      ) : (
        <ul className="space-y-3.5">
          {entries.map((e) => (
            <li key={e.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{e.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{inr(e.value)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(4, (e.value / max) * 100)}%` }} />
                </div>
                <span className="shrink-0 text-xs text-faint tabular-nums">{e.count} {unit}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function ComplianceCard({ profile, fy, periodLabel, gstTotal, className }: { profile: CompanyProfile; fy: string; periodLabel: string; gstTotal: number; className?: string }) {
  const rows: [string, string][] = [
    ["GSTIN", profile.gstin || "—"],
    ["State", `${profile.stateName || "—"}${profile.stateCode ? ` (${profile.stateCode})` : ""}`],
    ["Financial year", fy],
  ];
  return (
    <Panel title="Business & compliance" action={<ViewAll href="/gstbill/settings">Company profile</ViewAll>} className={className}>
      <dl className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="truncate text-right font-medium tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-xl bg-surface-2 p-3">
        <p className="text-xs text-faint">Output GST you&apos;ve billed · {periodLabel}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{inr(gstTotal)}</p>
        <p className="mt-1 text-xs text-faint">Before input-credit set-off. File on the GST portal.</p>
      </div>
    </Panel>
  );
}
