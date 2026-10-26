"use client";

// The persistent application chrome, mounted once in the root layout so it never
// unmounts as the user navigates — the dark rail (desktop) and the bottom tab bar
// (mobile) stay fixed in place while only the page content swaps underneath. This
// is what makes "the footer stays when you click anywhere" true: it is the same
// DOM across routes, not a per-page copy.
//
// It owns navigation only. Each page supplies its own <PageHeader> for the page
// title and actions; the shell deliberately renders no top bar so there is exactly
// one header per page. Auth routes (/login, /signup) bring their own full-screen
// AuthShell, so the chrome steps aside for them.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getProfile } from "@/lib/storage";
import { DEFAULT_PROFILE } from "@/lib/company";
import { BRAND } from "@/lib/brand";
import type { CompanyProfile } from "@/lib/types";
import {
  IconGrid, IconReceipt, IconFile, IconBuilding, IconPlus, IconClose,
} from "@/components/dashboard/icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { className?: string }) => ReactNode;
}

const RECORDS: NavItem[] = [
  { href: "/gstbill/history", label: "Invoices", icon: IconReceipt },
  { href: "/quotation/history", label: "Quotations", icon: IconFile },
];

// Routes that render their own full-screen frame — the chrome steps aside.
function isBareRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/")
  );
}

function BrandMark({ logo, name }: { logo?: string; name: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1" />;
  }
  const initials =
    name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold tracking-tight text-accent-fg">
      {initials}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);

  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE);
  const [me, setMe] = useState("");
  const [sheet, setSheet] = useState(false);

  // Load the company identity once for the rail. Skipped on auth routes (no
  // session yet, and the request would just 401). Because the shell never
  // unmounts, this runs once per visit, not once per navigation.
  useEffect(() => {
    if (bare) return;
    let alive = true;
    getProfile().then((p) => alive && setProfile(p)).catch(() => {});
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setMe(d.name || d.email || ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bare]);

  // Close the create sheet on Escape. (Navigating from it closes it via the
  // links' own onClick — its backdrop covers the tab bar, so a sheet link is
  // the only way to leave while it is open.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Keep the rail's shown name in sync when the account page saves a change.
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const d = (e as CustomEvent<{ name?: string; email?: string }>).detail;
      if (d) setMe(d.name || d.email || "");
    };
    window.addEventListener("bm:account-updated", onUpdated);
    return () => window.removeEventListener("bm:account-updated", onUpdated);
  }, []);

  if (bare) return <>{children}</>;

  const companyName = profile.name || BRAND.name;
  const tagline = profile.tagline || BRAND.tagline;
  const logo = profile.logo || undefined;
  const userName = me || profile.proprietor || "Account";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const railLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-accent text-accent-fg shadow-sm" : "text-rail-muted hover:bg-rail-2 hover:text-rail-fg"
        }`}
      >
        <item.icon className="h-[20px] w-[20px]" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="dash min-h-screen">
      {/* ---------- Desktop rail ---------- */}
      <aside className="dash-rail fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col bg-rail px-4 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-3 px-1">
          <BrandMark logo={logo} name={companyName} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-rail-fg">{companyName}</span>
            <span className="block truncate text-xs text-rail-muted">{tagline || "GST Billing"}</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {railLink({ href: "/", label: "Dashboard", icon: IconGrid })}

          <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-rail-muted/70">Create</p>
          <Link
            href="/gstbill"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-rail-fg transition-colors hover:bg-white/10"
          >
            <IconPlus className="h-5 w-5 text-accent-fg" />
            New invoice
          </Link>
          <Link
            href="/quotation"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rail-muted transition-colors hover:bg-rail-2 hover:text-rail-fg"
          >
            <IconPlus className="h-5 w-5" />
            New quotation
          </Link>

          <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-rail-muted/70">Records</p>
          {RECORDS.map(railLink)}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-3">
          {railLink({ href: "/gstbill/settings", label: "Company", icon: IconBuilding })}
          <Link
            href="/account"
            aria-label="Your account"
            className={`mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-rail-2 ${isActive("/account") ? "bg-rail-2" : ""}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rail-2 text-xs font-semibold text-rail-fg ring-1 ring-white/10">
              {(userName[0] || "·").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-rail-fg">{userName}</span>
          </Link>
        </div>
      </aside>

      {/* ---------- Content column ---------- */}
      <div className="lg:ml-[260px]">
        {/* Mobile top bar: brand + account (the rail is desktop-only, so without
            this mobile has no way to reach the account page). Log out lives on the
            account page itself. Non-sticky, so it scrolls away and each page's own
            sticky PageHeader pins cleanly. */}
        <header className="flex items-center justify-between gap-2 border-b border-hair bg-canvas px-4 py-2.5 lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark logo={logo} name={companyName} />
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{companyName}</span>
          </Link>
          <Link
            href="/account"
            aria-label="Your account"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink ring-1 ring-hair transition-colors hover:bg-hair"
          >
            {(userName[0] || "·").toUpperCase()}
          </Link>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t border-hair bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <TabLink href="/" label="Home" active={isActive("/")} icon={<IconGrid className="h-[22px] w-[22px]" />} />
        <TabLink href="/gstbill/history" label="Invoices" active={isActive("/gstbill/history")} icon={<IconReceipt className="h-[22px] w-[22px]" />} />
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5"
          aria-label="Create new"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-card">
            <IconPlus className="h-6 w-6" />
          </span>
        </button>
        <TabLink href="/quotation/history" label="Quotes" active={isActive("/quotation/history")} icon={<IconFile className="h-[22px] w-[22px]" />} />
        <TabLink href="/gstbill/settings" label="Company" active={isActive("/gstbill/settings")} icon={<IconBuilding className="h-[22px] w-[22px]" />} />
      </nav>

      {/* Create sheet (mobile) */}
      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Create new">
          <button type="button" aria-label="Close" onClick={() => setSheet(false)} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-pop">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hair" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Create new</h2>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SheetAction href="/gstbill" title="Invoice" sub="GST tax invoice" icon={<IconReceipt className="h-6 w-6" />} primary onPick={() => setSheet(false)} />
              <SheetAction href="/quotation" title="Quotation" sub="Pre-GST quote" icon={<IconFile className="h-6 w-6" />} onPick={() => setSheet(false)} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
        active ? "text-accent" : "text-faint"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function SheetAction({
  href, title, sub, icon, primary, onPick,
}: {
  href: string; title: string; sub: string; icon: ReactNode; primary?: boolean; onPick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className={`flex flex-col gap-2 rounded-2xl border p-4 transition-colors ${
        primary ? "border-accent/30 bg-accent-weak" : "border-hair bg-surface-2 hover:bg-surface"
      }`}
    >
      <span className={primary ? "text-accent" : "text-ink"}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
}
