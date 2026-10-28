"use client";

// Asked when duplicating an invoice or quotation: should the copy keep the
// template it was originally made in (its saved snapshot), or switch to the
// current default template & accent from Company settings? Both history pages
// share this dialog.

import { useEffect } from "react";
import Button from "@/components/ui/Button";

export default function DuplicateTemplateDialog({
  docLabel,
  onUseCurrent,
  onKeepOriginal,
  onCancel,
}: {
  docLabel: string; // e.g. "invoice VM/2026-27/001"
  onUseCurrent: () => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
}) {
  // Escape closes the dialog without duplicating.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose the template for the copy"
    >
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-pop">
        <h2 className="text-base font-semibold text-ink">Duplicate {docLabel}</h2>
        <p className="mt-1 text-sm text-muted">Which template should the copy use?</p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onUseCurrent}
            className="w-full rounded-xl border border-accent/30 bg-accent-weak p-3 text-left transition-colors hover:brightness-105"
          >
            <span className="block text-sm font-semibold text-accent">Current template settings</span>
            <span className="block text-xs text-muted">Apply your default template &amp; accent colour from Company settings.</span>
          </button>
          <button
            type="button"
            onClick={onKeepOriginal}
            className="w-full rounded-xl border border-hair bg-surface-2 p-3 text-left transition-colors hover:bg-surface"
          >
            <span className="block text-sm font-semibold text-ink">Original template</span>
            <span className="block text-xs text-muted">Keep the template this document was made in.</span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
