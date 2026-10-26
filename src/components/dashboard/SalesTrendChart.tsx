"use client";

// Sales trend — invoiced ₹ over the selected period, drawn as a modern combo:
// soft "volume" bars behind (recessive, same values, same scale) and a smooth
// monotone-cubic trend line in front with a blue→green gradient (green = the
// up/positive end; never the brand red, which reads as alarm). Magnitude is read
// off the bars + hover tooltip rather than a gridded axis, so the widget stays
// clean. Single series → no legend. Inline SVG, no library.

import { useEffect, useId, useRef, useState } from "react";
import { inr, inrCompact, type TrendPoint } from "@/lib/stats";

const BLUE: [number, number, number] = [42, 120, 214]; // #2a78d6
const GREEN: [number, number, number] = [16, 185, 129]; // #10b981
const H = 240;
const PAD = { top: 28, right: 18, bottom: 26, left: 14 };

// Blue→green blend for the point/dot at position t∈[0,1], matching the line's
// horizontal gradient so a hovered dot picks up the line's local colour.
function mix(t: number): string {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const l = (a: number, b: number) => Math.round(a + (b - a) * c);
  return `rgb(${l(BLUE[0], GREEN[0])},${l(BLUE[1], GREEN[1])},${l(BLUE[2], GREEN[2])})`;
}

// Monotone cubic (Fritsch–Carlson): a smooth curve that never overshoots, so a
// spike or a flat run can't bow the line below zero or invent a dip.
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const p = (q: { x: number; y: number }) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  if (n === 1) return `M${p(pts[0])}`;
  if (n === 2) return `M${p(pts[0])} L${p(pts[1])}`;

  const dx: number[] = [];
  const s: number[] = []; // secant slopes
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    s[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const m: number[] = [s[0]];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  m[n - 1] = s[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i];
    const b = m[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s[i];
      m[i + 1] = t * b * s[i];
    }
  }
  let d = `M${p(pts[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const c1 = { x: pts[i].x + dx[i] / 3, y: pts[i].y + (m[i] * dx[i]) / 3 };
    const c2 = { x: pts[i + 1].x - dx[i] / 3, y: pts[i + 1].y - (m[i + 1] * dx[i]) / 3 };
    d += ` C${p(c1)}, ${p(c2)}, ${p(pts[i + 1])}`;
  }
  return d;
}

export default function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const total = data.reduce((acc, d) => acc + d.value, 0);
  const max = Math.max(...data.map((d) => d.value), 0);

  if (total === 0) {
    return (
      <div ref={wrapRef} className="flex h-[240px] flex-col items-center justify-center rounded-xl bg-surface-2 text-center">
        <p className="text-sm font-medium text-muted">No invoiced sales in this period</p>
        <p className="mt-1 text-xs text-faint">Create an invoice and it shows up here.</p>
      </div>
    );
  }

  const innerW = Math.max(0, w - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.length;
  const yMax = max > 0 ? max * 1.2 : 1;
  const baseY = PAD.top + innerH;
  const bw = n > 0 ? innerW / n : innerW; // band width per bucket
  const barW = Math.max(3, Math.min(bw * 0.6, 22));
  const cx = (i: number) => PAD.left + bw * (i + 0.5); // band centre
  const y = (v: number) => baseY - (v / yMax) * innerH;
  const barRx = Math.min(barW / 2, 4);

  const pts = data.map((d, i) => ({ x: cx(i), y: y(d.value) }));
  const line = smoothPath(pts);

  // Thin x-labels (fewer on narrow screens), always keep the last, and drop a
  // tick that would sit too close to it so labels never collide.
  const target = w < 420 ? 4 : 6;
  const step = Math.max(1, Math.ceil(n / target));
  const idxs: number[] = [];
  for (let i = 0; i < n; i += step) idxs.push(i);
  if (idxs[idxs.length - 1] !== n - 1) {
    if (n - 1 - idxs[idxs.length - 1] < step * 0.6) idxs.pop();
    idxs.push(n - 1);
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!w) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.floor((px - PAD.left) / (bw || 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const last = n - 1;
  const tAt = (i: number) => (n <= 1 ? 1 : i / (n - 1));
  // Stable per-instance gradient id (strip the colons React's useId adds so the
  // SVG url(#id) reference always parses).
  const gradId = `trend-grad-${uid.replace(/:/g, "")}`;
  // Changing this key remounts the reveal group so the draw-in replays whenever
  // the underlying data changes (e.g. a new period) — but not on resize or hover.
  const animKey = `${n}:${Math.round(total)}:${Math.round(max)}`;

  // End label floats just above the final point, clamped inside the plot.
  const endX = Math.min(Math.max(cx(last), PAD.left + 26), w - PAD.right - 26);
  const endY = Math.max(PAD.top + 2, y(data[last].value) - 12);

  return (
    <div ref={wrapRef} className="relative w-full" role="img" aria-label={`Sales trend. Total ${inr(total)} across ${n} points, peak ${inr(max)}.`}>
      {w > 0 && (
        <svg width={w} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="trend-svg block touch-none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2a78d6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* baseline — a single recessive hairline the bars sit on */}
          <line x1={PAD.left} x2={w - PAD.right} y1={baseY} y2={baseY} stroke="var(--color-hair)" strokeWidth="1" />

          {/* Animated reveal — bars grow up, the line draws left→right, then the
              latest point pops and pings. The key replays it when data changes. */}
          <g key={animKey}>
            {data.map((d, i) => {
              const h = (d.value / yMax) * innerH;
              if (h <= 0.5) return null;
              const active = hover === i;
              return (
                <rect
                  key={i}
                  className="trend-bar"
                  x={cx(i) - barW / 2}
                  y={baseY - h}
                  width={barW}
                  height={h}
                  rx={barRx}
                  fill={active ? "color-mix(in srgb, #2a78d6 30%, transparent)" : "color-mix(in srgb, #2a78d6 13%, transparent)"}
                  style={{ animationDelay: `${Math.min(i * 20, 360)}ms` }}
                />
              );
            })}

            {n > 1 && (
              <path className="trend-line" d={line} pathLength={1} fill="none" stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
            <circle className="trend-ping" cx={cx(last)} cy={y(data[last].value)} r="5" fill={mix(1)} />
            <circle className="trend-dot" cx={cx(last)} cy={y(data[last].value)} r="4" fill={mix(1)} stroke="var(--color-surface)" strokeWidth="2" />
            <text
              className="trend-label fill-ink"
              x={endX}
              y={endY}
              textAnchor="middle"
              paintOrder="stroke"
              stroke="var(--color-surface)"
              strokeWidth="3"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {inrCompact(data[last].value)}
            </text>
          </g>

          {/* x labels */}
          {idxs.map((i) => (
            <text key={i} x={cx(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-faint" style={{ fontSize: 11 }}>
              {data[i].label}
            </text>
          ))}

          {/* hover crosshair */}
          {hover !== null && (
            <g>
              <line x1={cx(hover)} x2={cx(hover)} y1={PAD.top} y2={baseY} stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={cx(hover)} cy={y(data[hover].value)} r="5" fill={mix(tAt(hover))} stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}

      {/* tooltip */}
      {hover !== null && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-hair bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: Math.min(Math.max(cx(hover), 60), w - 60), top: Math.max(0, y(data[hover].value) - 56) }}
        >
          <div className="whitespace-nowrap text-xs font-medium text-faint">{data[hover].label}</div>
          <div className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink">{inr(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
}
