"use client";
import { BRAND } from "@/lib/brand";
import dynamic from "next/dynamic";
import { HEYA_STABLES } from "@/lib/firehose";
import { POINTS } from "@/lib/scoring";
import { hasConvex } from "@/lib/convex";

const JoinLive = dynamic(() => import("@/components/JoinLive"), { ssr: false });

const RULES = [
  ["Push", POINTS.push, "per real commit, up to 5 a push"],
  ["Merged PR", POINTS.pr_merged, "more if the repo has stars"],
  ["Release", POINTS.release, "half for a prerelease"],
] as const;

const ICON = <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.23 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>;

export default function Join() {
  const live = hasConvex();
  return (
    <main className="join-page">
      <a href="/" className="wordmark small-mark"><span className="dot" /><span>{BRAND.name.toUpperCase()}</span></a>
      <section className="join-card">
        <span className="jp-mark" aria-hidden>番付</span>
        <h1>Get on the board.</h1>
        <p className="lede">Sign in with GitHub. You get drafted into the smallest stable. Your public plays from the last 72 hours count right away, and repos with the GitHub App score live, private ones included, without showing their names.</p>

        {live ? <JoinLive icon={ICON} /> : <button disabled>{ICON}Sign in with GitHub</button>}
        {!live && <p className="muted small">Demo mode. Sign-in turns on once Convex is configured (see GO-LIVE.md).</p>}

        <h2>Scoring</h2>
        <ul className="rules">
          {RULES.map(([k, p, note]) => (
            <li key={k}><b className="num">+{p}</b><span>{k}</span><span className="muted small">{note}</span></li>
          ))}
        </ul>

        <h2>Stables</h2>
        <ul className="teams">
          {HEYA_STABLES.map((t) => <li key={t.id} style={{ ["--team" as string]: t.color }}>{t.name}</li>)}
        </ul>

        <p className="muted small">Then install the {BRAND.name} GitHub App on the repos you want to score in real time. Bots, merge commits and empty pushes don&apos;t score.</p>
      </section>
    </main>
  );
}
