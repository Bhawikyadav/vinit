// The per-page toolbar that sits at the top of the content area inside the app
// shell: title + optional subtitle on the left, actions on the right, an optional
// back link on mobile. Sticky, so actions stay reachable while the page scrolls.
// The global navigation (rail / bottom tabs) lives in the shell, not here.

import Link from "next/link";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-hair bg-canvas/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
