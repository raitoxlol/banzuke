import type { PulseEvent, Team } from "./supabase";

// Demo mode: fake plays so the broadcast looks alive before Supabase is wired.
export const DEMO_TEAMS: Team[] = [
  { id: 1, name: "Team Kichijoji", color: "#ff4d6d", score: 0 },
  { id: 2, name: "Team Shibuya", color: "#4dabf7", score: 0 },
  { id: 3, name: "Team Akiba", color: "#ffd43b", score: 0 },
  { id: 4, name: "Team Shimokita", color: "#69db7c", score: 0 },
];
const PLAYERS = [
  ["raitox", 1, 35.70, 139.58], ["sakura-dev", 2, 35.66, 139.70], ["kenji", 3, 35.70, 139.77],
  ["mika", 4, 35.66, 139.67], ["tony", 1, 41.59, -93.62], ["lena", 2, 52.52, 13.40],
  ["arjun", 3, 12.97, 77.59], ["sam", 4, 37.77, -122.42], ["yuki", 2, 34.69, 135.50],
] as const;
const MSGS = ["fix: handoff race", "feat: live map pings", "ship v0.2", "add team draft", "perf: cache scores", "docs: setup guide"];
let id = 1;

export function fakeEvent(): PulseEvent {
  const [login, team, lat, lng] = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
  const roll = Math.random();
  const kind = roll > 0.95 ? "release" : roll > 0.8 ? "pr_merged" : "push";
  const points = kind === "release" ? 25 : kind === "pr_merged" ? 10 : 1 + Math.floor(Math.random() * 4);
  return {
    id: id++, created_at: new Date().toISOString(), kind, points, player_login: login, team_id: team,
    repo: `${login}/side-project`, summary: MSGS[Math.floor(Math.random() * MSGS.length)],
    lat: lat + (Math.random() - 0.5) * 0.2, lng: lng + (Math.random() - 0.5) * 0.2,
  };
}
