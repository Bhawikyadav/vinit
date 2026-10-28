// Pure date helpers for the private follow-up reminder. Dates are yyyy-mm-dd
// (date-only), parsed at local midnight so "days from today" stays calendar-
// correct regardless of the time of day. No I/O, no React.

function parse(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Add whole months and/or days to a yyyy-mm-dd. Month math clamps to the last
// valid day (31 Jan + 1 month → 28/29 Feb) rather than rolling into next month.
export function addToDate(iso: string, opts: { days?: number; months?: number }): string {
  const base = parse(iso) ?? new Date();
  let y = base.getFullYear();
  let mo = base.getMonth();
  let da = base.getDate();
  if (opts.months) {
    const total = mo + opts.months;
    y += Math.floor(total / 12);
    mo = ((total % 12) + 12) % 12;
    da = Math.min(da, daysInMonth(y, mo));
  }
  const d = new Date(y, mo, da);
  if (opts.days) d.setDate(d.getDate() + opts.days);
  return fmt(d);
}

// Whole calendar days from today (local) to `iso`. Negative = in the past.
export function daysUntil(iso: string, today: Date = new Date()): number {
  const target = parse(iso);
  if (!target) return 0;
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target.getTime() - a) / 86_400_000);
}

// "Today" / "Tomorrow" / "In 5 days" / "Yesterday" / "3 days overdue".
export function relativeDayLabel(iso: string, today: Date = new Date()): string {
  const n = daysUntil(iso, today);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1) return `In ${n} days`;
  return `${-n} days overdue`;
}

// "Thu, 12 Nov 2026" for the form summary and the dashboard panel.
export function formatFollowDate(iso: string): string {
  const d = parse(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

// Urgency tone for styling, most pressing first.
export type FollowUpUrgency = "overdue" | "today" | "soon" | "later";
export function followUpUrgency(iso: string, today: Date = new Date()): FollowUpUrgency {
  const n = daysUntil(iso, today);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 7) return "soon";
  return "later";
}
