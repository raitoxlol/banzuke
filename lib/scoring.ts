// Pulse League scoring. Pure functions so they are easy to test and tune.

export type ScoreKind = "push" | "pr_merged" | "release";

export const POINTS: Record<ScoreKind, number> = {
  push: 1, // per counted commit
  pr_merged: 10,
  release: 25,
};

/** Max commits that score per push event (stops 500-commit dumps). */
export const MAX_COMMITS_PER_PUSH = 5;
/** Max push points a player can earn per rolling hour. */
export const MAX_PUSH_POINTS_PER_HOUR = 12;

export interface Commit {
  id: string;
  message: string;
  distinct?: boolean;
  author?: { email?: string; username?: string };
  added?: string[];
  removed?: string[];
  modified?: string[];
}

const BOT_RE = /\[bot\]$|^dependabot|^renovate|github-actions/i;
const NOISE_RE = /^(merge (branch|pull request)|wip$|\.+$|update readme\.md$)/i;

/** Commits that should count: distinct, not bots, touch files, not noise. */
export function countableCommits(commits: Commit[]): Commit[] {
  const seen = new Set<string>();
  return commits.filter((c) => {
    if (c.distinct === false) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    const who = c.author?.username ?? c.author?.email ?? "";
    if (BOT_RE.test(who)) return false;
    const files = (c.added?.length ?? 0) + (c.removed?.length ?? 0) + (c.modified?.length ?? 0);
    if (files === 0) return false;
    if (NOISE_RE.test(c.message.trim())) return false;
    return true;
  });
}

/** Points for a push, honouring the per-push and per-hour caps. */
export function pushPoints(commits: Commit[], pointsAlreadyThisHour: number): number {
  const n = Math.min(countableCommits(commits).length, MAX_COMMITS_PER_PUSH);
  const raw = n * POINTS.push;
  const room = Math.max(0, MAX_PUSH_POINTS_PER_HOUR - pointsAlreadyThisHour);
  return Math.min(raw, room);
}

/** Merged PRs score more when the repo has outside interest (stars). */
export function prPoints(stars: number): number {
  return POINTS.pr_merged + (stars >= 50 ? 5 : stars >= 10 ? 2 : 0);
}

export function releasePoints(prerelease: boolean): number {
  return prerelease ? Math.round(POINTS.release / 2) : POINTS.release;
}
