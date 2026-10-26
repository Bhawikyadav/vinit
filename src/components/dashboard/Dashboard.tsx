"use client";

// The sales dashboard. Loads every bill + quote (the app's established
// client-side pattern), aggregates them for the chosen period with computeStats,
// and composes the shell + KPI tiles + trend + panels. Invoiced-revenue metrics
// only — an invoice is a sale the moment it exists.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import PeriodSelector from "./PeriodSelector";
import StatTile from "./StatTile";
import SalesTrendChart from "./SalesTrendChart";
import Panel from "./Panel";
import { RecentInvoices, QuotationsPanel, GstBreakup, TopList, ComplianceCard } from "./panels";
import { IconPlus } from "./icons";
import { getAllBills, getProfile } from "@/lib/storage";
import { getAllQuotes } from "@/lib/quoteStorage";
import { computeStats, inr, inrCompact, makePeriod, type DashboardStats, type PeriodKey } from "@/lib/stats";
import { financialYear } from "@/lib/gst";
import { DEFAULT_PROFILE } from "@/lib/company";
import type { Bill, CompanyProfile, Quote } from "@/lib/types";

const DELTA_LABEL: Record<PeriodKey, string> = {
  thisMonth: "vs last month",
  lastMonth: "vs month before",
  thisFY: "vs last FY",
  last12m: "vs prior 12m",
};

export default function Dashboard() {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE);
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");

  useEffect(() => {
    (async () => {
      const [b, q, p] = await Promise.all([
        getAllBills().catch(() => [] as Bill[]),
        getAllQuotes().catch(() => [] as Quote[]),
        getProfile().catch(() => DEFAULT_PROFILE),
      ]);
      setBills(b);
      setQuotes(q);
      setProfile(p);
    })();
  }, []);

  const loading = bills === null || quotes === null;
  const periodObj = useMemo(() => makePeriod(period), [period]);
  const stats = useMemo(
    () => (loading ? null : computeStats(bills!, quotes!, periodObj, profile.stateCode)),
    [loading, bills, quotes, periodObj, profile.stateCode],
  );

  return (
    <>
      <PageHeader
        // Company identity lives in the rail (desktop) and the mobile top bar, so
        // the page title stays generic — no duplicated company name on mobile.
        title="Dashboard"
        subtitle="Sales overview"
        actions={
          <>
            <PeriodSelector value={period} onChange={setPeriod} />
            <Link href="/gstbill" className={buttonStyles("primary", "sm", "hidden sm:inline-flex")}>
              <IconPlus className="h-[18px] w-[18px]" /> New invoice
            </Link>
          </>
        }
      />
      {!stats ? (
        <DashboardSkeleton />
      ) : !stats.hasInvoices && !stats.hasQuotes ? (
        <Welcome />
      ) : (
        <DashboardBody stats={stats} profile={profile} period={period} periodLabel={periodObj.label} />
      )}
    </>
  );
}

function DashboardBody({
  stats,
  profile,
  period,
  periodLabel,
}: {
  stats: DashboardStats;
  profile: CompanyProfile;
  period: PeriodKey;
  periodLabel: string;
}) {
  const dl = DELTA_LABEL[period];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          accent
          label="Total sales"
          value={inrCompact(stats.sales.total)}
          delta={stats.sales.delta}
          deltaLabel={dl}
          sub={`${stats.sales.count} invoice${stats.sales.count === 1 ? "" : "s"}`}
        />
        <StatTile label="GST collected" value={inrCompact(stats.gst.total)} delta={stats.gst.delta} deltaLabel={dl} />
        <StatTile
          label="Invoices"
          value={stats.invoices.count.toLocaleString("en-IN")}
          delta={stats.invoices.delta}
          deltaLabel={dl}
          sub={stats.sales.count ? `avg ${inr(stats.sales.avg)}` : undefined}
        />
        <StatTile
          label="Quotation pipeline"
          value={inrCompact(stats.quotes.pipelineValue)}
          sub={`${stats.quotes.count} this period${stats.quotes.expiringSoon ? ` · ${stats.quotes.expiringSoon} expiring` : ""}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Sales trend" action={<span className="text-xs tabular-nums text-faint">{periodLabel}</span>} className="lg:col-span-2" bodyClassName="pt-3">
          <SalesTrendChart data={stats.trend} />
        </Panel>
        <GstBreakup gst={stats.gst} split={stats.split} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <RecentInvoices rows={stats.recentInvoices} className="lg:col-span-2" />
        <QuotationsPanel rows={stats.recentQuotes} pipelineValue={stats.quotes.pipelineValue} expiring={stats.quotes.expiringSoon} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TopList title="Top customers" entries={stats.topCustomers} unit="inv" emptyHint="Bill a customer to see your best accounts." />
        <TopList title="Top items & services" entries={stats.topItems} unit="units" emptyHint="Add items to invoices to rank them." />
        <ComplianceCard profile={profile} fy={`FY ${financialYear()}`} periodLabel={periodLabel} gstTotal={stats.gst.total} />
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-hair bg-surface p-8 text-center shadow-card">
      <h2 className="text-lg font-semibold text-ink">Welcome to your dashboard</h2>
      <p className="mt-1.5 text-sm text-muted">Create your first invoice or quotation and your sales will start tracking here — revenue, GST, top customers and more.</p>
      <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
        <Link href="/gstbill" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg">
          <IconPlus className="h-[18px] w-[18px]" /> New invoice
        </Link>
        <Link href="/quotation" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-hair bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
          <IconPlus className="h-[18px] w-[18px]" /> New quotation
        </Link>
      </div>
    </div>
  );
}

// ---- Loading skeleton: same grid, no spinners in content ----
function SkelCard({ className = "", lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={`rounded-2xl border border-hair bg-surface p-5 shadow-card ${className}`}>
      <div className="h-4 w-24 rounded bg-surface-2" />
      <div className="mt-3 h-8 w-32 rounded bg-surface-2" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mt-3 h-3 w-full rounded bg-surface-2" />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkelCard key={i} lines={1} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-hair bg-surface p-5 shadow-card lg:col-span-2">
          <div className="h-4 w-28 rounded bg-surface-2" />
          <div className="mt-4 h-[200px] w-full rounded-xl bg-surface-2" />
        </div>
        <SkelCard lines={4} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <SkelCard className="lg:col-span-2" lines={4} />
        <SkelCard lines={4} />
      </div>
    </div>
  );
}
