"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Count, useReducedMotion } from "@/components/Ticker";
import type { Side, Sides } from "@/lib/sides";

export function TugBar({ s, variant = "standalone" }: { s: Sides; variant?: "standalone" | "broadcast" }) {
  const total = s.claude + s.codex;
  const marker = total ? s.codex / total * 100 : 50;
  const leader: Side | null = s.claude === s.codex ? null : s.claude > s.codex ? "claude" : "codex";
  const difference = Math.abs(s.claude - s.codex);
  const reduced = useReducedMotion();
  const [flash, setFlash] = useState<Side | null>(null);
  const [flip, setFlip] = useState(false);
  const lastId = useRef(s.last?.id);
  const lastLeader = useRef(leader);

  useEffect(() => {
    const changed = s.last && s.last.id !== lastId.current;
    lastId.current = s.last?.id;
    if (reduced || !changed) { setFlash(null); return; }
    setFlash(s.last?.side ?? null);
    const timer = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [s.last, reduced]);

  useEffect(() => {
    const changed = leader && lastLeader.current && leader !== lastLeader.current;
    if (leader) lastLeader.current = leader;
    if (reduced || !changed) { setFlip(false); return; }
    setFlip(true);
    const timer = setTimeout(() => setFlip(false), 2500);
    return () => clearTimeout(timer);
  }, [leader, reduced]);

  const leadText = leader ? `${leader === "claude" ? "Claude Code" : "Codex"} leads by ${difference.toLocaleString()} ${difference === 1 ? "point" : "points"}` : total ? "An even match" : "The match starts with you";
  const renderSide = (side: Side, name: string, points: number, players: number) => <div className={`tug-side is-${side} ${!reduced && flash === side ? "is-scoring" : ""}`}>
    <h2>{name}</h2><div className="tug-score"><Count value={points} /><span>pts</span></div>
    <p>{players} {players === 1 ? "builder" : "builders"}</p>
  </div>;

  return <section className={`tug-board ${variant === "broadcast" ? "bzk-tug" : "tug-standalone"}`} aria-label="Claude Code versus Codex">
    <div className="tug-scores">
      {renderSide("claude", "Claude Code", s.claude, s.claudePlayers)}
      <div className="tug-match"><span className="tug-vs">VS</span><p className={leader ? `is-${leader}` : ""}>{leadText}</p>{flip && !reduced && <span className="tug-lead-change">Lead changes</span>}</div>
      {renderSide("codex", "Codex", s.codex, s.codexPlayers)}
    </div>
    <div className="tug-rope" role="img" aria-label={leadText} data-marker={marker}>
      <div className="tug-half is-claude" /><div className="tug-half is-codex" />
      <span className="tug-midline" />
      <span className="tug-marker" style={{ left: `${marker}%` }}><svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 4 10 10-10 10L4 14Z" /><path d="M14 9v10M9 14h10" /></svg></span>
    </div>
    <div className="tug-axis" aria-hidden="true"><span>Claude Code</span><span>Pull toward the lead</span><span>Codex</span></div>
  </section>;
}

export function TugLive() {
  const s = useQuery(api.room.sides);
  return <TugBar s={s ?? { claude: 0, codex: 0, claudePlayers: 0, codexPlayers: 0, last: null }} />;
}

export function TugDemo() {
  const [s, set] = useState<Sides>({ claude: 142, codex: 131, claudePlayers: 38, codexPlayers: 41, last: null });
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => set((previous) => {
      const side: Side = Math.random() < 0.5 ? "claude" : "codex", points = 1 + Math.floor(Math.random() * 6);
      return { ...previous, [side]: previous[side] + points, last: { side, at: Date.now(), id: String(++n) } };
    }), 2500);
    return () => clearInterval(timer);
  }, []);
  return <TugBar s={s} />;
}
