"use client";
import dynamic from "next/dynamic";
import { ProductHeader } from "@/components/ProductHeader";
import { POINTS, MAX_COMMITS_PER_PUSH, MAX_PUSH_POINTS_PER_HOUR, releasePoints } from "@/lib/scoring";
import { hasConvex } from "@/lib/convex";
import "@/app/product.css";

const JoinLive = dynamic(() => import("@/components/JoinLive"), { ssr: false, loading: () => <p className="product-empty" role="status">参加の準備を読み込み中…</p> });
const icon = <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.23 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>;
export default function Join() {
  return <main className="product-page join-page"><ProductHeader current="join" />
    <div className="product-intro"><h1>番付に参加しよう。</h1><p>GitHubで参加して、使っているエージェントを選びましょう。連携する範囲は自分で選べます。任意の設定は後からでも進められます。</p></div>
    {hasConvex() ? <JoinLive icon={icon} /> : <section className="product-panel"><h2>現在ログインできません</h2><p>現在、GitHubでのログインを一時的に利用できません。公開活動のサンプルは閲覧できます。</p><a className="product-button" href="/global">世界の活動を見る</a></section>}
    <section className="product-panel product-scoring" aria-labelledby="scoring"><h2 id="scoring">会場の得点ルール</h2><dl>
      <div><dt>プッシュ</dt><dd><strong>+{POINTS.push}</strong> を実際のコミットごとに加算。1回のプッシュは最大{MAX_COMMITS_PER_PUSH}コミット、直近1時間は最大{MAX_PUSH_POINTS_PER_HOUR}点。</dd></div>
      <div><dt>PRマージ</dt><dd><strong>+{POINTS.pr_merged}</strong>点。リポジトリのスターが10以上ならさらに2点、50以上なら5点。</dd></div>
      <div><dt>リリース</dt><dd><strong>+{POINTS.release}</strong>点。プレリリースは{releasePoints(true)}点。</dd></div>
    </dl><p className="product-muted">ボット、マージコミット、空のプッシュは得点になりません。会場では過去72時間の活動を表示します。</p></section>
  </main>;
}
