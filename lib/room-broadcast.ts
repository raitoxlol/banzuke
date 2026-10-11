import { playLabel } from "./ingest";
import type { Answers } from "./quiz";
import { agentLabel, playAgent, playerAgent, tallyRace, type Agent, type Race } from "./agents";

export interface RoomData {
  players: { login: string; avatar: string; team: number; answers?: Answers }[];
  plays: { id: string; login: string; team: number; kind: "push" | "pr_merged" | "release"; points: number; at: number; private: boolean; repo: string; summary: string; agent?: Agent }[];
}

/** Display entries intentionally have no raw repo or summary fields. */
export interface BroadcastPlay {
  readonly id: string;
  readonly login: string;
  readonly agent: Agent;
  readonly kind: RoomData["plays"][number]["kind"];
  readonly points: number;
  readonly at: number;
  readonly private: boolean;
  readonly label: string;
}

export interface BroadcastBuilder {
  readonly login: string;
  readonly avatar: string;
  readonly agent: Agent; // lane they scored most for, else their pick
  readonly score: number;
  readonly plays: number;
}

export interface BroadcastModel {
  readonly race: Race;
  readonly builders: readonly BroadcastBuilder[];
  readonly feed: readonly BroadcastPlay[];
  readonly commentary: string;
}

export const PLAY_VERB = { push: "pushed to", pr_merged: "merged in", release: "released" } satisfies Record<BroadcastPlay["kind"], string>;

/** One snapshot of real data: agent race, builder ranking, and safe display text. */
export function deriveBroadcast(data: RoomData): BroadcastModel {
  const ordered = [...data.plays].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const players = new Map(data.players.map((p) => [p.login, p]));
  const feed: BroadcastPlay[] = ordered.map((play) => ({
    id: play.id, login: play.login, agent: playAgent(play, players.get(play.login)), kind: play.kind,
    points: play.points, at: play.at, private: play.private, label: playLabel(play),
  }));
  const tally = new Map<string, { score: number; plays: number; by: Map<Agent, number> }>();
  for (const p of data.players) tally.set(p.login, { score: 0, plays: 0, by: new Map() });
  for (const f of feed) {
    const t = tally.get(f.login) ?? { score: 0, plays: 0, by: new Map() };
    t.score += f.points; t.plays++; t.by.set(f.agent, (t.by.get(f.agent) ?? 0) + f.points); tally.set(f.login, t);
  }
  const builders = [...tally].map(([login, t]) => {
    const top = [...t.by].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { login, avatar: players.get(login)?.avatar ?? "", agent: top ?? playerAgent(players.get(login)), score: t.score, plays: t.plays };
  }).sort((a, b) => b.score - a.score || a.login.localeCompare(b.login));
  const race = tallyRace(data.players, ordered);
  const latest = feed[0];
  const lead = race.leader ? `${agentLabel(race.leader)} leads the race with ${race.lanes[0].points}.` : race.total ? "Dead heat at the top." : "";
  const commentary = latest
    ? `@${latest.login} ${PLAY_VERB[latest.kind]} ${latest.label}. +${latest.points} for ${agentLabel(latest.agent)}. ${lead}`.trim()
    : "Waiting for the first push. Scan to join: sign in with GitHub and your last 72 hours count.";
  return { race, builders, feed, commentary };
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
