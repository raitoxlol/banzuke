"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductHeader } from "@/components/ProductHeader";
import { type Play, toPlay } from "@/lib/firehose";
import { demoRaw } from "@/lib/demo-global";
import { CREATION_HORIZON, DELIVERY_LIMIT, OBSERVED_HOUR, parsePublicSample, publicBoard, publicOvertake, type PublicSample } from "@/lib/global-board";

const VERB = { push: "pushed", pr_merged: "merged a PR", release: "released", star: "starred" } as const;
function ago(at: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
}
function usePublicBoard() {
  const [mode, setMode] = useState<"public" | "demo" | null>(null);
  const [sample, setSample] = useState<PublicSample>({ status: "starting", plays: [], nextPollMs: 0, lastSuccessAt: null, capacityReached: false });
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  const [nextCheckAt, setNextCheckAt] = useState(0);
  useEffect(() => { setMode(new URLSearchParams(location.search).get("demo") === "1" ? "demo" : "public"); setNow(Date.now()); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!mode) return;
    if (mode === "demo") {
      const create = (at: number) => toPlay(demoRaw(at), 0, at);
      const initial = Array.from({ length: 45 }, (_, i) => create(Date.now() - i * 30_000)).filter((p): p is Play => p !== null);
      setSample({ status: "live", plays: initial, nextPollMs: 0, lastSuccessAt: null, capacityReached: false });
      const timer = setInterval(() => {
        const play = create(Date.now());
        if (play) setSample((s) => ({ ...s, plays: [play, ...s.plays].filter((p) => p.at > Date.now() - OBSERVED_HOUR).slice(0, DELIVERY_LIMIT) }));
      }, 4000);
      return () => clearInterval(timer);
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      let wait = 60_000;
      try {
        const response = await fetch("/api/firehose", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Public sample unavailable");
        const incoming = parsePublicSample(await response.json());
        if (!incoming) throw new Error("Invalid public sample");
        if (cancelled) return;
        setSample(incoming);
        setNextCheckAt(Date.now() + incoming.nextPollMs);
        wait = Math.max(5000, Math.min(incoming.nextPollMs + 1000, 24 * OBSERVED_HOUR));
      } catch {
        if (cancelled) return;
        setSample((s) => ({ ...s, status: "error", nextPollMs: wait }));
      }
      if (!cancelled) timer = setTimeout(poll, wait);
    };
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [mode, retry]);
  const view = useMemo(() => publicBoard(sample.plays, now), [sample.plays, now]);
  return { mode, sample, view, now, nextCheckAt, retry: () => setRetry((n) => n + 1) };
}

export default function GlobalBoard() {
  const { mode, sample, view, now, nextCheckAt, retry } = usePublicBoard();
  const previous = useRef<Play[] | null>(null);
  const [overtake, setOvertake] = useState<{ up: string; down: string } | null>(null);
  useEffect(() => {
    const before = previous.current; previous.current = sample.plays;
    if (mode !== "public" || !before) return;
    const result = publicOvertake(before, sample.plays, Date.now());
    if (result) setOvertake(result);
  }, [sample.plays, mode]);
  useEffect(() => {
    if (!overtake) return;
    const timer = setTimeout(() => setOvertake(null), 5000);
    return () => clearTimeout(timer);
  }, [overtake]);
  const [paused, setPaused] = useState<{ plays: typeof view.plays; now: number } | null>(null);
  const shownPlays = paused?.plays ?? view.plays;
  const feedNow = paused?.now ?? now;
  const status = mode === "demo" ? "Demo sample" : { starting: "Connecting to GitHub", live: "Public sample available", rate_limited: "GitHub rate limit", error: "Public sample unavailable" }[sample.status];
  return <main className="product-page global-page"><ProductHeader current="global" />
    <div className="product-intro"><h1>Public builders, ranked.</h1><p>A delayed sample of public GitHub activity. No sign-in required.</p></div>
    <section className="global-status product-panel" aria-label="Sample status">
      <div><p className={`source-state ${mode === "demo" || sample.status === "rate_limited" || sample.status === "error" ? "is-warning" : ""}`} role="status"><i aria-hidden="true" />{status}</p>
        <p className="product-muted">{mode === "demo" ? "Illustrative activity only. This page isn't polling GitHub." : "Observed in the last hour, up to 600 newest events. GitHub event times may be much older."}</p>
        {mode !== "demo" && sample.lastSuccessAt && <p className="product-muted">Last successful check {new Date(sample.lastSuccessAt).toLocaleTimeString()}</p>}
        {mode !== "demo" && sample.status === "rate_limited" && <p className="product-notice">Next check in about {Math.max(1, Math.ceil((nextCheckAt - now) / 60_000))} minutes. Recent real activity stays until it expires.</p>}
        {mode !== "demo" && sample.status === "error" && <p className="product-notice">The refresh failed. Recent real activity stays until it expires.</p>}
        {sample.capacityReached && <p className="product-notice">The sample has reached capacity. New events wait for space.</p>}
      </div>
      <dl className="global-totals"><div><dt>Points</dt><dd>{view.total.toLocaleString()}</dd></div><div><dt>Builders</dt><dd>{view.builders.length.toLocaleString()}</dd></div><div><dt>Plays</dt><dd>{view.plays.length.toLocaleString()}</dd></div></dl>
    </section>
    <div className="global-lists">
      <section className="product-panel global-ranks" aria-labelledby="global-rank-title">
        <div className="global-section-heading"><h2 id="global-rank-title">Builder rankings <span lang="ja">番付</span></h2><span className="product-muted">Top 20</span></div>
        {overtake && <p className="global-overtake" role="status"><span lang="ja">逆転</span> @{overtake.up} takes the lead from @{overtake.down}.</p>}
        {view.builders.length ? <table><thead><tr><th scope="col">Rank</th><th scope="col">Builder</th><th scope="col" className="points-column">Points</th></tr></thead><tbody>{view.builders.slice(0, 20).map((builder, index) => <tr key={builder.login}><td className="rank-number">{index + 1}</td><th scope="row"><a href={`https://github.com/${builder.login}`} target="_blank" rel="noreferrer" title={`@${builder.login}`}>@{builder.login}</a><small>{builder.plays} {builder.plays === 1 ? "play" : "plays"}</small></th><td className="rank-points">{builder.points.toLocaleString()}</td></tr>)}</tbody></table> : <div className="product-empty"><h3>{sample.status === "starting" ? "Waiting for the public sample" : "No scoring activity in this sample"}</h3><p>{sample.status === "starting" ? "The first GitHub check is in progress." : "GitHub's public feed is a limited, delayed sample. An empty hour doesn't mean nobody is shipping."}</p></div>}
        <p className="global-footnote product-muted">Pushes earn up to 3 points per sampled event and 12 per builder in this observed hour. Merged PRs earn 10–15; releases earn 25, or 13 for a prerelease. Stars appear without points.</p>
      </section>
      <section className="product-panel global-feed" aria-labelledby="global-feed-title">
        <div className="global-section-heading"><h2 id="global-feed-title">Latest public plays</h2><button className="secondary" aria-pressed={paused !== null} onClick={() => setPaused(paused ? null : { plays: view.plays, now })}>{paused ? "Resume feed" : "Pause feed"}</button></div>
        {paused && <p className="product-notice">Feed paused. Entries and ages are held; rankings keep updating.</p>}
        {shownPlays.length ? <ol className="public-play-list">{shownPlays.slice(0, 50).map((play) => <li key={play.id}>
          <div className="public-play-copy"><p><a href={`https://github.com/${play.login}`} target="_blank" rel="noreferrer" title={`@${play.login}`}>@{play.login}</a> <span>{VERB[play.kind]}</span></p><a className="play-repo" href={`https://github.com/${play.repo}`} target="_blank" rel="noreferrer" title={play.repo}>{play.repo}</a><p className="play-summary" title={play.summary}>{play.summary}</p><small>Observed {ago(play.at, feedNow)} ago · GitHub event {ago(play.created, feedNow)} ago</small></div>
          <div className="public-play-points"><b>+{play.points}</b>{play.points < play.rawPoints && <small>push cap</small>}</div>
        </li>)}</ol> : <div className="product-empty"><h3>No recent plays to show</h3><p>New sampled activity appears here after a successful check.</p></div>}
        <p className="global-footnote product-muted">Showing up to 50 latest plays. Only public events created within {CREATION_HORIZON / OBSERVED_HOUR / 24} days enter the sample. History resets when the server restarts.</p>
      </section>
    </div>
    <footer className="global-footer"><p className="product-muted">Your room score uses a separate 72-hour window. Join to track your own activity.</p><a className="product-button" href="/join">Join the room</a>{mode !== "demo" && <button className="secondary" onClick={retry}>Retry public sample</button>}{mode === "demo" && <a className="product-button secondary" href="/global">Open the real public sample</a>}</footer>
  </main>;
}
