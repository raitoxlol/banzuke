"use client";
// The agent race: one lane per coding agent, bars scaled to the leader. 逆転 flashes when the lead changes.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Count, useReducedMotion } from "@/components/Ticker";
import { agentLabel, tallyRace, type Agent, type Race } from "@/lib/agents";
import { tallyTeams, type TeamRace, type TeamSide } from "@/lib/teams";

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
  const leadText = s.leader ? `${s.leader === "human" ? "手動・その他" : agentLabel(s.leader)} が${gap.toLocaleString("ja-JP")}点差でリード` : s.total ? "首位は同点" : "最初のプッシュを待っています。QRコードから参加できます";

  return <section className={`race ${variant === "broadcast" ? "bzk-tug race-broadcast" : "race-standalone"}`} aria-label="エージェント対抗戦">
    <div className="race-head">
      <h2>エージェント対抗戦 <span lang="ja" className="bzk-jp" aria-hidden="true">番付</span></h2>
      <p className={s.leader ? "is-leading" : ""} style={s.leader ? { color: s.lanes[0].color } : undefined}>{leadText}</p>
      {flip && !reduced && <span className="race-flip" lang="ja">逆転</span>}
    </div>
    {lanes.length ? <ol className="race-lanes">
      {lanes.map((l, i) => <li key={l.id} className={`race-lane ${!reduced && flash === l.id ? "is-scoring" : ""}`} style={{ ["--lane" as string]: l.color }}>
        <span className="race-pos num">#{i + 1}</span>
        <span className="race-name">{l.id === "human" ? "手動・その他" : l.label}<small>参加者 {l.builders}人</small></span>
        <span className="race-track" aria-hidden="true"><i style={{ width: `${l.points / top * 100}%` }} /></span>
        <span className="race-pts"><Count value={l.points} /></span>
      </li>)}
    </ol> : <p className="race-empty">最初のプッシュを待っています。QRコードから参加できます。</p>}
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
  const [tt, setT] = useState<TeamRace>(tallyTeams([], []));
  useEffect(() => {
    const ids: Agent[] = ["claude", "codex", "cursor", "devin", "opencode", "grok", "copilot", "human"];
    const players = ids.flatMap((id, i) => Array.from({ length: 2 + (i % 3) }, (_, k) => ({ login: `${id}${k}`, answers: { tool: id } })));
    const plays: { id: string; login: string; points: number; at: number }[] = [];
    let n = 0;
    const tick = () => { const p = players[Math.floor(Math.random() * players.length)]; plays.push({ id: String(++n), login: p.login, points: 1 + Math.floor(Math.random() * 6), at: Date.now() }); set(tallyRace(players, plays)); setT(tallyTeams(players, plays)); };
    for (let i = 0; i < 40; i++) tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, []);
  return <><TeamTugBar t={tt} big /><AgentChips s={s} /></>;
}

/** Team A vs Team B: one two-sided bar. 逆転 flashes when the lead flips. */
export function TeamTugBar({ t, big = false }: { t: TeamRace; big?: boolean }) {
  const reduced = useReducedMotion();
  const [flip, setFlip] = useState(false);
  const lastLeader = useRef(t.leader);
  useEffect(() => {
    const changed = t.leader !== null && lastLeader.current !== null && t.leader !== lastLeader.current;
    if (t.leader !== null) lastLeader.current = t.leader;
    if (reduced || !changed) return;
    setFlip(true);
    const timer = setTimeout(() => setFlip(false), 2500);
    return () => clearTimeout(timer);
  }, [t.leader, reduced]);
  const [a, b] = t.sides;
  const pct = t.total ? (a.points / t.total) * 100 : 50;
  const gap = Math.abs(a.points - b.points);
  const lead = t.leader === null ? (t.total ? "両チームは同点！" : "最初のプッシュを待っています。QRコードから参加できます") : `${t.sides[t.leader].name} が${gap.toLocaleString("ja-JP")}点差でリード`;
  const side = (s: TeamSide, align: "left" | "right") => <div style={{ textAlign: align }}>
    <div style={{ fontWeight: 900, fontSize: big ? 40 : 24, color: s.color, lineHeight: 1.1 }}>{s.name}</div>
    <div style={{ fontWeight: 900, fontSize: big ? 72 : 44 }}><Count value={s.points} /></div>
    <small style={{ opacity: 0.7 }}>参加者 {s.builders}人</small>
  </div>;
  return <section className="race bzk-tug team-tug" aria-label="チーム対抗戦" style={{ position: "relative" }}>
    <div className="race-head">
      <h2>チーム対抗戦 <span lang="ja" className="bzk-jp" aria-hidden="true">団体戦</span></h2>
      <p className={t.leader !== null ? "is-leading" : ""} style={t.leader !== null ? { color: t.sides[t.leader].color } : undefined}>{lead}</p>
      {flip && !reduced && <span className="race-flip" lang="ja">逆転</span>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "end" }}>{side(a, "left")}{side(b, "right")}</div>
    <div aria-hidden="true" style={{ display: "flex", height: big ? 40 : 22, borderRadius: 999, overflow: "hidden", marginTop: 12, background: "#333" }}>
      <i style={{ width: `${pct}%`, background: a.color, transition: "width .8s ease" }} />
      <i style={{ flex: 1, background: b.color }} />
    </div>
  </section>;
}

/** Small secondary detail: agent points as a single line of chips. */
export function AgentChips({ s }: { s: Race }) {
  const lanes = s.lanes.filter((l) => l.points);
  if (!lanes.length) return null;
  return <p className="agent-chips" style={{ fontSize: 13, opacity: 0.75, margin: "6px 0 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
    <span>エージェント別：</span>{lanes.map((l) => <span key={l.id}><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9, background: l.color, marginRight: 4 }} />{l.id === "human" ? "手動・その他" : l.label} {l.points}</span>)}
  </p>;
}

export function TeamTugLive() {
  const d = useQuery(api.room.board);
  const players = d?.players ?? [], plays = d?.plays ?? [];
  return <><TeamTugBar t={tallyTeams(players, plays)} big /><AgentChips s={tallyRace(players, plays)} /></>;
}
