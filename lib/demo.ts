import type { RoomData } from "@/components/RoomBoard";

// Demo mode: a room of fake signed-up builders, including private-repo plays, so the board works with no keys.
const PEOPLE = ["raitoxlol", "sakura-dev", "kenji", "mika", "yuki", "arjun", "lena", "noah", "chloe", "tomo", "hana", "ren", "aoi", "sora", "daichi", "mei"];
const REPOS = ["grok-crew", "banzuke", "voice-agent", "everett", "tokyo-bot", "pstack"];
const MSGS = ["feat: crew handoff", "fix: rate limit", "ship v0.2", "perf: cache board", "add voice commentary"];
let n = 0;
const r = (k: number) => Math.floor(Math.random() * k);

export function demoPlay(at = Date.now()): RoomData["plays"][number] {
  const i = r(PEOPLE.length), roll = Math.random();
  const kind = roll > 0.95 ? "release" : roll > 0.82 ? "pr_merged" : "push";
  const priv = Math.random() < 0.3;
  return {
    id: `demo${n++}`, login: PEOPLE[i], team: i % 6, kind, at, private: priv,
    points: kind === "release" ? 25 : kind === "pr_merged" ? 10 : 1 + r(5),
    repo: priv ? "" : `${PEOPLE[i]}/${REPOS[r(REPOS.length)]}`, summary: priv ? "" : MSGS[r(MSGS.length)],
  };
}
export function demoRoom(): RoomData {
  const now = Date.now();
  return {
    players: PEOPLE.map((login, i) => ({ login, avatar: "", team: i % 6 })),
    plays: Array.from({ length: 140 }, (_, k) => demoPlay(now - k * (72 * 3600_000 / 140) * Math.random())).sort((a, b) => b.at - a.at),
  };
}
