"use client";

// Line-item name field (invoice "Description" / quotation "Product Name") with a
// product-catalog search dropdown. Behaves like a proper search box: suggestions
// appear only AFTER you type (never on focus), matching is debounced, and picking
// one imports that product's details into the line via onSelect.
//
// Unlike the customer autocomplete, a no-match does NOT get saved: the catalog is
// managed only on the Products page, so the typed text just stays as free-form
// line text. Edits the user then makes to the imported line are local to the
// document — the saved product is never touched.
//
// Matching runs entirely in memory against the catalog the parent loaded once —
// so typing costs ZERO API calls. It's a controlled input: the parent owns
// `value`, so it drops in where a plain name <input> was.
//
// Accessible combobox: role/aria-expanded/aria-activedescendant, full keyboard
// nav (↑/↓/Enter/Esc), click-outside to close, and the same entrance animation
// (.bm-combo-pop) as the customer autocomplete.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { rankProducts } from "@/lib/product";
import { formatINR } from "@/lib/gst";
import type { Product } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

const DEBOUNCE_MS = 200;

export default function ProductAutocomplete({
  label,
  value,
  products,
  onNameChange,
  onSelect,
  placeholder,
}: {
  label: string;
  value: string;
  products: Product[];
  onNameChange: (v: string) => void;
  onSelect: (p: Product) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  // A stable, non-semantic name so browsers/password managers don't pop their
  // own autofill over our suggestions.
  const fieldName = useMemo(() => `product_${baseId.replace(/[^a-zA-Z0-9]/g, "")}`, [baseId]);

  // Debounce the query behind the controlled value.
  useEffect(() => {
    const t = setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const matches = useMemo(
    () => (query.trim() ? rankProducts(products, query) : []),
    [products, query],
  );

  const activeIndex = active < matches.length ? active : -1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const typed = query.trim() !== "";
  const showList = open && typed && matches.length > 0;
  const showHint = open && typed && matches.length === 0;

  function choose(p: Product) {
    onSelect(p);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (!showList) return;
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      if (!showList) return;
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      if (showList && activeIndex >= 0 && matches[activeIndex]) {
        e.preventDefault();
        choose(matches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${baseId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined}
          name={fieldName}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore=""
          data-form-type="other"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onNameChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className={inputCls}
        />
      </label>

      {showList && (
        <ul
          id={`${baseId}-list`}
          role="listbox"
          style={{ WebkitOverflowScrolling: "touch" }}
          className="bm-combo-pop absolute inset-x-0 top-full z-30 mt-1 max-h-[min(16rem,45vh)] overflow-y-auto overscroll-contain rounded-xl border border-hair bg-surface py-1 shadow-pop"
        >
          {matches.map((p, i) => {
            const meta =
              [`₹ ${formatINR(p.rate)}`, p.hsnSac ? `HSN ${p.hsnSac}` : null, p.unit || null]
                .filter(Boolean)
                .join(" · ");
            return (
              <li
                key={p.id}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()} // keep input focus for click
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`cursor-pointer px-3 py-2 ${i === activeIndex ? "bg-accent-weak" : "hover:bg-surface-2"}`}
              >
                <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {showHint && (
        <div className="bm-combo-pop absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-hair bg-surface px-3 py-2 text-xs leading-snug text-faint shadow-pop">
          No saved product matches <span className="text-muted">“{value.trim()}”</span>. Add it from the Products page to reuse it later.
        </div>
      )}
    </div>
  );
}
