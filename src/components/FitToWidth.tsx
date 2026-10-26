"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scales a fixed-width document (e.g. the 794px A4 invoice) down to fit its
 * container, so the whole page is visible on a phone with no horizontal scroll.
 * Never scales above 1 (full size on wide screens). Collapses its own height to
 * the scaled height so there is no empty space below.
 */
export default function FitToWidth({
  width = 794,
  className,
  children,
}: {
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const avail = outer.clientWidth;
      if (!avail) return;
      const next = Math.min(1, avail / width);
      setScale((p) => (Math.abs(p - next) > 0.001 ? next : p));
      const h = inner.offsetHeight * next;
      setHeight((p) => (p === undefined || Math.abs(p - h) > 0.5 ? h : p));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={outerRef}
      className={`fit-outer${className ? ` ${className}` : ""}`}
      style={{ height, maxWidth: "100%", overflow: "hidden" }}
    >
      <div
        ref={innerRef}
        className="fit-inner"
        style={{ width, transformOrigin: "top left", transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
