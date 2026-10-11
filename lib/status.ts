import { playAgent, playerAgent, tallyRace, type Agent } from "./agents";

export const BOARD_URL = "https://banzuke.raitox.tech";
type Player = { login: string; answers?: { tool?: string } | null };
type Play = { id: string; login: string; kind: string; points: number; at: number; private: boolean; repo: string; summary?: string; agent?: Agent };
export interface Snapshot { players: Player[]; plays: Play[] }

/** Ranked standings: every joined player, by 72h points desc then login. */
export function standings({ players, plays }: Snapshot) {
  const pts = new Map<string, number>();
  for (const p of players) pts.set(p.login, 0);
  for (const p of plays) pts.set(p.login, (pts.get(p.login) ?? 0) + p.points);
  const by = new Map(players.map((p) => [p.login, p]));
  return [...pts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([login, points], i) => ({ rank: i + 1, login, points, agent: playerAgent(by.get(login) as any) }));
}

/** Public status for one login, or null. Never exposes private repo names or any commit text. */
export function statusFor(snap: Snapshot, login: string) {
  const rows = standings(snap);
  const i = rows.findIndex((r) => r.login.toLowerCase() === login.toLowerCase());
  if (i < 0) return null;
  const me = rows[i];
  const player = snap.players.find((p) => p.login === me.login);
  const recentPlays = snap.plays.filter((p) => p.login === me.login).sort((a, b) => b.at - a.at).slice(0, 10)
    .map((p) => ({ at: new Date(p.at).toISOString(), kind: p.kind, points: p.points, agent: playAgent(p, player as any),
      repo: p.private || !p.repo ? "private" : p.repo }));
  const pick = (r?: { login: string; points: number }) => (r ? { login: r.login, points: r.points } : null);
  return { login: me.login, rank: me.rank, of: rows.length, points: me.points, agent: me.agent, last72hPoints: me.points,
    recentPlays, ahead: pick(rows[i - 1]), behind: pick(rows[i + 1]), boardUrl: BOARD_URL };
}

export function boardFor(snap: Snapshot) {
  const race = tallyRace(snap.players as any, snap.plays);
  return { top: standings(snap).slice(0, 10), race: race.lanes.map(({ id, label, points, builders }) => ({ agent: id, label, points, builders })),
    leader: race.leader, updatedAt: new Date().toISOString(), boardUrl: BOARD_URL };
}

export const API_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=15, s-maxage=15" };
