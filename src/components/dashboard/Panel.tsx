// Card wrapper for a dashboard panel: a titled header with an optional action
// (usually a "View all" link) and a body. One consistent card vocabulary across
// the grid, so nothing reads as a stray component.

import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronRight } from "./icons";

export function ViewAll({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 rounded-md text-sm font-medium text-accent transition-colors hover:underline">
      {children}
      <IconChevronRight className="h-4 w-4" />
    </Link>
  );
}

export default function Panel({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-hair bg-surface shadow-card ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-hair px-5 py-3.5">
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className={`flex-1 px-5 py-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// Teaching empty state used inside panels when there's nothing yet.
export function EmptyState({ title, hint, cta }: { title: string; hint?: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </div>
  );
}
