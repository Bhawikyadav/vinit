"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/controls";
import { IconPlus } from "@/components/dashboard/icons";
import { computeQuote, formatAmount } from "@/lib/quote";
import { getAllQuotes, saveQuote, deleteQuote } from "@/lib/quoteStorage";
import { getProfile } from "@/lib/storage";
import DuplicateTemplateDialog from "@/components/DuplicateTemplateDialog";
import type { Quote } from "@/lib/types";

export default function QuoteHistoryPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dupTarget, setDupTarget] = useState<Quote | null>(null);
  const router = useRouter();

  // Open a quotation in the editor. Used by both the "Open" action and the
  // whole-card / whole-row click (so the entire card is a hit target).
  const open = (id: string) => router.push(`/quotation?id=${id}`);
  const openOnKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(id);
    }
  };
  // Action buttons sit inside the clickable card/row — keep their clicks from
  // also opening the quotation.
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  async function reload() {
    setLoading(true);
    setQuotes(await getAllQuotes());
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await getAllQuotes();
      if (active) {
        setQuotes(data);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter((x) =>
      [x.quoteNo, x.buyerName, x.quoteDate, x.subject].join(" ").toLowerCase().includes(term),
    );
  }, [quotes, q]);

  // `useCurrentTemplate` true → the copy adopts the current default quotation
  // template & accent from the company profile; false → it keeps the snapshot it
  // was made in. The original is cloned either way; only the template differs.
  async function duplicate(x: Quote, useCurrentTemplate: boolean) {
    const now = new Date();
    const copy: Quote = {
      ...structuredClone(x),
      id: crypto.randomUUID(),
      quoteNo: x.quoteNo + "-COPY",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (useCurrentTemplate) {
      const profile = await getProfile();
      copy.template = profile.quoteTemplate;
      copy.accentColor = profile.accentColor;
    }
    await saveQuote(copy);
    setDupTarget(null);
    setStatus(`Duplicated ${x.quoteNo}`);
    reload();
  }

  async function remove(x: Quote) {
    if (!confirm(`Delete quotation ${x.quoteNo}? This cannot be undone.`)) return;
    await deleteQuote(x.id);
    setStatus(`Deleted ${x.quoteNo}`);
    reload();
  }

  async function downloadPdf(x: Quote) {
    const profile = await getProfile();
    const { generateQuotePdfBlob } = await import("@/lib/pdf/quotePdf");
    const blob = await generateQuotePdfBlob(x, computeQuote(x), profile);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${x.quoteNo.replace(/[\/\\]/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const chip = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle={loading ? "Loading…" : `${quotes.length} quotation${quotes.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/quotation" className={buttonStyles("primary", "sm", "hidden sm:inline-flex")}>
            <IconPlus className="h-[18px] w-[18px]" /> New quotation
          </Link>
        }
      />

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by quotation no, client, or subject…"
          className="sm:max-w-md"
          aria-label="Search quotations"
        />
      </div>

      {status && <p className="mb-3 text-sm text-muted">{status}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-surface p-10 text-center text-muted">
          {quotes.length === 0 ? (
            <>
              No quotations yet.{" "}
              <Link href="/quotation" className="font-medium text-accent hover:underline">
                Create your first quotation
              </Link>
              .
            </>
          ) : (
            "No quotations match your search."
          )}
        </div>
      ) : (
        <>
          {/* Mobile: one card per quotation */}
          <div className="space-y-3 md:hidden">
            {filtered.map((x) => {
              const t = computeQuote(x);
              return (
                <div
                  key={x.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(x.id)}
                  onKeyDown={openOnKey(x.id)}
                  aria-label={`Open quotation ${x.quoteNo}`}
                  className="cursor-pointer rounded-2xl border border-hair bg-surface p-4 shadow-card transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{x.quoteNo}</p>
                      <p className="truncate text-sm text-muted">{x.buyerName || "—"}</p>
                    </div>
                    <p className="shrink-0 text-right font-semibold tabular-nums text-ink">₹ {formatAmount(t.total)}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-faint">
                    {x.quoteDate ? new Date(x.quoteDate).toLocaleDateString("en-GB") : "—"}
                    {x.subject ? ` · ${x.subject}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
                    <Link href={`/quotation?id=${x.id}`} onClick={(e) => e.stopPropagation()} className={`${chip} bg-accent-weak text-accent`}>
                      Open
                    </Link>
                    <button className={`${chip} bg-surface-2 text-muted hover:text-ink`} onClick={stop(() => downloadPdf(x))}>
                      PDF
                    </button>
                    <button className={`${chip} bg-surface-2 text-muted hover:text-ink`} onClick={stop(() => setDupTarget(x))}>
                      Duplicate
                    </button>
                    <button className={`${chip} ml-auto text-neg hover:bg-neg-weak`} onClick={stop(() => remove(x))}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-hair bg-surface shadow-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="p-3 font-semibold">Quotation No.</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Client</th>
                  <th className="p-3 text-right font-semibold">Total (pre-GST)</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => {
                  const t = computeQuote(x);
                  return (
                    <tr
                      key={x.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => open(x.id)}
                      onKeyDown={openOnKey(x.id)}
                      aria-label={`Open quotation ${x.quoteNo}`}
                      className="cursor-pointer border-t border-hair text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                    >
                      <td className="p-3 font-medium">{x.quoteNo}</td>
                      <td className="p-3 text-muted">{x.quoteDate ? new Date(x.quoteDate).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="p-3">{x.buyerName || "—"}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">₹ {formatAmount(t.total)}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-3 text-xs font-medium">
                          <Link href={`/quotation?id=${x.id}`} onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">Open</Link>
                          <button className="text-muted hover:text-ink hover:underline" onClick={stop(() => downloadPdf(x))}>PDF</button>
                          <button className="text-muted hover:text-ink hover:underline" onClick={stop(() => setDupTarget(x))}>Duplicate</button>
                          <button className="text-neg hover:underline" onClick={stop(() => remove(x))}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dupTarget && (
        <DuplicateTemplateDialog
          docLabel={`quotation ${dupTarget.quoteNo}`}
          onUseCurrent={() => duplicate(dupTarget, true)}
          onKeepOriginal={() => duplicate(dupTarget, false)}
          onCancel={() => setDupTarget(null)}
        />
      )}
    </>
  );
}
