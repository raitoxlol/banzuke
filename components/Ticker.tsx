"use client";
import { useEffect, useRef, useState } from "react";
/** Counts toward the target so big numbers roll instead of jumping. */
export function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [v, setV] = useState(value); const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, d = 900; let raf = 0;
    const step = () => { const k = Math.max(0, Math.min(1, (performance.now() - start) / d)); const e = 1 - Math.pow(1 - k, 3); const x = a + (value - a) * e; setV(x); from.current = x; if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num">{v.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>;
}
