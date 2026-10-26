// The authenticated home is now the sales dashboard. The old quick-action grid
// (New Bill / All Bills / New Quotation / All Quotations / Company Profile) lives
// inside the dashboard shell: the rail, the top-bar "New invoice" button, and the
// mobile "＋" sheet.
//
// The dashboard reads today's date (to resolve "this month" / the current FY),
// so it is a dynamic client surface — a Suspense boundary keeps it out of the
// static prerender (Next Cache Components) and streams it in behind a silhouette.

import { Suspense } from "react";
import Dashboard from "@/components/dashboard/Dashboard";

// Rendered inside the shell's <main> while the dashboard streams in, so it needs
// no page frame of its own — just the content silhouette.
function DashboardFallback() {
  return (
    <div className="animate-pulse space-y-5 pt-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-hair bg-surface shadow-card" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-hair bg-surface shadow-card" />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard />
    </Suspense>
  );
}
