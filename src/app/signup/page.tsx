"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell, { AuthError, authField, authLabel, authPrimaryBtn } from "@/components/auth/AuthShell";
import { STATES } from "@/lib/states";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, stateCode, name, email, password, code }),
      });
      if (res.ok) {
        // New company — send them straight to Settings to finish their profile.
        router.push("/gstbill/settings");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not create your account.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      heading="Create your company"
      sub="Set up a new, private billing space in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={authLabel}>Company name</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoFocus
            required
            placeholder="e.g. Acme Traders"
            className={authField}
          />
        </label>

        <label className="block">
          <span className={authLabel}>State</span>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            required
            className={authField}
          >
            <option value="" disabled>
              Select your state…
            </option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-faint">
            Decides CGST + SGST vs IGST on your invoices.
          </span>
        </label>

        <label className="block">
          <span className={authLabel}>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className={authField}
          />
        </label>

        <label className="block">
          <span className={authLabel}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className={authField}
          />
        </label>

        <label className="block">
          <span className={authLabel}>Invite code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Ask the owner for the code"
            className={authField}
          />
        </label>

        {error && <AuthError>{error}</AuthError>}

        <button type="submit" disabled={busy} className={authPrimaryBtn}>
          {busy ? "Creating…" : "Create company"}
        </button>
      </form>
    </AuthShell>
  );
}
