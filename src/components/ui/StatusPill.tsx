// Small status chip shared across the app (invoice/quote states, etc.). Tones map
// to the semantic tokens; ships with its label, never color alone.

import type { ReactNode } from "react";

export type PillTone = "pos" | "warn" | "neg" | "info" | "neutral";

const tones: Record<PillTone, string> = {
  pos: "bg-pos-weak text-pos",
  warn: "bg-warn-weak text-warn",
  neg: "bg-neg-weak text-neg",
  info: "bg-[#eaf1fc] text-[#1c5cab]",
  neutral: "bg-surface-2 text-muted",
};

export default function StatusPill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
