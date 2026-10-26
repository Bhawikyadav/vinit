"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { computeQuote, formatAmount } from "@/lib/quote";
import { getAllQuotes, saveQuote, deleteQuote } from "@/lib/quoteStorage";
import { getProfile, isCloud } from "@/lib/storage";
import type { Quote } from "@/lib/types";

export default function QuoteHistoryPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

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

  async function duplicate(x: Quote) {
    const now = new Date();
    const copy: Quote = {
      ...structuredClone(x),
      id: crypto.randomUUID(),
      quoteNo: x.quoteNo + "-COPY",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await saveQuote(copy);
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

  const btn = "rounded px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <div className="min-h-screen p-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-gray-800">All Quotations</h1>
        <span className="text-xs text-gray-500">
          {isCloud() ? "☁ Cloud sync on" : "💾 This device only"}
        </span>
        <Link href="/quotation" className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
          + New Quotation
        </Link>
        <Link href="/" className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
          Home
        </Link>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by quotation no, client, or date…"
        className="mb-4 w-full max-w-md rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      />

      {status && <p className="mb-3 text-sm text-gray-700">{status}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {quotes.length === 0 ? (
            <>
              No quotations yet.{" "}
              <Link href="/quotation" className="font-medium text-blue-600 hover:underline">
                Create your first quotation
              </Link>
              .
            </>
          ) : (
            "No quotations match your search."
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Quotation No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Client</th>
                <th className="p-3 text-right">Total (pre-GST)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => {
                const t = computeQuote(x);
                return (
                  <tr key={x.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium">{x.quoteNo}</td>
                    <td className="p-3">{x.quoteDate ? new Date(x.quoteDate).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="p-3">{x.buyerName || "—"}</td>
                    <td className="p-3 text-right font-semibold">₹ {formatAmount(t.total)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2 text-xs">
                        <Link href={`/quotation?id=${x.id}`} className="font-medium text-blue-600 hover:underline">
                          Open
                        </Link>
                        <button className="font-medium text-gray-600 hover:underline" onClick={() => downloadPdf(x)}>
                          PDF
                        </button>
                        <button className="font-medium text-gray-600 hover:underline" onClick={() => duplicate(x)}>
                          Duplicate
                        </button>
                        <button className="font-medium text-red-600 hover:underline" onClick={() => remove(x)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        {COMPANY.name} · {quotes.length} quotation(s) stored
      </p>
    </div>
  );
}
