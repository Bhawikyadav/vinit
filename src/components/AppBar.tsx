import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Mobile-first sticky top bar shared by every billing page.
 * - A Home button (drawn icon) always sits first, left of the title.
 * - On phones the title sits on its own line and the actions wrap below with
 *   comfortable tap targets; on wider screens everything is one row.
 */
export default function AppBar({
  title,
  subtitle,
  actions,
  status,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-20 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="flex w-full flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 10.75 12 3l9 7.75" />
              <path d="M5.25 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.75a1 1 0 0 0 1-1V9.5" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-gray-900 sm:text-lg">
              {title}
            </h1>
            {subtitle ? <p className="truncate text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
      {status ? (
        <div className="px-3 pb-2 text-sm text-gray-700 sm:px-4">{status}</div>
      ) : null}
    </header>
  );
}
