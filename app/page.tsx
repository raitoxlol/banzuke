"use client";
import { useEffect, useState } from "react";
import { PulseMap } from "@/components/PulseMap";
import { anonClient, hasSupabase, PulseEvent, Team } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";
import { DEMO_TEAMS, fakeEvent } from "@/lib/demo";

const LABEL = { push: "pushed", pr_merged: "merged a PR", release: "shipped a release" } as const;

export default function Broadcast() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>(DEMO_TEAMS);
  const [line, setLine] = useState(`${BRAND.name} is live. Ship code, score for your team.`);
  const demo = !hasSupabase();

  // Recompute team scores from what we've seen (demo) or reload the view (live).
  useEffect(() => {
    if (demo) {
      const t = setInterval(() => {
        const e = fakeEvent();
        setEvents((prev) => [e, ...prev].slice(0, 200));
        setTeams((prev) => prev.map((x) => (x.id === e.team_id ? { ...x, score: x.score + e.points } : x)));
        if (e.kind !== "push") {
          const team = DEMO_TEAMS.find((x) => x.id === e.team_id)!.name;
          setLine(`@${e.player_login} just ${LABEL[e.kind]} for ${team}! +${e.points}`);
        }
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

  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const color = new Map(teams.map((t) => [t.id, t.color]));

  return (
    <main className="broadcast">
      <header>
        <h1><span className="dot" /> {BRAND.name.toUpperCase()} <small>{demo ? "DEMO" : "LIVE"}</small></h1>
        <a href="/join" className="join">Join a team →</a>
      </header>
      <section className="commentary">{line}</section>
      <div className="grid">
        <PulseMap events={events} teams={teams} />
        <aside>
          <h2>This week</h2>
          <ol className="scores">
            {sorted.map((t) => (
              <li key={t.id} style={{ borderColor: t.color }}>
                <span>{t.name}</span><b>{t.score}</b>
              </li>
            ))}
          </ol>
          <h2>Plays</h2>
          <ul className="feed">
            {events.slice(0, 12).map((e) => (
              <li key={e.id}>
                <i style={{ background: color.get(e.team_id) }} />
                <b>@{e.player_login}</b> {LABEL[e.kind]} <em>+{e.points}</em>
                <div className="muted small">{e.repo} · {e.summary}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
