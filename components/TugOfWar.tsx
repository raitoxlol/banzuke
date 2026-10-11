"use client";
// The agent race: one lane per coding agent, bars scaled to the leader. 逆転 flashes when the lead changes.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Count, useReducedMotion } from "@/components/Ticker";
import { agentLabel, tallyRace, type Agent, type Race } from "@/lib/agents";

export function TugBar({ s, variant = "standalone" }: { s: Race; variant?: "standalone" | "broadcast" }) {
  const reduced = useReducedMotion();
  const [flash, setFlash] = useState<Agent | null>(null);
  const [flip, setFlip] = useState(false);
  const lastId = useRef(s.last?.id);
  const lastLeader = useRef(s.leader);

  useEffect(() => {
    const changed = s.last && s.last.id !== lastId.current;
    lastId.current = s.last?.id;
    if (reduced || !changed) { setFlash(null); return; }
    setFlash(s.last?.agent ?? null);
    const timer = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [s.last, reduced]);

  useEffect(() => {
    const changed = s.leader && lastLeader.current && s.leader !== lastLeader.current;
    if (s.leader) lastLeader.current = s.leader;
    if (reduced || !changed) { setFlip(false); return; }
    setFlip(true);
    const timer = setTimeout(() => setFlip(false), 2500);
    return () => clearTimeout(timer);
  }, [s.leader, reduced]);

  const top = s.lanes[0]?.points || 1;
  // Broadcast shows lanes that have anyone in them; standalone /tug shows the whole field.
  const lanes = variant === "broadcast" ? s.lanes.filter((l) => l.points || l.builders) : s.lanes;
  const gap = s.leader ? s.lanes[0].points - s.lanes[1].points : 0;
  const leadText = s.leader ? `${agentLabel(s.leader)} leads by ${gap.toLocaleString()} ${gap === 1 ? "point" : "points"}` : s.total ? "Dead heat at the top" : "Waiting for the first push — scan to join";

  return <section className={`race ${variant === "broadcast" ? "bzk-tug race-broadcast" : "race-standalone"}`} aria-label="Agent race">
    <div className="race-head">
      <h2>Agent race <span lang="ja" className="bzk-jp" aria-hidden="true">番付</span></h2>
      <p className={s.leader ? "is-leading" : ""} style={s.leader ? { color: s.lanes[0].color } : undefined}>{leadText}</p>
      {flip && !reduced && <span className="race-flip" lang="ja">逆転</span>}
    </div>
    {lanes.length ? <ol className="race-lanes">
      {lanes.map((l, i) => <li key={l.id} className={`race-lane ${!reduced && flash === l.id ? "is-scoring" : ""}`} style={{ ["--lane" as string]: l.color }}>
        <span className="race-pos num">#{i + 1}</span>
        <span className="race-name">{l.label}<small>{l.builders} {l.builders === 1 ? "builder" : "builders"}</small></span>
        <span className="race-track" aria-hidden="true"><i style={{ width: `${l.points / top * 100}%` }} /></span>
        <span className="race-pts"><Count value={l.points} /></span>
      </li>)}
    </ol> : <p className="race-empty">Waiting for the first push — scan to join.</p>}
  </section>;
}

const EMPTY = tallyRace([], []);
export function TugLive() {
  const s = useQuery(api.room.race);
  return <TugBar s={s ?? EMPTY} />;
}

/** Only behind ?demo=1. */
export function TugDemo() {
  const [s, set] = useState<Race>(EMPTY);
  useEffect(() => {
    const ids: Agent[] = ["claude", "codex", "cursor", "devin", "opencode", "grok", "copilot", "human"];
    const players = ids.flatMap((id, i) => Array.from({ length: 2 + (i % 3) }, (_, k) => ({ login: `${id}${k}`, answers: { tool: id } })));
    const plays: { id: string; login: string; points: number; at: number }[] = [];
    let n = 0;
    const tick = () => { const p = players[Math.floor(Math.random() * players.length)]; plays.push({ id: String(++n), login: p.login, points: 1 + Math.floor(Math.random() * 6), at: Date.now() }); set(tallyRace(players, plays)); };
    for (let i = 0; i < 40; i++) tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, []);
  return <TugBar s={s} />;
}
