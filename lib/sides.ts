// Claude Code vs Codex tally for the tug-of-war. Pure: no Convex, no React.
import type { Answers } from "./quiz";

export type Side = "claude" | "codex";
export interface Sides { claude: number; codex: number; claudePlayers: number; codexPlayers: number; last: { side: Side; at: number; id: string } | null }

/** Player's side: quiz tool, else team parity (even = Claude Code). */
export const sideOf = (p: { team: number; answers?: Pick<Answers, "tool"> }): Side =>
  p.answers?.tool ?? (p.team % 2 === 0 ? "claude" : "codex");

/** plays may be any order; last = newest by `at`. */
export function tallySides(
  players: { login: string; team: number; answers?: Pick<Answers, "tool"> }[],
  plays: { id: string; login: string; team: number; points: number; at: number }[],
): Sides {
  const by = new Map(players.map((p) => [p.login, sideOf(p)]));
  const s: Sides = { claude: 0, codex: 0, claudePlayers: 0, codexPlayers: 0, last: null };
  for (const v of by.values()) v === "claude" ? s.claudePlayers++ : s.codexPlayers++;
  for (const p of plays) {
    const side = by.get(p.login) ?? sideOf(p);
    s[side] += p.points;
    if (!s.last || p.at > s.last.at) s.last = { side, at: p.at, id: p.id };
  }
  return s;
}
