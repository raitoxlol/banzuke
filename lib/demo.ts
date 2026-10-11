import type { PulseEvent, Team } from "./supabase";

// Demo mode: fake plays so the broadcast looks alive before Supabase is wired.
export const DEMO_TEAMS: Team[] = [
  { id: 1, name: "Kichijoji", color: "#E07A8A", score: 0 },
  { id: 2, name: "Shibuya", color: "#6FA8DC", score: 0 },
  { id: 3, name: "Akiba", color: "#D4B05C", score: 0 },
  { id: 4, name: "Shimokita", color: "#6FBF8E", score: 0 },
];
const PLAYERS = [
  ["raitox", 1, 35.70, 139.58], ["sakura-dev", 2, 35.66, 139.70], ["kenji", 3, 35.70, 139.77],
  ["mika", 4, 35.66, 139.67], ["tony", 1, 41.59, -93.62], ["lena", 2, 52.52, 13.40],
  ["arjun", 3, 12.97, 77.59], ["sam", 4, 37.77, -122.42], ["yuki", 2, 34.69, 135.50],
  ["ana", 1, -23.55, -46.63], ["noah", 3, 51.51, -0.13], ["chloe", 4, -33.87, 151.21],
] as const;
const MSGS = ["fix: handoff race", "feat: live map pings", "ship v0.2", "add team draft", "perf: cache scores", "docs: setup guide"];
let id = 1;

export function fakeEvent(at = Date.now()): PulseEvent {
  const [login, team, lat, lng] = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
  const roll = Math.random();
  const kind = roll > 0.95 ? "release" : roll > 0.8 ? "pr_merged" : "push";
  const points = kind === "release" ? 25 : kind === "pr_merged" ? 10 : 1 + Math.floor(Math.random() * 4);
  return {
    id: id++, created_at: new Date(at).toISOString(), kind, points, player_login: login, team_id: team,
    repo: `${login}/side-project`, summary: MSGS[Math.floor(Math.random() * MSGS.length)],
    lat: lat + (Math.random() - 0.5) * 0.2, lng: lng + (Math.random() - 0.5) * 0.2,
  };
}

/** The last `minutes` of plays, newest first, so the board opens mid-game. */
export function seedEvents(n: number, minutes: number): PulseEvent[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => fakeEvent(now - ((n - i) / n) * minutes * 60_000)).reverse();
}

/** One line in the commentator voice from BRAND.md: short, names player and team, facts only. */
export function demoLine(e: PulseEvent, team: string, leader: string | null): string | null {
  const lead = leader === team ? ` ${team} lead the board.` : "";
  if (e.kind === "release") return `Release from @${e.player_login}. ${team} jump ${e.points}.${lead}`;
  if (e.kind === "pr_merged") return `@${e.player_login} merges a PR for ${team}. ${e.points} points.${lead}`;
  return null;
}
