"use client";
import { useEffect, useState } from "react";
import { PulseMap } from "@/components/PulseMap";
import { Banzuke } from "@/components/Banzuke";
import { anonClient, hasSupabase, PulseEvent, Team } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";
import { DEMO_TEAMS, demoLine, fakeEvent, seedEvents } from "@/lib/demo";

const LABEL = { push: "pushed", pr_merged: "merged a PR", release: "shipped a release" } as const;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export default function Broadcast() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>(DEMO_TEAMS);
  const [line, setLine] = useState(`${BRAND.name} is live. Ship code, score for your team.`);
  const [now, setNow] = useState(() => Date.now());
  const demo = !hasSupabase();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (demo) {
      const seed = seedEvents(40, 15);
      const total = (id: number, list: PulseEvent[]) => list.filter((e) => e.team_id === id).reduce((s, e) => s + e.points, 0);
      let board = DEMO_TEAMS.map((t) => ({ ...t, score: total(t.id, seed) }));
      setEvents(seed);
      setTeams(board);
      const t = setInterval(() => {
        const e = fakeEvent();
        board = board.map((x) => (x.id === e.team_id ? { ...x, score: x.score + e.points } : x));
        const leader = [...board].sort((a, b) => b.score - a.score)[0].name;
        const said = demoLine(e, board.find((x) => x.id === e.team_id)!.name, leader);
        setEvents((prev) => [e, ...prev].slice(0, 200));
        setTeams(board);
        if (said) setLine(said);
      }, 1500);
      return () => clearInterval(t);
    }
    const sb = anonClient();
    const loadScores = () =>
      sb.from("team_scores").select("*").order("score", { ascending: false }).then(({ data }) => data && setTeams(data));
    sb.from("events").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => data && setEvents(data));
    sb.from("commentary").select("line").order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => data?.[0] && setLine(data[0].line));
    loadScores();
    const ch = sb.channel("pulse")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (p) => {
        setEvents((prev) => [p.new as PulseEvent, ...prev].slice(0, 200));
        loadScores();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commentary" }, (p) =>
        setLine((p.new as { line: string }).line))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [demo]);

  const team = new Map(teams.map((t) => [t.id, t]));
  const recent = events.filter((e) => now - new Date(e.created_at).getTime() < 15 * 60_000);
  const stats = [
    ["Plays", recent.length],
    ["Builders", new Set(recent.map((e) => e.player_login)).size],
    ["Points", recent.reduce((s, e) => s + e.points, 0)],
  ] as const;

  return (
    <main className="broadcast">
      <header>
        <div className="wordmark">
          <span className="dot" />
          <span>{BRAND.name.toUpperCase()}</span>
          <span className="badge">{demo ? "DEMO" : "LIVE"}</span>
        </div>
        <div className="head-right">
          <span className="num muted" suppressHydrationWarning>{new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" })} JST</span>
          <a href="/join" className="join">Join a team</a>
        </div>
      </header>

      <section className="ticker" aria-live="polite">
        <span className="ticker-tag">GROK</span>
        <p key={line}>{line}</p>
      </section>

      <div className="grid">
        <section className="stage">
          <PulseMap events={events} teams={teams} />
          <dl className="stats">
            {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
            <div><dt>Window</dt><dd className="num">15m</dd></div>
          </dl>
        </section>

        <aside>
          <div className="panel">
            <h2><span>Banzuke</span><span className="jp" aria-hidden>番付</span></h2>
            <Banzuke teams={teams} />
          </div>
          <div className="panel feed-panel">
            <h2><span>Plays</span></h2>
            <ul className="feed">
              {events.slice(0, 14).map((e) => (
                <li key={e.id} className={e.kind}>
                  <i style={{ background: team.get(e.team_id)?.color }} />
                  <div>
                    <div><b>@{e.player_login}</b> <span className="muted">{LABEL[e.kind]}</span></div>
                    <div className="muted small">{e.repo} · {e.summary}</div>
                  </div>
                  <em className="num">+{e.points}</em>
                  <time className="num muted small">{ago(e.created_at, now)}</time>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
