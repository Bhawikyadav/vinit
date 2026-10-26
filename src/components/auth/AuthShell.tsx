// Shared frame for the /login and /signup pages. A split screen that echoes the
// dashboard's design system: the signature dark navy rail becomes a brand panel
// on the left, and the form sits in a white surface card on the light canvas —
// same tokens (rail / canvas / surface / hair / ink / muted / accent), same
// Geist font, same accent focus+selection (inherited via the `.dash` class).
//
// The left panel is desktop-only; on phones a compact brand mark sits above the
// card. Form markup stays in each page (their fields and handlers differ); this
// owns the layout, brand, and the shared field/label/button classes so the two
// pages can never drift apart.

import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

// ---- Shared control classes (imported by both auth pages) ----
export const authLabel = "mb-1.5 block text-sm font-medium text-ink";
export const authField =
  "w-full rounded-xl border border-hair bg-surface px-3.5 py-2.5 text-sm text-ink lg:py-3 lg:text-[0.95rem] " +
  "placeholder:text-faint outline-none transition-colors focus:border-accent " +
  "focus:ring-2 focus:ring-accent/25";
export const authPrimaryBtn =
  "flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 lg:py-3 " +
  "text-sm font-semibold text-accent-fg shadow-card transition hover:brightness-110 lg:text-[0.95rem] " +
  "active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

// The product mark — an accent tile with a drawn invoice glyph. `size` is the
// tile edge in px; the glyph scales with it.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-card"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <path d="M7.5 3.5h6.4L18 7.6v10.9A1.5 1.5 0 0 1 16.5 20h-9A1.5 1.5 0 0 1 6 18.5v-13.5A1.5 1.5 0 0 1 7.5 3.5Z" />
        <path d="M13.8 3.6v4h4" />
        <path d="M9 12h6M9 15h4.5" />
      </svg>
    </span>
  );
}

// Inline form error — themed with the negative tokens, not a bare red string.
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-neg-weak px-3 py-2.5 text-sm text-neg">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5M12 16h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
      </span>
      <span className="text-sm leading-relaxed text-rail-fg">{children}</span>
    </li>
  );
}

function BrandPanel() {
  return (
    <aside className="dash-rail relative hidden flex-col justify-between overflow-hidden bg-rail p-10 xl:p-12 lg:flex">
      {/* A single soft accent bloom for depth — not a glass panel. */}
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-accent/12 blur-3xl" />
      <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-rail-2/70 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <BrandMark size={44} />
        <span className="text-lg font-semibold tracking-tight text-rail-fg">{BRAND.name}</span>
      </div>

      <div className="relative max-w-sm">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-rail-fg xl:text-[2.1rem]">
          GST invoices &amp; quotations, done in minutes.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-rail-muted">
          Create tax invoices and quotations, track your sales, and run your whole
          billing in one place.
        </p>
        <ul className="mt-8 space-y-4">
          <Bullet>Correct CGST &amp; SGST or IGST on every invoice, automatically.</Bullet>
          <Bullet>Quotations that convert to an invoice in one click.</Bullet>
          <Bullet>A private, isolated space for your company — no one else sees your data.</Bullet>
        </ul>
      </div>

      <div className="relative flex items-center gap-2 text-xs text-rail-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Your data is private to your company and isolated from every other.
      </div>
    </aside>
  );
}

export default function AuthShell({
  heading,
  sub,
  children,
  footer,
}: {
  heading: string;
  sub: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="dash min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />

      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm lg:max-w-md">
          {/* Compact brand mark for phones (panel is desktop-only). */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={36} />
            <span className="text-lg font-semibold tracking-tight text-ink">{BRAND.name}</span>
          </div>

          <div className="rounded-2xl border border-hair bg-surface p-6 shadow-card sm:p-7 lg:p-9">
            <h1 className="text-xl font-semibold tracking-tight text-ink lg:text-2xl">{heading}</h1>
            <p className="mt-1 text-sm text-muted lg:text-[0.95rem]">{sub}</p>
            <div className="mt-6 lg:mt-7">{children}</div>
          </div>

          <p className="mt-5 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </main>
  );
}
