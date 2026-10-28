"use client";

// Bulk upload drawer for the product catalog. Industry-grade flow:
//   1. Download a sample .xlsx (8 ready-made rows) so the format is unambiguous.
//   2. Drop or pick a .csv / .xlsx / .xls (size + row-count capped up front).
//   3. The file is parsed in the browser (SheetJS, dynamic-imported so it never
//      touches the initial bundle) and every row is validated BEFORE anything is
//      sent: headers are mapped tolerantly, each row is coerced, errors are shown
//      per row, duplicates within the file collapse to the last occurrence, and
//      rows whose name already exists are marked as updates.
//   4. Only the clean rows are sent to /api/products/bulk, which re-validates and
//      upserts them. Nothing is imported until the user confirms the preview.

import { useEffect, useMemo, useRef, useState } from "react";
import Button, { buttonStyles } from "@/components/ui/Button";
import { IconUpload, IconClose, IconFile } from "@/components/dashboard/icons";
import { normalizeProductName, blankProduct } from "@/lib/product";
import { bulkSaveProducts } from "@/lib/productStorage";
import { formatINR } from "@/lib/gst";
import {
  ACCEPTED_EXTENSIONS,
  MAX_BULK_ROWS,
  MAX_UPLOAD_BYTES,
  TEMPLATE_COLUMNS,
  SAMPLE_ROWS,
  headerToField,
  remapRow,
  coerceRow,
  type FieldKey,
  type RowOutcome,
} from "@/lib/productImport";
import type { Product } from "@/lib/types";

interface ParsedRow {
  index: number; // 1-based data row (header excluded)
  m: Partial<Record<FieldKey, unknown>>;
  outcome: RowOutcome;
}

type RowStatus = "new" | "update" | "duplicate" | "error";

const MB = (n: number) => (n / 1024 / 1024).toFixed(n >= 1024 * 1024 ? 1 : 2);

export default function ProductBulkUpload({
  existing,
  onClose,
  onImported,
}: {
  existing: Product[];
  onClose: () => void;
  onImported: (summary: { saved: number; skipped: number }) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "preview" | "importing">("idle");
  const [fileName, setFileName] = useState("");
  const [fileErr, setFileErr] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const existingByName = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of existing) map.set(normalizeProductName(p.name), p);
    return map;
  }, [existing]);

  // Resolve the parsed rows into import candidates: valid rows become new or
  // update products; later duplicates of a name win; error rows are excluded.
  const analysis = useMemo(() => {
    const valid = rows.filter((r) => r.outcome.fields);
    const errorCount = rows.filter((r) => r.outcome.errors.length > 0).length;

    const lastIndexByName = new Map<string, number>();
    for (const r of valid) lastIndexByName.set(normalizeProductName(r.outcome.fields!.name), r.index);

    const status = new Map<number, RowStatus>();
    const toImport: Product[] = [];
    let newCount = 0;
    let updateCount = 0;
    let dupCount = 0;

    for (const r of rows) {
      if (r.outcome.errors.length) {
        status.set(r.index, "error");
        continue;
      }
      const f = r.outcome.fields!;
      const key = normalizeProductName(f.name);
      if (lastIndexByName.get(key) !== r.index) {
        status.set(r.index, "duplicate");
        dupCount += 1;
        continue; // superseded by a later row with the same name
      }
      const match = existingByName.get(key);
      if (match) {
        status.set(r.index, "update");
        updateCount += 1;
        toImport.push({ ...match, ...f, id: match.id, createdAt: match.createdAt, updatedAt: new Date().toISOString() });
      } else {
        status.set(r.index, "new");
        newCount += 1;
        toImport.push({ ...blankProduct(), ...f });
      }
    }
    return { toImport, status, newCount, updateCount, dupCount, errorCount };
  }, [rows, existingByName]);

  function reset() {
    setRows([]);
    setFileName("");
    setFileErr("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileErr("");
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setFileErr(`Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileErr(`File is too large (${MB(file.size)} MB). The limit is ${MB(MAX_UPLOAD_BYTES)} MB.`);
      return;
    }
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      if (!wb.SheetNames.length) {
        setFileErr("The file has no sheets.");
        return;
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      if (raw.length === 0) {
        setFileErr("No data rows found. The first row should be the column headers.");
        return;
      }
      if (raw.length > MAX_BULK_ROWS) {
        setFileErr(`Too many rows (${raw.length}). The limit is ${MAX_BULK_ROWS} per upload.`);
        return;
      }
      const mappedHeaders = Object.keys(raw[0]).map(headerToField);
      if (!mappedHeaders.includes("name")) {
        setFileErr('Couldn’t find a "Name" column. Download the sample to see the expected columns.');
        return;
      }
      const parsed = raw
        .map((r, i) => {
          const m = remapRow(r);
          return { index: i + 1, m, outcome: coerceRow(m) } as ParsedRow;
        })
        .filter((r) => !r.outcome.blank);
      if (parsed.length === 0) {
        setFileErr("Every row was empty.");
        return;
      }
      setRows(parsed);
      setPhase("preview");
    } catch (e) {
      setFileErr("Could not read the file: " + (e as Error).message);
    }
  }

  async function downloadSample() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: [...TEMPLATE_COLUMNS] as string[] });
    ws["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "vm-products-sample.xlsx");
  }

  async function doImport() {
    if (analysis.toImport.length === 0) return;
    setPhase("importing");
    setFileErr("");
    try {
      const summary = await bulkSaveProducts(analysis.toImport);
      onImported(summary);
    } catch (e) {
      setFileErr((e as Error).message);
      setPhase("preview");
    }
  }

  const importing = phase === "importing";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title">
      <button type="button" aria-label="Close" onClick={onClose} className="bm-drawer-backdrop absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="bm-drawer-pop relative z-10 flex h-full w-full max-w-2xl flex-col bg-surface shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hair p-5">
          <div>
            <h2 id="bulk-upload-title" className="text-base font-semibold text-ink">Bulk upload products</h2>
            <p className="text-xs text-muted">Import a CSV or Excel file — validated before anything is saved.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {phase === "idle" || phase === "importing" ? (
            <div className="space-y-4">
              {/* Step 1 — sample */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-hair bg-surface-2/50 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink">1 · Start from the sample</p>
                  <p className="mt-0.5 text-xs text-muted">
                    A ready-made Excel file with 8 example products and the exact columns.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={downloadSample}>
                  <IconFile className="h-[18px] w-[18px]" /> Sample .xlsx
                </Button>
              </div>

              {/* Step 2 — dropzone */}
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">2 · Upload your file</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragOver ? "border-accent bg-accent-weak" : "border-hair bg-surface hover:bg-surface-2"
                  }`}
                >
                  <IconUpload className="h-7 w-7 text-muted" />
                  <span className="text-sm font-medium text-ink">
                    {fileName && !fileErr ? fileName : "Drag & drop, or click to browse"}
                  </span>
                  <span className="text-xs text-faint">
                    CSV or Excel · up to {MAX_BULK_ROWS} rows · max {MB(MAX_UPLOAD_BYTES)} MB
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <p className="mt-2 text-xs text-faint">
                  Columns: <span className="text-muted">Name</span> (required), HSN/SAC, Unit, Rate, GST%. Extra columns are ignored.
                </p>
              </div>

              {fileErr ? (
                <p className="rounded-lg bg-neg-weak px-3 py-2 text-sm text-neg">{fileErr}</p>
              ) : null}
            </div>
          ) : (
            // Preview
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-accent-weak px-2.5 py-1 font-medium text-accent">
                  {analysis.toImport.length} ready ({analysis.newCount} new · {analysis.updateCount} update)
                </span>
                {analysis.errorCount > 0 ? (
                  <span className="rounded-full bg-neg-weak px-2.5 py-1 font-medium text-neg">{analysis.errorCount} with errors (skipped)</span>
                ) : null}
                {analysis.dupCount > 0 ? (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-faint">{analysis.dupCount} duplicate (skipped)</span>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-hair">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                    <tr>
                      <th className="p-2 font-semibold">#</th>
                      <th className="p-2 font-semibold">Name</th>
                      <th className="p-2 text-right font-semibold">Rate</th>
                      <th className="p-2 text-right font-semibold">GST</th>
                      <th className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const st = analysis.status.get(r.index) ?? "error";
                      const name = r.outcome.fields?.name || (r.m.name != null ? String(r.m.name).trim() : "") || "(no name)";
                      const rate = r.outcome.fields ? `₹ ${formatINR(r.outcome.fields.rate)}` : (r.m.rate != null ? String(r.m.rate) : "");
                      const gst = r.outcome.fields ? `${r.outcome.fields.gstRate}%` : (r.m.gstRate != null ? String(r.m.gstRate) : "");
                      const issues =
                        st === "error"
                          ? r.outcome.errors.join(", ")
                          : st === "duplicate"
                          ? "Duplicate name in file — the later row is used"
                          : "";
                      return (
                        <tr key={r.index} className="border-t border-hair align-top">
                          <td className="p-2 text-faint tabular-nums">{r.index}</td>
                          <td className="p-2">
                            <span className={st === "error" ? "text-muted" : "text-ink"}>{name}</span>
                            {issues ? <p className="text-xs text-neg">{issues}</p> : null}
                          </td>
                          <td className="p-2 text-right tabular-nums text-muted">{rate}</td>
                          <td className="p-2 text-right tabular-nums text-muted">{gst}</td>
                          <td className="p-2">
                            <StatusBadge status={st} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {fileErr ? <p className="rounded-lg bg-neg-weak px-3 py-2 text-sm text-neg">{fileErr}</p> : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-hair p-5">
          {phase === "preview" ? (
            <button type="button" onClick={reset} disabled={importing} className={buttonStyles("secondary", "md")}>
              Choose another file
            </button>
          ) : (
            <span className="text-xs text-faint">{fileName && !fileErr ? fileName : ""}</span>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={importing} className={buttonStyles("secondary", "md")}>
              Cancel
            </button>
            {phase === "preview" ? (
              <Button variant="primary" onClick={doImport} disabled={importing || analysis.toImport.length === 0}>
                {importing ? "Importing…" : `Import ${analysis.toImport.length} product${analysis.toImport.length === 1 ? "" : "s"}`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-accent-weak text-accent" },
    update: { label: "Update", cls: "bg-surface-2 text-ink ring-1 ring-hair" },
    duplicate: { label: "Duplicate", cls: "bg-surface-2 text-faint" },
    error: { label: "Error", cls: "bg-neg-weak text-neg" },
  };
  const { label, cls } = map[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}
