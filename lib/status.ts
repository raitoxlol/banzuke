import { TEAMS, teamMap, tallyTeams } from "./teams";
import type { Agent } from "./agents";

export const BOARD_URL = "https://banzuke.raitox.tech";
type Player = { login: string; side?: number | null; answers?: { tool?: string } | null };
type Play = { id: string; login: string; kind: string; points: number; at: number; private: boolean; repo: string; summary?: string; agent?: Agent };
export interface Snapshot { players: Player[]; plays: Play[] }

/** Ranked standings: every joined player, by 72h points desc then login. */
export function standings({ players, plays }: Snapshot) {
  const pts = new Map<string, number>();
  for (const p of players) pts.set(p.login, 0);
  for (const p of plays) pts.set(p.login, (pts.get(p.login) ?? 0) + p.points);
  const tOf = teamMap(players);
  return [...pts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([login, points], i) => ({ rank: i + 1, login, team: TEAMS[tOf(login)], points }));
}

/** Public status for one login, or null. Never exposes private repo names or any commit text. */
export function statusFor(snap: Snapshot, login: string) {
  const rows = standings(snap);
  const i = rows.findIndex((r) => r.login.toLowerCase() === login.toLowerCase());
  if (i < 0) return null;
  const me = rows[i];
  const recentPlays = snap.plays.filter((p) => p.login === me.login).sort((a, b) => b.at - a.at).slice(0, 10)
    .map((p) => ({ at: new Date(p.at).toISOString(), kind: p.kind, points: p.points,
      repo: p.private || !p.repo ? "private" : p.repo }));
  const pick = (r?: { login: string; points: number }) => (r ? { login: r.login, points: r.points } : null);
  return { login: me.login, team: me.team, rank: me.rank, of: rows.length, points: me.points, last72hPoints: me.points,
    recentPlays, ahead: pick(rows[i - 1]), behind: pick(rows[i + 1]), boardUrl: BOARD_URL };
}

export function boardFor(snap: Snapshot) {
  const t = tallyTeams(snap.players, snap.plays);
  return { teams: t.sides.map(({ name, points, builders }) => ({ name, points, builders })), leadingTeam: t.leader === null ? null : t.sides[t.leader].name,
    top: standings(snap).slice(0, 10),
    updatedAt: new Date().toISOString(), boardUrl: BOARD_URL };
}

export const API_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=15, s-maxage=15" };
