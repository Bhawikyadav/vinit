"use client";

// Dashboard panel for the private follow-up reminders set on invoices. Shows the
// soonest (and overdue) first so the owner knows who to chase for the next order.
// Rows cascade in on mount; marking one Done plays a quick collapse before it
// leaves the list. All motion is gated behind prefers-reduced-motion in
// globals.css (.followup-row*), matching the dashboard's trend-chart convention.

import { useState } from "react";
import Link from "next/link";
import Panel, { EmptyState } from "./Panel";
import { IconArrowUpRight } from "./icons";
import { relativeDayLabel, followUpUrgency, type FollowUpUrgency } from "@/lib/followup";
import type { FollowUpRow } from "@/lib/stats";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TILE: Record<FollowUpUrgency, string> = {
  overdue: "bg-neg-weak text-neg",
  today: "bg-accent-weak text-accent",
  soon: "bg-warn-weak text-warn",
  later: "bg-surface-2 text-muted",
};
const LABEL: Record<FollowUpUrgency, string> = {
  overdue: "text-neg",
  today: "text-accent",
  soon: "text-warn",
  later: "text-faint",
};

function DateTile({ date, urgency }: { date: string; urgency: FollowUpUrgency }) {
  const [, m, d] = date.split("-");
  const month = MONTHS[Number(m) - 1] ?? "";
  return (
    <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${TILE[urgency]}`}>
      <span className="text-sm font-bold leading-none tabular-nums">{Number(d)}</span>
      <span className="mt-0.5 text-[10px] font-medium uppercase leading-none">{month}</span>
    </span>
  );
}

export default function FollowUpsPanel({
  rows,
  onDone,
  className,
}: {
  rows: FollowUpRow[];
  onDone: (id: string) => void;
  className?: string;
}) {
  // Rows mid-exit: kept briefly so the collapse animation can play before the
  // parent drops them from the list.
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  function markDone(id: string) {
    setLeaving((s) => new Set(s).add(id));
    window.setTimeout(() => onDone(id), 240);
  }

  const overdue = rows.filter((r) => followUpUrgency(r.date) === "overdue").length;

  return (
    <Panel
      title="Follow-ups"
      action={
        overdue > 0 ? (
          <span className="inline-flex items-center rounded-full bg-neg-weak px-2 py-0.5 text-[11px] font-semibold text-neg">
            {overdue} overdue
          </span>
        ) : rows.length > 0 ? (
          <span className="text-xs font-medium text-faint">{rows.length} upcoming</span>
        ) : null
      }
      className={className}
      bodyClassName="py-1.5"
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No follow-ups scheduled"
          hint="Set a reminder on an invoice to plan the next order — it shows up here."
        />
      ) : (
        <ul className="divide-y divide-hair">
          {rows.map((r, i) => {
            const urgency = followUpUrgency(r.date);
            const isLeaving = leaving.has(r.id);
            return (
              <li
                key={r.id}
                style={{ animationDelay: isLeaving ? undefined : `${Math.min(i, 8) * 55}ms` }}
                className={`flex items-center gap-3 py-2.5 ${isLeaving ? "followup-row-out" : "followup-row"}`}
              >
                <DateTile date={r.date} urgency={urgency} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.customer}</p>
                  <p className="truncate text-xs text-faint">
                    {r.no || "—"}
                    {r.note ? <span className="text-muted"> · {r.note}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`text-xs font-semibold ${LABEL[urgency]}`}>{relativeDayLabel(r.date)}</span>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/gstbill?id=${encodeURIComponent(r.id)}`}
                      aria-label={`Open invoice ${r.no}`}
                      className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      Open <IconArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => markDone(r.id)}
                      aria-label={`Mark follow-up for ${r.customer} done`}
                      className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-pos transition-colors hover:bg-pos-weak"
                    >
                      <IconCheck className="h-3.5 w-3.5" /> Done
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12.5l4 4L19 6.5" />
    </svg>
  );
}
