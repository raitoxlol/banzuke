"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { deriveBroadcast, jstDeadlineForDay, PLAY_VERB, remainingSeconds, type BroadcastPlay, type RoomData } from "@/lib/room-broadcast";
import { AGENTS, type Agent } from "@/lib/agents";
import { CommentaryTicker, Count } from "@/components/Ticker";
import { JoinQr } from "@/components/Qr";
import { TeamTugBar, AgentChips } from "@/components/TugOfWar";
import { tallyTeams, teamOf, TEAMS, TEAM_COLORS } from "@/lib/teams";
import { ViewToggle } from "@/components/ViewToggle";

type Clock = { nowMs: number; deadlineMs: number };
type FeedFilter = "all" | Agent;
type Playback = { kind: "following" } | { kind: "paused"; entries: readonly BroadcastPlay[]; nowMs: number | null };

const COLOR = new Map(AGENTS.map((a) => [a.id, a.color]));
const LABEL = new Map(AGENTS.map((a) => [a.id, a.id === "human" ? "手動・その他" : a.label]));
const duration = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((n) => String(n).padStart(2, "0")).join(":");
const ago = (at: number, nowMs: number | null) => {
  if (nowMs === null) return "--";
  const seconds = Math.max(0, Math.floor((nowMs - at) / 1000));
  return seconds < 60 ? `${seconds}秒前` : seconds < 3600 ? `${Math.floor(seconds / 60)}分前` : `${Math.floor(seconds / 3600)}時間前`;
};

function PlaybackIcon({ paused }: { paused: boolean }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paused ? <path d="m5 3 7 5-7 5Z" /> : <path d="M5 3v10M11 3v10" />}
  </svg>;
}

export function RoomBoard({ data, live, joinCta }: { data: RoomData; live: boolean; joinCta?: ReactNode }) {
  const model = useMemo(() => deriveBroadcast(data), [data]);
  const teams = useMemo(() => tallyTeams(data.players, data.plays), [data]);
  const [clock, setClock] = useState<Clock | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [playback, setPlayback] = useState<Playback>({ kind: "following" });
  useEffect(() => {
    const nowMs = Date.now();
    const deadlineMs = jstDeadlineForDay(nowMs);
    setClock({ nowMs, deadlineMs });
    const timer = setInterval(() => setClock({ nowMs: Date.now(), deadlineMs }), 1000);
    return () => clearInterval(timer);
  }, []);

  const paused = playback.kind === "paused";
  const feed = paused ? playback.entries : model.feed;
  const feedNow = paused ? playback.nowMs : clock?.nowMs ?? null;
  const entries = feed.filter((play) => filter === "all" || play.agent === filter).slice(0, 9);
  const topScore = model.builders[0]?.score ?? 0;
  const ranked = model.builders.slice(0, 6);
  const filters: { value: FeedFilter; label: string }[] = [{ value: "all", label: "すべて" },
    ...model.race.lanes.filter((l) => l.points).slice(0, 4).map((l) => ({ value: l.id, label: l.id === "human" ? "手動・その他" : l.label }))];
  const countdown = clock ? remainingSeconds(clock) : null;

  return <main className="room-broadcast">
    <header className="bzk-header">
      <div className="bzk-brand">
        <div className="bzk-brand-line">
          <h1>{BRAND.name.toUpperCase()} <span className="bzk-edition">#1J</span></h1>
          <span className={`bzk-status ${live ? "is-live" : "is-demo"}`}><i aria-hidden="true" />{live ? "ライブ" : "デモ"}</span>
        </div>
        <div className="bzk-header-bottom"><span className="bzk-room-label">東京会場の番付</span>{joinCta}<ViewToggle view="room" /></div>
      </div>
      <dl className="bzk-clocks">
        <div><dt>日本時間</dt><dd><time>{clock ? new Date(clock.nowMs).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }) : "--:--:--"}</time><span>JST</span></dd></div>
        <div><dt>18:00 JSTまで</dt><dd className="bzk-countdown">{countdown === null ? "--:--:--" : duration(countdown)}</dd></div>
      </dl>
      <JoinQr compact />
    </header>

    <div className="bzk-match"><TeamTugBar t={teams} /><AgentChips s={model.race} /></div>

    <div className="bzk-middle">
      <section className="bzk-rankings" aria-labelledby="stable-title">
        <div className="bzk-section-head"><h2 id="stable-title">参加者 <span lang="ja" className="bzk-jp" aria-hidden="true">番付</span></h2><span className="bzk-heading-note">得点</span></div>
        <ol className="bzk-rank-list">
          {ranked.map((b, index) => <li key={b.login} className="bzk-rank-row" style={{ transform: `translateY(${index * 100}%)`, ["--side" as string]: TEAM_COLORS[teamOf(b.login)] }}>
            <span className="bzk-rank"><b className="num">#{index + 1}</b><span>{TEAMS[teamOf(b.login)].replace("Team ", "")}</span></span>
            <span className="bzk-stable-name"><b>@{b.login}</b><span>活動 {b.plays}件</span></span>
            <span className="bzk-stable-score"><Count value={b.score} /></span>
            <span className="bzk-rank-track" aria-hidden="true"><i style={{ width: `${topScore ? b.score / topScore * 100 : 0}%` }} /></span>
          </li>)}
          {ranked.length === 0 && <li className="bzk-empty">最初のプッシュを待っています。QRコードから参加できます。</li>}
        </ol>
        <div className="bzk-rank-footer"><span>登録 {data.players.length}人 · 過去72時間</span><a href="/join#scoring">得点の仕組み</a></div>
      </section>

      <section className="bzk-plays" aria-labelledby="plays-title">
        <div className="bzk-section-head"><h2 id="plays-title">最新の活動</h2><button className="bzk-pause" type="button" aria-pressed={paused} onClick={() => setPlayback(paused ? { kind: "following" } : { kind: "paused", entries: model.feed, nowMs: clock?.nowMs ?? null })}><PlaybackIcon paused={paused} />{paused ? "更新を再開" : "更新を一時停止"}</button></div>
        <div className="bzk-feed-tools"><div className="bzk-filters" role="group" aria-label="エージェントで活動を絞り込む">{filters.map(({ value, label }) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><span className="bzk-feed-status">{paused ? "更新を一時停止中" : live ? "ライブ更新中" : "デモの活動"}</span></div>
        <ul className="bzk-play-list" aria-label={paused ? "一時停止中の活動" : "最近の活動"}>
          {entries.map((play) => <li key={play.id} style={{ ["--side" as string]: COLOR.get(play.agent) }}>
            <span className="bzk-play-side"><i aria-hidden="true" /><span className="bzk-sr-only">{LABEL.get(play.agent)}</span></span>
            <div className="bzk-play-copy"><div><b>@{play.login}</b><span className="bzk-play-kind">{play.kind === "push" ? "プッシュ" : play.kind === "pr_merged" ? "PRマージ" : "リリース"}</span></div><span className="bzk-play-label">{play.private ? "非公開リポジトリ" : play.label} に{PLAY_VERB[play.kind]}</span></div>
            <a className="bzk-play-points" href="/join#scoring" aria-label={`${play.points}点の得点ルールを見る`}>+{play.points}</a>
            <time className="bzk-play-age" dateTime={new Date(play.at).toISOString()}>{ago(play.at, feedNow)}</time>
          </li>)}
          {entries.length === 0 && <li className="bzk-empty">{feed.length ? "このエージェントの活動はまだありません。" : "最初のプッシュを待っています。QRコードから参加できます。"}</li>}
        </ul>
        <p className="bzk-feed-note">非公開の活動も得点に加算され、<span>非公開リポジトリ</span>と表示されます。</p>
      </section>
    </div>

    <CommentaryTicker text={model.commentary} />
  </main>;
}
