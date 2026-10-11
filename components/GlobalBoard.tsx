"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductHeader } from "@/components/ProductHeader";
import { type Play, toPlay } from "@/lib/firehose";
import { demoRaw } from "@/lib/demo-global";
import { CREATION_HORIZON, DELIVERY_LIMIT, OBSERVED_HOUR, parsePublicSample, publicBoard, publicOvertake, type PublicSample } from "@/lib/global-board";

const VERB = { push: "プッシュしました", pr_merged: "PRをマージしました", release: "リリースしました", star: "スターを付けました" } as const;
const summaryLabel = (play: Play) => play.kind === "star" ? "スターを追加" : play.kind === "push" ? play.summary.startsWith("to ") ? `ブランチ：${play.summary.slice(3)}` : "プッシュ" : play.summary;
function ago(at: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return seconds < 60 ? `${seconds}秒` : seconds < 3600 ? `${Math.floor(seconds / 60)}分` : `${Math.floor(seconds / 3600)}時間`;
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
        if (!response.ok) throw new Error("公開サンプルを取得できません");
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
  const status = mode === "demo" ? "デモのサンプル" : { starting: "GitHubに接続中", live: "公開サンプルを取得済み", rate_limited: "GitHubのリクエスト上限に到達", error: "公開サンプルを取得できません" }[sample.status];
  return <main className="product-page global-page"><ProductHeader current="global" />
    <div className="product-intro"><h1>世界の開発者を番付で見る。</h1><p>GitHubの公開活動の一部を、時間差で表示します。ログインは不要です。</p></div>
    <section className="global-status product-panel" aria-label="サンプルの取得状況">
      <div><p className={`source-state ${mode === "demo" || sample.status === "rate_limited" || sample.status === "error" ? "is-warning" : ""}`} role="status"><i aria-hidden="true" />{status}</p>
        <p className="product-muted">{mode === "demo" ? "サンプル用の活動を表示しています。このページはGitHubから取得していません。" : "直近1時間に取得した最新イベントを最大600件表示します。GitHubで実際に発生した時刻は、それより古い場合があります。"}</p>
        {mode !== "demo" && sample.lastSuccessAt && <p className="product-muted">最終取得 {new Date(sample.lastSuccessAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST"}</p>}
        {mode !== "demo" && sample.status === "rate_limited" && <p className="product-notice">次の取得まで約{Math.max(1, Math.ceil((nextCheckAt - now) / 60_000))}分です。取得済みの活動は表示期間が終わるまで残ります。</p>}
        {mode !== "demo" && sample.status === "error" && <p className="product-notice">更新に失敗しました。取得済みの活動は表示期間が終わるまで残ります。</p>}
        {sample.capacityReached && <p className="product-notice">サンプルの件数が上限に達しました。空きができるまで新しいイベントの取り込みを待ちます。</p>}
      </div>
      <dl className="global-totals"><div><dt>得点</dt><dd>{view.total.toLocaleString("ja-JP")}</dd></div><div><dt>参加者</dt><dd>{view.builders.length.toLocaleString("ja-JP")}</dd></div><div><dt>活動</dt><dd>{view.plays.length.toLocaleString("ja-JP")}</dd></div></dl>
    </section>
    <div className="global-lists">
      <section className="product-panel global-ranks" aria-labelledby="global-rank-title">
        <div className="global-section-heading"><h2 id="global-rank-title">参加者ランキング <span lang="ja">番付</span></h2><span className="product-muted">上位20人</span></div>
        {overtake && <p className="global-overtake" role="status"><span lang="ja">逆転</span> @{overtake.up} が @{overtake.down} を抜いて首位に。</p>}
        {view.builders.length ? <table><thead><tr><th scope="col">順位</th><th scope="col">参加者</th><th scope="col" className="points-column">得点</th></tr></thead><tbody>{view.builders.slice(0, 20).map((builder, index) => <tr key={builder.login}><td className="rank-number">{index + 1}</td><th scope="row"><a href={`https://github.com/${builder.login}`} target="_blank" rel="noreferrer" title={`@${builder.login}`}>@{builder.login}</a><small>活動 {builder.plays}件</small></th><td className="rank-points">{builder.points.toLocaleString("ja-JP")}</td></tr>)}</tbody></table> : <div className="product-empty"><h3>{sample.status === "starting" ? "公開サンプルを待っています" : "このサンプルには得点対象の活動がありません"}</h3><p>{sample.status === "starting" ? "最初のGitHubデータを取得中です。" : "GitHubの公開フィードは全活動の一部を時間差で配信します。表示が空でも、開発が止まっているわけではありません。"}</p></div>}
        <p className="global-footnote product-muted">プッシュはサンプル1件あたり最大3点、取得した1時間内で1人あたり最大12点です。PRマージは10〜15点、リリースは25点、プレリリースは13点。スターは表示されますが得点にはなりません。</p>
      </section>
      <section className="product-panel global-feed" aria-labelledby="global-feed-title">
        <div className="global-section-heading"><h2 id="global-feed-title">最新の公開活動</h2><button className="secondary" aria-pressed={paused !== null} onClick={() => setPaused(paused ? null : { plays: view.plays, now })}>{paused ? "更新を再開" : "更新を一時停止"}</button></div>
        {paused && <p className="product-notice">活動一覧の更新を一時停止しています。活動と経過時間の表示は固定され、ランキングは更新を続けます。</p>}
        {shownPlays.length ? <ol className="public-play-list">{shownPlays.slice(0, 50).map((play) => <li key={play.id}>
          <div className="public-play-copy"><p><a href={`https://github.com/${play.login}`} target="_blank" rel="noreferrer" title={`@${play.login}`}>@{play.login}</a> <span>{VERB[play.kind]}</span></p><a className="play-repo" href={`https://github.com/${play.repo}`} target="_blank" rel="noreferrer" title={play.repo}>{play.repo}</a><p className="play-summary" title={summaryLabel(play)}>{summaryLabel(play)}</p><small>取得 {ago(play.at, feedNow)}前 · GitHubでの発生 {ago(play.created, feedNow)}前</small></div>
          <div className="public-play-points"><b>+{play.points}</b>{play.points < play.rawPoints && <small>プッシュ上限</small>}</div>
        </li>)}</ol> : <div className="product-empty"><h3>表示できる最近の活動がありません</h3><p>取得に成功すると、新しい活動がここに表示されます。</p></div>}
        <p className="global-footnote product-muted">最新の活動を最大50件表示します。過去{CREATION_HORIZON / OBSERVED_HOUR / 24}日以内の公開イベントだけを取り込みます。サーバーが再起動すると履歴はリセットされます。</p>
      </section>
    </div>
    <footer className="global-footer"><p className="product-muted">会場の得点は別途、過去72時間で集計します。参加すると自分の活動を記録できます。</p><a className="product-button" href="/join">会場に参加する</a>{mode !== "demo" && <button className="secondary" onClick={retry}>公開サンプルを再取得</button>}{mode === "demo" && <a className="product-button secondary" href="/global">実際の公開サンプルを見る</a>}</footer>
  </main>;
}
