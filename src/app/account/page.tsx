"use client";

// The account page — a normal page inside the app shell (same rail + content
// frame as Invoices/Company), NOT a popup or drawer. Shows the signed-in user's
// name and email (editable, saved directly) and a password change, with Log out
// as the last action. Talks to /api/account; scoped entirely to the session
// owner, so a user can only ever change their own account.
//
// On a successful save it fires a `bm:account-updated` window event so the
// shell's rail chip can refresh the displayed name without a reload.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/controls";
import { IconLogout } from "@/components/dashboard/icons";

export default function AccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Load the current account once.
  useEffect(() => {
    let alive = true;
    fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d) {
          setName(d.name || "");
          setEmail(d.email || "");
        }
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const changingPassword = Boolean(newPassword || confirm || currentPassword);
    if (changingPassword) {
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirm) {
        setError("The new passwords do not match.");
        return;
      }
      if (!currentPassword) {
        setError("Enter your current password to set a new one.");
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        email?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not save your changes.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSaved(true);
      // Keep the shell's rail chip in sync with the new name/email.
      window.dispatchEvent(
        new CustomEvent("bm:account-updated", {
          detail: { name: data.name || name, email: data.email || email },
        }),
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Your account"
        subtitle="Name, email & password"
        actions={
          <Button type="submit" form="account-form" variant="primary" size="sm" disabled={busy || !loaded}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <form id="account-form" onSubmit={save} className="mx-auto max-w-2xl space-y-6">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-neg-weak px-3.5 py-3 text-sm text-neg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </p>
        )}
        {saved && !error && (
          <p className="flex items-start gap-2 rounded-xl bg-pos-weak px-3.5 py-3 text-sm text-pos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
              <path d="M4 12.5 9.5 18 20 6.5" />
            </svg>
            <span>Changes saved.</span>
          </p>
        )}

        <section className="space-y-4 rounded-2xl border border-hair bg-surface p-5 shadow-card">
          <h2 className="font-semibold text-ink">Profile</h2>
          <Field label="Name" htmlFor="acct-name">
            <Input id="acct-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={!loaded} autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="acct-email">
            <Input id="acct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!loaded} autoComplete="email" />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-hair bg-surface p-5 shadow-card">
          <div>
            <h2 className="font-semibold text-ink">Password</h2>
            <p className="mt-0.5 text-xs text-faint">Leave these blank to keep your current password.</p>
          </div>
          <Field label="Current password" htmlFor="acct-current">
            <Input id="acct-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={!loaded} autoComplete="current-password" placeholder="••••••••" />
          </Field>
          <Field label="New password" htmlFor="acct-new" hint="At least 8 characters">
            <Input id="acct-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={!loaded} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
          </Field>
          <Field label="Confirm new password" htmlFor="acct-confirm">
            <Input id="acct-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!loaded} autoComplete="new-password" placeholder="Re-enter new password" />
          </Field>
        </section>

        {/* Log out — the last action, reachable on both desktop and mobile. */}
        <section className="flex justify-center pt-1">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-hair bg-surface px-4 py-2.5 text-sm font-medium text-neg transition-colors hover:bg-neg-weak disabled:opacity-60"
          >
            <IconLogout className="h-[18px] w-[18px]" />
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </section>
      </form>
    </>
  );
}
