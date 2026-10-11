// Two teams per room. Names and membership are derived deterministically from ROOM_SEED + login (no stored state, no migration).
export const ROOM_SEED = "tokyo-2026-10-11";
const ADJ = ["Kumo", "Kaminari", "Sakura", "Tsunami", "Neon", "Ramen", "Shogun", "Mochi", "Tanuki", "Ninja", "Kitsune", "Daruma"];
const NOUN = ["Rockets", "Dragons", "Pandas", "Comets", "Tigers", "Owls", "Sharks", "Foxes", "Yeti", "Wolves"];
export const TEAM_COLORS = ["#3b82f6", "#f97316"] as const;

/** FNV-1a 32-bit. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function teamNames(seed = ROOM_SEED): [string, string] {
  const h = hash(seed), a = h % ADJ.length, n = (h >>> 8) % NOUN.length;
  let b = (a + 1 + ((h >>> 16) % (ADJ.length - 1))) % ADJ.length, m = (n + 1 + ((h >>> 24) % (NOUN.length - 1))) % NOUN.length;
  return [`Team ${ADJ[a]} ${NOUN[n]}`, `Team ${ADJ[b]} ${NOUN[m]}`];
}
export const TEAMS = teamNames();

export const teamOf = (login: string, seed = ROOM_SEED): 0 | 1 => (hash(`${seed}:${login.toLowerCase()}`) & 1) as 0 | 1;
export const teamName = (login: string) => TEAMS[teamOf(login)];

export interface TeamSide { id: 0 | 1; name: string; color: string; points: number; builders: number }
export interface TeamRace { sides: [TeamSide, TeamSide]; total: number; leader: 0 | 1 | null; last: { team: 0 | 1; at: number; id: string } | null }

export function tallyTeams(players: { login: string }[], plays: { id: string; login: string; points: number; at: number }[]): TeamRace {
  const sides = TEAMS.map((name, id) => ({ id, name, color: TEAM_COLORS[id], points: 0, builders: new Set<string>() }));
  let last: TeamRace["last"] = null, total = 0;
  for (const p of players) sides[teamOf(p.login)].builders.add(p.login);
  for (const p of plays) {
    const t = teamOf(p.login); sides[t].points += p.points; sides[t].builders.add(p.login); total += p.points;
    if (!last || p.at > last.at) last = { team: t, at: p.at, id: p.id };
  }
  const out = sides.map((s) => ({ ...s, builders: s.builders.size })) as [TeamSide, TeamSide];
  const leader = out[0].points === out[1].points ? null : out[0].points > out[1].points ? 0 : 1;
  return { sides: out, total, leader, last };
}
