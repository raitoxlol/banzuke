"use client";
import dynamic from "next/dynamic";
import { ProductHeader } from "@/components/ProductHeader";
import { POINTS, MAX_COMMITS_PER_PUSH, MAX_PUSH_POINTS_PER_HOUR, releasePoints } from "@/lib/scoring";
import { hasConvex } from "@/lib/convex";
import "@/app/product.css";

const JoinLive = dynamic(() => import("@/components/JoinLive"), { ssr: false, loading: () => <p className="product-empty" role="status">Loading onboarding…</p> });
const icon = <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.23 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>;
export default function Join() {
  return <main className="product-page join-page"><ProductHeader current="join" />
    <div className="product-intro"><h1>Get on the board.</h1><p>Join with GitHub. Pick your agent, then choose how much to connect. Every optional step can wait.</p></div>
    {hasConvex() ? <JoinLive icon={icon} /> : <section className="product-panel"><h2>Sign-in is unavailable</h2><p>GitHub sign-in is temporarily unavailable here. You can still watch the public sample.</p><a className="product-button" href="/global">Spectate global activity</a></section>}
    <section className="product-panel product-scoring" aria-labelledby="scoring"><h2 id="scoring">How room points count</h2><dl>
      <div><dt>Push</dt><dd><strong>+{POINTS.push}</strong> per real commit, up to {MAX_COMMITS_PER_PUSH} per push and {MAX_PUSH_POINTS_PER_HOUR} per rolling hour.</dd></div>
      <div><dt>Merged PR</dt><dd><strong>+{POINTS.pr_merged}</strong>, plus 2 at 10 repo stars or 5 at 50.</dd></div>
      <div><dt>Release</dt><dd><strong>+{POINTS.release}</strong>, or {releasePoints(true)} for a prerelease.</dd></div>
    </dl><p className="product-muted">Bots, merge commits, and empty pushes don't score. The room shows the last 72 hours of activity.</p></section>
  </main>;
}
