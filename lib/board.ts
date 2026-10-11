import { MAX_PUSH_POINTS_PER_HOUR } from "./scoring";
import type { Play, Stable } from "./firehose";

export const RANKS = [
  ["横綱", "Yokozuna"], ["大関", "Ozeki"], ["関脇", "Sekiwake"], ["小結", "Komusubi"],
] as const;
export function rankOf(i: number): [string, string] {
  return i < RANKS.length ? [RANKS[i][0], RANKS[i][1]] : ["前頭", `Maegashira ${i - RANKS.length + 1}`];
}

export interface Builder { login: string; avatar: string; team: number; score: number; plays: number; last: Play }
export interface TeamRow extends Stable { score: number; builders: number; plays: number }

/** Individual scores with the push cap from lib/scoring.ts; team score is the sum of its builders. */
export function tally(plays: Play[], stables: Stable[]) {
  const by = new Map<string, Builder & { push: number }>();
  for (const p of [...plays].sort((a, b) => a.at - b.at)) {
    const b = by.get(p.login) ?? { login: p.login, avatar: p.avatar, team: p.team, score: 0, plays: 0, push: 0, last: p };
    let pts = p.points;
    if (p.kind === "push") { pts = Math.min(pts, Math.max(0, MAX_PUSH_POINTS_PER_HOUR - b.push)); b.push += pts; }
    b.score += pts; b.plays++; b.last = p; b.team = p.team;
    by.set(p.login, b);
  }
  const builders = [...by.values()].filter((b) => b.score > 0).sort((a, b) => b.score - a.score || b.last.at - a.last.at);
  const teams: TeamRow[] = stables.map((s) => ({ ...s, score: 0, builders: 0, plays: 0 }));
  for (const b of builders) { const t = teams[b.team]; t.score += b.score; t.builders++; t.plays += b.plays; }
  teams.sort((a, b) => b.score - a.score);
  return { builders, teams };
}

const pick = <T,>(a: T[], seed: number) => a[seed % a.length];

/** Template commentary from a real play. Sports radio voice: short, names player and stable, facts only. */
export function callLine(p: Play, team: string, leader: string, seed: number): string {
  const repo = p.repo.split("/")[1] ?? p.repo;
  const lead = leader === team ? pick([` ${team} hold the top of the banzuke.`, ` ${team} still lead.`, ""], seed) : "";
  if (p.kind === "release") return pick([
    `Release! @${p.login} ships ${p.summary} of ${repo}. ${p.points} points to ${team}.`,
    `${p.summary} is out from ${repo}. @${p.login} hands ${team} ${p.points}.${lead}`,
  ], seed);
  if (p.kind === "pr_merged") return pick([
    `@${p.login} lands a merge in ${repo}. ${team} take ${p.points}.${lead}`,
    `Merged: ${p.summary.slice(0, 60)}. That's ${p.points} for ${team}.`,
  ], seed);
  if (p.kind === "star") return `A star for ${repo}. The crowd is watching @${p.login}.`;
  return pick([
    `@${p.login} pushes to ${repo}. ${team} keep the pressure on.`,
    `Another push from @${p.login}, ${team} stable.${lead}`,
    `${repo} moves. @${p.login} on the board for ${team}.`,
  ], seed);
}
