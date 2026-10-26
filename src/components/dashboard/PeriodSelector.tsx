"use client";

// The window every metric is measured over. A button showing the current range,
// with a small menu of the four presets. Click-away and Escape close it.

import { useEffect, useRef, useState } from "react";
import { makePeriod, PERIOD_KEYS, type PeriodKey } from "@/lib/stats";
import { IconCalendar, IconChevronDown } from "./icons";

export default function PeriodSelector({
  value,
  onChange,
  tone = "light",
}: {
  value: PeriodKey;
  onChange: (k: PeriodKey) => void;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = makePeriod(value).label;
  const trigger =
    tone === "dark"
      ? "border-white/15 bg-white/5 text-rail-fg hover:bg-white/10"
      : "border-hair bg-surface text-ink shadow-card hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${trigger}`}
      >
        <IconCalendar className="h-[18px] w-[18px] opacity-70" />
        <span className="tabular-nums">{label}</span>
        <IconChevronDown className={`h-4 w-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-hair bg-surface p-1 shadow-pop"
        >
          {PERIOD_KEYS.map((k) => {
            const active = k === value;
            return (
              <button
                key={k}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active ? "bg-accent-weak font-semibold text-accent" : "text-ink hover:bg-surface-2"
                }`}
              >
                <span className="tabular-nums">{makePeriod(k).label}</span>
                {active && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
