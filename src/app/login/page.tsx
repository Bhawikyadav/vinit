"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell, { AuthError, authField, authLabel, authPrimaryBtn } from "@/components/auth/AuthShell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only allow redirecting back to an internal path (block //evil.com etc.).
  const rawFrom = params.get("from") || "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={authLabel}>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          required
          placeholder="you@company.com"
          className={authField}
        />
      </label>

      <label className="block">
        <span className={authLabel}>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={authField}
        />
      </label>

      {error && <AuthError>{error}</AuthError>}

      <button type="submit" disabled={busy} className={authPrimaryBtn}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

// Keeps the card from collapsing while useSearchParams resolves.
function FormFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-[66px] rounded-xl bg-surface-2" />
      <div className="h-[66px] rounded-xl bg-surface-2" />
      <div className="h-11 rounded-xl bg-surface-2" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      heading="Sign in"
      sub="Welcome back — enter your details to continue."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
