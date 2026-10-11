"use client";
import { useEffect, useRef, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Counts toward the target so big numbers roll instead of jumping. */
export function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [v, setV] = useState(value); const from = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { from.current = value; setV(value); return; }
    if (from.current === value) return;
    const start = performance.now(), a = from.current, d = 900; let raf = 0;
    const step = () => { const k = Math.max(0, Math.min(1, (performance.now() - start) / d)); const e = 1 - Math.pow(1 - k, 3); const x = a + (value - a) * e; setV(x); from.current = x; if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className="num">{(reduced ? value : v).toLocaleString("ja-JP", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>;
}

type PauseReason = "button" | "pointer" | "focus";
type TickerPlayback = { kind: "following" } | { kind: "paused"; reasons: readonly PauseReason[]; text: string };

export function CommentaryTicker({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [rendered, setRendered] = useState(text);
  const initial = useRef(text);
  const receivedUpdate = useRef(false);
  const [playback, setPlayback] = useState<TickerPlayback>({ kind: "following" });
  useEffect(() => {
    if (reduced || !receivedUpdate.current) setRendered(text);
    if (text !== initial.current) receivedUpdate.current = true;
  }, [text, reduced]);
  const paused = playback.kind === "paused";
  const visibleText = paused ? playback.text : rendered;
  const buttonPaused = paused && playback.reasons.includes("button");
  const changePause = (reason: PauseReason, active: boolean) => {
    if (!active) setRendered(text);
    setPlayback((previous) => {
      const reasons = previous.kind === "paused" ? previous.reasons.filter((item) => item !== reason) : [];
      if (active) reasons.push(reason);
      return reasons.length ? { kind: "paused", reasons, text: previous.kind === "paused" ? previous.text : rendered } : { kind: "following" };
    });
  };
  return <section className="bzk-ticker" aria-label="試合の実況" data-paused={paused}
    onPointerEnter={() => changePause("pointer", true)} onPointerLeave={() => changePause("pointer", false)}
    onFocusCapture={() => changePause("focus", true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) changePause("focus", false); }}>
    <span className="bzk-ticker-title">実況</span>
    <p className="bzk-sr-only">{visibleText}</p>
    <div className="bzk-ticker-window" aria-hidden="true"><div className="bzk-ticker-track" onAnimationIteration={() => { if (!paused) setRendered(text); }}><span>{visibleText}</span><span>{visibleText}</span></div></div>
    <button type="button" className="bzk-ticker-pause" aria-pressed={buttonPaused} aria-label={buttonPaused ? "実況を再開" : "実況を一時停止"} onClick={() => changePause("button", !buttonPaused)}>
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{buttonPaused ? <path d="m5 3 7 5-7 5Z" /> : <path d="M5 3v10M11 3v10" />}</svg>
    </button>
  </section>;
}
