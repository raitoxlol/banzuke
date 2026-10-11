"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { HEYA_STABLES, Play, RawEvent, currentBasho, draft, toPlay } from "@/lib/firehose";
import { loadCircle, circleEvents } from "@/lib/circle";
import { callLine, rankOf, tally } from "@/lib/board";
import { demoRaw } from "@/lib/demo-global";
import { Dohyo } from "@/components/Dohyo";
import { Count } from "@/components/Ticker";

type Source = "connecting" | "live" | "live-direct" | "demo";
const WINDOW = 60 * 60_000;
const VERB = { push: "pushed", pr_merged: "merged", release: "released", star: "starred" } as const;

function ago(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
}

export default function Global() {
  const [shown, setShown] = useState<Play[]>([]);
  const [flashes, setFlashes] = useState<Play[]>([]);
  const [source, setSource] = useState<Source>("connecting");
  const [seed, setSeed] = useState("");
  const [circle, setCircle] = useState<Set<string>>(new Set());
  const [seedInput, setSeedInput] = useState("");
  const [basho, setBasho] = useState(currentBasho());
  const [line, setLine] = useState(`${BRAND.name} is live. Every public GitHub account is on the board.`);
  const [bout, setBout] = useState<{ a: string; b: string; ca: string; cb: string; k: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const queue = useRef<Play[]>([]);
  const known = useRef(new Set<string>());
  const dripMs = useRef(600);
  const prevOrder = useRef<number[]>([]);
  const seq = useRef(0);
  const stables = HEYA_STABLES;
  const bashoRef = useRef(basho); bashoRef.current = basho;
  const redraft = (p: Play): Play => ({ ...p, team: draft(p.login, bashoRef.current) });

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Data: server route first; if it is rate-limited, poll GitHub straight from this browser; else demo.
  useEffect(() => {
    let stop = false, etag = "", timer: ReturnType<typeof setTimeout>;
    let failures = 0, firstLoad = true;
    const accept = (plays: Play[], nextMs: number) => {
      const fresh = plays.map(redraft).filter((p) => !known.current.has(p.id)).sort((a, b) => a.at - b.at);
      fresh.forEach((p) => known.current.add(p.id));
      if (firstLoad && fresh.length) {
        // Open mid-bout: most of the window lands at once, the newest 30 drip in.
        const cut = Math.max(0, fresh.length - 30);
        setShown((s) => [...fresh.slice(0, cut).reverse(), ...s]);
        queue.current.push(...fresh.slice(cut));
        firstLoad = false;
      } else queue.current.push(...fresh);
      dripMs.current = Math.max(150, Math.min(2500, (nextMs || 60_000) / Math.max(1, queue.current.length)));
    };
    const direct = async () => {
      const r = await fetch("https://api.github.com/events?per_page=100", { headers: etag ? { "If-None-Match": etag } : {} });
      const wait = Math.max(60, Number(r.headers.get("x-poll-interval") ?? 60)) * 1000;
      if (r.status === 304) return wait;
      if (!r.ok) throw new Error(String(r.status));
      etag = r.headers.get("etag") ?? "";
      const evs = (await r.json()) as RawEvent[];
      accept(evs.map((e) => toPlay(e, 0, Date.now())).filter(Boolean) as Play[], wait);
      setSource("live-direct");
      return wait;
    };
    const demo = () => {
      setSource("demo");
      const n = Date.now();
      accept(Array.from({ length: 70 }, (_, i) => toPlay(demoRaw(n - (70 - i) * 20_000), 0)).filter(Boolean) as Play[], 30_000);
      const t = setInterval(() => { const p = toPlay(demoRaw(), 0); if (p) accept([p], 1500); }, 1500);
      return () => clearInterval(t);
    };
    let stopDemo: (() => void) | null = null;
    const tick = async () => {
      if (stop) return;
      let wait = 10_000;
      try {
        if (source !== "live-direct") {
          const r = await fetch("/api/firehose", { cache: "no-store" });
          const j = await r.json();
          if (j.status === "live" && j.plays.length) {
            setSource("live"); accept(j.plays, j.nextPollMs + 2000);
            wait = Math.max(5_000, j.nextPollMs + 1500); failures = 0;
          } else if (j.status === "rate_limited" || j.status === "error") throw new Error(j.status);
        } else wait = await direct();
      } catch {
        try { wait = await direct(); failures = 0; }
        catch { if (++failures >= 2 && !stopDemo && !known.current.size) stopDemo = demo(); wait = 60_000; }
      }
      timer = setTimeout(tick, wait);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); stopDemo?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read ?seed= and ?basho= once.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const sd = (q.get("seed") ?? "").trim(); if (sd) { setSeed(sd); setSeedInput(sd); }
    const b = q.get("basho"); if (b) setBasho(b);
  }, []);
  useEffect(() => { setShown((s) => s.map(redraft)); }, [basho]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relevant mode: the seed's GitHub circle (following, followers, stargazers) is fetched from this browser,
  // cached, and their own public events are polled slowly on a rotation to stay inside 60 req/hr.
  useEffect(() => {
    if (!seed) { setCircle(new Set()); return; }
    let stop = false, t: ReturnType<typeof setTimeout>;
    loadCircle(seed).then((c) => {
      if (stop) return;
      setCircle(new Set(c.members));
      setLine(c.members.length ? `Relevant mode: watching @${c.login} and ${c.members.length - 1} builders around them.` : `Couldn't load @${seed} from GitHub right now. Showing everyone.`);
      let i = 0;
      const run = async () => {
        if (stop) return;
        const who = i++ % 3 === 0 ? c.login : c.members[1 + (i % Math.max(1, c.members.length - 1))] ?? c.login;
        const evs = await circleEvents(who);
        if (evs.length) {
          const fresh = evs.map((e) => toPlay(e, 0)).filter(Boolean) as Play[];
          const f2 = fresh.map(redraft).filter((p) => !known.current.has(p.id));
          f2.forEach((p) => known.current.add(p.id));
          if (f2.length) setShown((s) => [...s, ...f2].sort((a, b) => b.at - a.at));
        }
        t = setTimeout(run, 150_000);
      };
      run();
    });
    return () => { stop = true; clearTimeout(t); };
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drip queued plays onto the board so it moves continuously between polls.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      const p = queue.current.shift();
      if (p) {
        setShown((s) => [p, ...s].filter((x) => Date.now() - x.at < WINDOW || x.id.startsWith("demo")).slice(0, 1500));
        setFlashes((f) => [...f.slice(-24), p]);
      }
      t = setTimeout(step, p ? dripMs.current : 400);
    };
    step();
    return () => clearTimeout(t);
  }, []);

  const { builders, teams } = useMemo(() => tally(shown, stables), [shown, stables]);
  const teamName = useMemo(() => new Map(stables.map((s) => [s.id, s.name])), [stables]);

  // Commentary from real plays, weighted toward merges and releases.
  useEffect(() => {
    const p = flashes[flashes.length - 1];
    if (!p || !teams.length) return;
    const big = p.kind === "release" || p.kind === "pr_merged" || circle.has(p.login.toLowerCase());
    if (!big && seq.current++ % 9 !== 0) return;
    setLine(callLine(p, teamName.get(p.team) ?? "", teams[0].name, seq.current));
  }, [flashes, teams, teamName, circle]);

  // Torikumi: call it when two stables swap places.
  useEffect(() => {
    const order = teams.map((t) => t.id);
    const prev = prevOrder.current;
    if (prev.length === order.length && prev.join() !== order.join() && shown.length > 40) {
      const i = order.findIndex((id, k) => prev[k] !== id);
      const up = teams[i], down = teams.find((t) => t.id === prev[i]);
      if (up && down && up.id !== down.id) {
        setBout({ a: up.name, b: down.name, ca: up.color, cb: down.color, k: Date.now() });
        setLine(`Torikumi! ${up.name} push past ${down.name} for ${rankOf(i)[1]}.`);
      }
    }
    prevOrder.current = order;
  }, [teams, shown.length]);
  useEffect(() => { if (!bout) return; const t = setTimeout(() => setBout(null), 4200); return () => clearTimeout(t); }, [bout]);

  const live = shown.filter((p) => !p.id.startsWith("demo") ? now - p.at < WINDOW : true);
  const span = live.length > 1 ? Math.max(1, (live[0].at - live[live.length - 1].at) / 60_000) : 1;
  const count = (k: Play["kind"]) => live.filter((p) => p.kind === k).length;
  const perMin = count("push") / span;
  const total = teams.reduce((s, t) => s + t.score, 0);
  const topTeam = teams[0]?.score || 1;
  const mine = builders.filter((b) => circle.has(b.login.toLowerCase()));
  const topB = (seed && mine.length ? [...mine, ...builders.filter((b) => !circle.has(b.login.toLowerCase()))] : builders).slice(0, 8);
  const go = (v: string) => { const u = new URL(location.href); v ? u.searchParams.set("seed", v) : u.searchParams.delete("seed"); history.replaceState(null, "", u); setSeed(v); };
  const color = new Map(stables.map((s) => [s.id, s.color]));
  const badge = { connecting: "CONNECTING", live: "LIVE", "live-direct": "LIVE", demo: "DEMO" }[source];

  return (
    <main className="g">
      <header className="g-head">
        <div className="wordmark big">
          <span className="dot" /><span>{BRAND.name.toUpperCase()}</span>
          <span className={`badge ${source === "demo" ? "warn" : ""}`}>{badge}</span>
        </div>
        <div className="g-sub muted">
          <span>{source === "demo" ? "GitHub is rate-limiting us. Showing demo plays." : "Every public GitHub account is playing. No sign-up."}</span>
          <span className="sep" /><span>{seed ? <>Relevant to <b className="hl">@{seed.replace(/^@|^x:/, "")}</b></> : <>Random draft · basho {basho}</>}</span>
        </div>
        <form className="seed" onSubmit={(e) => { e.preventDefault(); go(seedInput.trim()); }}>
          <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="GitHub user for relevant mode" aria-label="Seed GitHub user" />
          {seed ? <button type="button" onClick={() => { setSeedInput(""); go(""); }}>Everyone</button> : <button type="submit">Seed</button>}
        </form>
        <div className="num g-clock" suppressHydrationWarning>{new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" })} <span className="muted">JST</span></div>
      </header>

      <section className="counters">
        {([
          ["Pushes / min", perMin, 1, "sampled from the public firehose"],
          ["Builders on the banzuke", builders.length, 0, "rolling hour"],
          ["Merged PRs", count("pr_merged"), 0, "10+ pts each"],
          ["Releases", count("release"), 0, "25 pts each"],
          ["Stars thrown", count("star"), 0, "crowd noise"],
        ] as const).map(([k, v, d, s]) => (
          <div key={k} className="counter"><dt>{k}</dt><dd><Count value={v} decimals={d} /></dd><small className="muted">{s}</small></div>
        ))}
      </section>

      <section className="g-grid">
        <div className="stage g-stage">
          <Dohyo teams={teams} builders={builders} flashes={flashes} total={total} perMin={perMin} />
          {bout && (
            <div className="bout" key={bout.k}>
              <span className="bout-jp">取組</span>
              <div><small>TORIKUMI</small><b><i style={{ color: bout.ca }}>{bout.a}</i> overtake <i style={{ color: bout.cb }}>{bout.b}</i></b></div>
            </div>
          )}
          <ul className="g-feed">
            {shown.slice(0, 5).map((p) => (
              <li key={p.id} className={`${p.kind} ${circle.has(p.login.toLowerCase()) ? "mine" : ""}`}>
                <i style={{ background: color.get(p.team) }} />
                <b>@{p.login}</b> <span className="muted">{VERB[p.kind]}</span> <span className="repo">{p.repo}</span>
                <em className="num">{p.points ? `+${p.points}` : "★"}</em>
                <time className="num muted">{ago(p.created, now)}</time>
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
                <span className="t-bar"><i style={{ width: `${(t.score / topTeam) * 100}%` }} /></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel g-builders">
          <h2><span>{seed && mine.length ? "Your circle first" : "Top builders"}</span><span className="jp" aria-hidden>番付</span></h2>
          <ol className="b-list">
            {topB.map((b, i) => (
              <li key={b.login} className={circle.has(b.login.toLowerCase()) ? "mine" : ""} style={{ transform: `translateY(calc(${i} * var(--brow)))`, ["--team" as string]: color.get(b.team) }}>
                <span className="b-rank num">{i + 1}</span>
                {b.avatar ? <img src={`${b.avatar}${b.avatar.includes("?") ? "&" : "?"}s=80`} alt="" /> : <span className="b-av" />}
                <span className="b-name">@{b.login}<small className="muted">{rankOf(i)[1]} · {teamName.get(b.team)}</small></span>
                <span className="b-score"><Count value={b.score} /></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ticker g-ticker" aria-live="polite">
        <span className="ticker-tag">GROK</span>
        <p key={line}>{line}</p>
        <span className="muted small src">{source === "demo" ? "demo data" : "api.github.com/events · ~5 min delay"}</span>
      </section>
    </main>
  );
}
