"use client";

// Small signed-in banner for the home dashboard: shows the current account and
// a Log out button. Fetches /api/me on mount; renders nothing until it knows
// who is signed in, so it never flashes the wrong name.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UserBar() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setMe(d as { name: string; email: string });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <span className="min-w-0 truncate text-gray-600">
        {me ? (
          <>
            Signed in as{" "}
            <span className="font-medium text-gray-900">{me.name || me.email}</span>
          </>
        ) : (
          " "
        )}
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="shrink-0 rounded border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50"
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
