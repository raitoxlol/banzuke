import { playLabel } from "./ingest";
import { ROOM_STABLES, type Answers } from "./quiz";
import { sideOf, tallySides, type Side, type Sides } from "./sides";

export interface RoomData {
  players: { login: string; avatar: string; team: number; answers?: Answers }[];
  plays: { id: string; login: string; team: number; kind: "push" | "pr_merged" | "release"; points: number; at: number; private: boolean; repo: string; summary: string }[];
}

/** Display entries intentionally have no raw repo or summary fields. */
export interface BroadcastPlay {
  readonly id: string;
  readonly login: string;
  readonly side: Side;
  readonly team: number;
  readonly kind: RoomData["plays"][number]["kind"];
  readonly points: number;
  readonly at: number;
  readonly private: boolean;
  readonly label: string;
}

export interface BroadcastStable {
  readonly id: number;
  readonly name: string;
  readonly jp: string;
  readonly color: string;
  readonly score: number;
  readonly builders: number;
}

export interface BroadcastModel {
  readonly sides: Sides;
  readonly stables: readonly BroadcastStable[];
  readonly feed: readonly BroadcastPlay[];
  readonly commentary: string;
}

export const PLAY_VERB = { push: "pushed to", pr_merged: "merged in", release: "released" } satisfies Record<BroadcastPlay["kind"], string>;

/** One snapshot, recorded points, current registered membership, and safe display text. */
export function deriveBroadcast(data: RoomData): BroadcastModel {
  const ordered = [...data.plays].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const players = new Map(data.players.map((p) => [p.login, p]));
  const builders = new Map(data.players.map((p) => [p.login, { team: p.team, score: 0 }]));
  for (const play of ordered) {
    const builder = builders.get(play.login) ?? { team: play.team, score: 0 };
    builder.score += play.points;
    builders.set(play.login, builder);
  }
  const stables = ROOM_STABLES.map((stable) => ({ ...stable, score: 0, builders: 0 }));
  for (const builder of builders.values()) {
    const stable = stables.find((s) => s.id === builder.team);
    if (stable) { stable.score += builder.score; stable.builders++; }
  }
  stables.sort((a, b) => b.score - a.score || a.id - b.id);
  const feed: BroadcastPlay[] = ordered.map((play) => ({
    id: play.id, login: play.login, side: sideOf(players.get(play.login) ?? play),
    team: players.get(play.login)?.team ?? play.team, kind: play.kind,
    points: play.points, at: play.at, private: play.private, label: playLabel(play),
  }));
  const latest = feed[0];
  const stable = latest && stables.find((s) => s.id === latest.team);
  const commentary = latest
    ? `@${latest.login} ${PLAY_VERB[latest.kind]} ${latest.label}. +${latest.points} for ${stable?.name ?? (latest.side === "claude" ? "Claude Code" : "Codex")}. ${stables[0]?.name ?? "The stables"} hold the top of the banzuke.`
    : "Join the match. Sign in with GitHub. Your last 72 hours count on the board.";
  return { sides: tallySides(data.players, ordered), stables, feed, commentary };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Today's 18:00 JST, independent of the browser or server's local timezone. */
export function jstDeadlineForDay(nowMs: number): number {
  return Math.floor((nowMs + JST_OFFSET_MS) / DAY_MS) * DAY_MS + 18 * 60 * 60 * 1000 - JST_OFFSET_MS;
}

export function remainingSeconds({ nowMs, deadlineMs }: { nowMs: number; deadlineMs: number }): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
