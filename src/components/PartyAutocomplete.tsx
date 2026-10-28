"use client";

// Name field with a customer-directory search dropdown. It behaves like a proper
// search box: suggestions appear only AFTER you type (never on focus), matching
// is debounced, and if nothing matches the name is simply kept as a new customer
// (captured when the invoice is saved). Picking a suggestion fills the whole
// party (name, address, GSTIN, state) via onSelect.
//
// Matching runs entirely in memory against the directory the parent already
// loaded once — so typing costs ZERO API calls (the debounce just keeps the
// filtering from re-running on every keystroke). It's a controlled input: the
// parent owns `value`, so it drops in where a plain name <input> was.
//
// Accessible combobox: role/aria-expanded/aria-activedescendant, full keyboard
// nav (↑/↓/Enter/Esc), click-outside to close, touch-scrollable list, and an
// entrance gated behind prefers-reduced-motion (see .bm-combo-pop in globals.css).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizeGstin, rankCustomers } from "@/lib/customer";
import { stateName } from "@/lib/states";
import type { Customer } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-hair bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

const DEBOUNCE_MS = 200;

export default function PartyAutocomplete({
  label,
  value,
  customers,
  onNameChange,
  onSelect,
  placeholder,
}: {
  label: string;
  value: string;
  customers: Customer[];
  onNameChange: (v: string) => void;
  onSelect: (c: Customer) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The query that actually drives filtering, updated a short beat after the last
  // keystroke so the list isn't recomputed on every character.
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  // A stable, non-semantic name so Chrome/password managers don't classify this
  // as a real "name" field and pop their own autofill over our suggestions.
  const fieldName = useMemo(() => `party_${baseId.replace(/[^a-zA-Z0-9]/g, "")}`, [baseId]);

  // Debounce the query behind the controlled value.
  useEffect(() => {
    const t = setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const matches = useMemo(
    () => (query.trim() ? rankCustomers(customers, query) : []),
    [customers, query],
  );

  // The highlighted row, clamped to the current list (−1 = nothing highlighted).
  const activeIndex = active < matches.length ? active : -1;

  // Close when the pointer goes down anywhere outside the field + dropdown.
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

  function choose(c: Customer) {
    onSelect(c);
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
          {matches.map((c, i) => {
            const meta =
              [normalizeGstin(c.gstin) || null, stateName(c.stateCode) || null]
                .filter(Boolean)
                .join(" · ") || c.address;
            return (
              <li
                key={c.id}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()} // keep input focus for click
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
                className={`cursor-pointer px-3 py-2 ${i === activeIndex ? "bg-accent-weak" : "hover:bg-surface-2"}`}
              >
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      {showHint && (
        <div className="bm-combo-pop absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-hair bg-surface px-3 py-2 text-xs leading-snug text-faint shadow-pop">
          No match — <span className="text-muted">“{value.trim()}”</span> will be saved as a new customer when you save the invoice.
        </div>
      )}
    </div>
  );
}
