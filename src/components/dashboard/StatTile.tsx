// A KPI stat tile: label · value · signed delta vs a named period · optional
// sub-line · optional sparkline. The value uses proportional figures (big
// standalone numbers look loose in tabular); columns elsewhere use tabular-nums.

import type { Delta } from "@/lib/stats";
import { pct } from "@/lib/stats";
import type { ReactNode } from "react";

function DeltaPill({ delta, label, upIsGood }: { delta: Delta; label: string; upIsGood: boolean }) {
  const up = delta.pct >= 0;
  const good = up === upIsGood;
  const color = good ? "text-pos" : "text-neg";
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <span className={`inline-flex items-center gap-0.5 ${color}`}>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${up ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 13 L12 6 L19 13" />
          <path d="M12 6 v12" />
        </svg>
        <span className="tabular-nums">{pct(delta.pct)}</span>
      </span>
      <span className="text-faint">{label}</span>
    </span>
  );
}

export default function StatTile({
  label,
  value,
  accent,
  delta,
  deltaLabel,
  sub,
  upIsGood = true,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean; // the headline tile (Total Sales) gets a slightly larger value
  delta?: Delta | null;
  deltaLabel?: string;
  sub?: ReactNode;
  upIsGood?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-hair bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <span className="text-faint">{icon}</span> : null}
      </div>

      <div className="mt-2">
        <span className={`block truncate font-semibold leading-none tracking-tight text-ink ${accent ? "text-[30px] sm:text-4xl" : "text-[26px] sm:text-3xl"}`}>
          {value}
        </span>
      </div>

      <div className="mt-3 min-h-[20px]">
        {delta ? (
          <DeltaPill delta={delta} label={deltaLabel ?? "vs prev"} upIsGood={upIsGood} />
        ) : sub ? (
          <span className="text-sm text-muted">{sub}</span>
        ) : (
          <span className="text-sm text-faint">No prior period</span>
        )}
      </div>
      {delta && sub ? <div className="mt-1 text-sm text-muted">{sub}</div> : null}
    </div>
  );
}
