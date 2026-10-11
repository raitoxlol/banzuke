"use client";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { ROOM_STABLES as HEYA_STABLES, side, whyTag, type Answers } from "@/lib/quiz";
import { rankOf } from "@/lib/board";
import { playLabel } from "@/lib/ingest";
import { Count } from "@/components/Ticker";
import { JoinQr } from "@/components/Qr";

export interface RoomData {
  players: { login: string; avatar: string; team: number; answers?: Answers }[];
  plays: { id: string; login: string; team: number; kind: "push" | "pr_merged" | "release"; points: number; at: number; private: boolean; repo: string; summary: string }[];
}
const VERB = { push: "pushed to", pr_merged: "merged in", release: "released" } as const;
const ago = (t: number, now: number) => { const s = Math.max(0, (now - t) / 1000 | 0); return s < 60 ? `${s}s` : s < 3600 ? `${s / 60 | 0}m` : `${s / 3600 | 0}h`; };

export function RoomBoard({ data, live }: { data: RoomData; live: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const avatar = new Map(data.players.map((p) => [p.login, p.avatar]));
  const by = new Map<string, { login: string; team: number; score: number; plays: number }>();
  for (const p of data.players) by.set(p.login, { login: p.login, team: p.team, score: 0, plays: 0 });
  for (const p of data.plays) { const b = by.get(p.login) ?? { login: p.login, team: p.team, score: 0, plays: 0 }; b.score += p.points; b.plays++; by.set(p.login, b); }
  const builders = [...by.values()].sort((a, b) => b.score - a.score);
  const teams = HEYA_STABLES.map((s) => ({ ...s, score: 0, builders: 0 }));
  for (const b of builders) { teams[b.team].score += b.score; teams[b.team].builders++; }
  teams.sort((a, b) => b.score - a.score);
  const color = new Map(HEYA_STABLES.map((s) => [s.id, s.color]));
  const name = new Map(HEYA_STABLES.map((s) => [s.id, s.name]));
  const why = new Map(data.players.map((p) => [p.login, whyTag(p.answers)]));
  const claude = data.players.filter((p) => side(p.team) === "Claude Code").length;
  const top = teams[0]?.score || 1;
  const hour = data.plays.filter((p) => now - p.at < 3600_000);
  const latest = data.plays[0];
  const line = latest
    ? `@${latest.login} ${VERB[latest.kind]} ${latest.private ? "a private repo" : latest.repo}. +${latest.points} for ${name.get(latest.team)}. ${teams[0].name} hold the top of the banzuke.`
    : "Scan the code. Sign in with GitHub. Your last 72 hours land on the board.";

  return (
    <main className="g room">
      <header className="g-head">
        <div className="wordmark big"><span className="dot" /><span>{BRAND.name.toUpperCase()}</span>
          <span className={`badge ${live ? "" : "warn"}`}>{live ? "LIVE" : "DEMO"}</span></div>
        <div className="g-sub muted"><span>Grok Bot Tokyo room board</span><span className="sep" /><span>real-time via GitHub App · 72h backfill on sign-up</span></div>
        <span />
        <div className="num g-clock" suppressHydrationWarning>{new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" })} <span className="muted">JST</span></div>
      </header>

      <section className="counters">
        {([
          ["Builders in the room", data.players.length, `Claude Code ${claude} · Codex ${data.players.length - claude}`],
          ["Plays", data.plays.length, "last 72h"],
          ["Points", data.plays.reduce((s, p) => s + p.points, 0), "last 72h"],
          ["Last hour", hour.length, "plays"],
          ["Private plays", data.plays.filter((p) => p.private).length, "credit, no spoilers"],
        ] as const).map(([k, v, s]) => <div key={k} className="counter"><dt>{k}</dt><dd><Count value={v} /></dd><small className="muted">{s}</small></div>)}
      </section>

      <section className="g-grid">
        <div className="stage room-stage">
          <JoinQr />
          <ul className="g-feed room-feed">
            {data.plays.slice(0, 9).map((p) => (
              <li key={p.id} className={`${p.kind} ${p.private ? "priv" : ""}`}>
                <i style={{ background: color.get(p.team) }} />
                <b>@{p.login}</b> <span className="muted">{VERB[p.kind]}</span> <span className="repo">{playLabel(p)}</span>
                <em className="num">+{p.points}</em><time className="num muted">{ago(p.at, now)}</time>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel g-teams">
          <h2><span>Stables</span><span className="jp" aria-hidden>部屋</span></h2>
          <ol className="t-list">
            {teams.map((t, i) => (
              <li key={t.id} style={{ transform: `translateY(calc(${i} * var(--trow)))`, ["--team" as string]: t.color }} className={i === 0 ? "top" : ""}>
                <span className="t-rank"><b>{rankOf(i)[0]}</b><small>{rankOf(i)[1]}</small></span>
                <span className="t-name">{t.name}<small className="muted">{t.builders} builders · {t.jp}</small></span>
                <span className="t-score"><Count value={t.score} /></span>
                <span className="t-bar"><i style={{ width: `${(t.score / top) * 100}%` }} /></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel g-builders">
          <h2><span>Top builders</span><span className="jp" aria-hidden>番付</span></h2>
          <ol className="b-list">
            {builders.slice(0, 9).map((b, i) => (
              <li key={b.login} style={{ transform: `translateY(calc(${i} * var(--brow)))`, ["--team" as string]: color.get(b.team) }}>
                <span className="b-rank num">{i + 1}</span>
                {avatar.get(b.login) ? <img src={avatar.get(b.login)} alt="" /> : <span className="b-av" />}
                <span className="b-name">@{b.login}<small className="muted">{rankOf(i)[1]} · {name.get(b.team)}{why.get(b.login) ? ` · ${why.get(b.login)}` : ""}</small></span>
                <span className="b-score"><Count value={b.score} /></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ticker g-ticker" aria-live="polite">
        <span className="ticker-tag">GROK</span><p key={line}>{line}</p>
        <span className="muted small src">{live ? "Convex · real-time" : "demo data"}</span>
      </section>
    </main>
  );
}
