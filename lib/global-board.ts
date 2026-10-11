import { type Play, parsePlay } from "./firehose";
import { MAX_PUSH_POINTS_PER_HOUR } from "./scoring";

export const OBSERVED_HOUR = 3_600_000;
export const CREATION_HORIZON = 7 * 24 * OBSERVED_HOUR;
export const SAMPLE_CAPACITY = 20_000;
export const DELIVERY_LIMIT = 600;
export type SampleStatus = "starting" | "live" | "rate_limited" | "error";
export type PublicSample = {
  status: SampleStatus; plays: Play[]; nextPollMs: number;
  lastSuccessAt: number | null; capacityReached: boolean;
};

export function parsePublicSample(input: unknown): PublicSample | null {
  if (!input || typeof input !== "object" || !("status" in input) || !("plays" in input)
    || !("nextPollMs" in input) || !("lastSuccessAt" in input) || !("capacityReached" in input)) return null;
  const { status, plays, nextPollMs, lastSuccessAt, capacityReached } = input;
  if ((status !== "starting" && status !== "live" && status !== "rate_limited" && status !== "error")
    || !Array.isArray(plays) || plays.length > DELIVERY_LIMIT
    || typeof nextPollMs !== "number" || !Number.isFinite(nextPollMs) || nextPollMs < 0
    || (lastSuccessAt !== null && (typeof lastSuccessAt !== "number" || !Number.isFinite(lastSuccessAt) || lastSuccessAt < 0))
    || typeof capacityReached !== "boolean") return null;
  const parsed = plays.map(parsePlay);
  if (parsed.some((p) => p === null)) return null;
  return { status, plays: parsed.filter((p): p is Play => p !== null), nextPollMs, lastSuccessAt, capacityReached };
}

export class PublicCollection {
  readonly plays = new Map<string, Play>();
  private readonly seen = new Map<string, number>();
  capacityReached = false;
  constructor(private readonly capacity = SAMPLE_CAPACITY) {}
  prune(now: number) {
    for (const [id, play] of this.plays) if (play.at <= now - OBSERVED_HOUR) this.plays.delete(id);
    for (const [id, until] of this.seen) if (until <= now) this.seen.delete(id);
    if (this.seen.size < this.capacity) this.capacityReached = false;
  }
  admit(play: Play, now: number) {
    this.prune(now);
    if (play.created <= now - CREATION_HORIZON || play.created > now + 60_000 || this.seen.has(play.id)) return false;
    if (this.seen.size >= this.capacity) { this.capacityReached = true; return false; }
    const observed = { ...play, at: now };
    this.seen.set(play.id, Math.max(play.created + CREATION_HORIZON, now + OBSERVED_HOUR));
    this.plays.set(play.id, observed);
    return true;
  }
  snapshot(now: number) {
    this.prune(now);
    return [...this.plays.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  }
}

export function publicBoard(plays: readonly Play[], now: number) {
  const unique = new Map<string, Play>();
  for (const p of plays) {
    if (p.at <= now - OBSERVED_HOUR || p.at > now) continue;
    const prior = unique.get(p.id);
    if (!prior || p.at < prior.at || (p.at === prior.at && JSON.stringify(p) < JSON.stringify(prior))) unique.set(p.id, p);
  }
  const chronological = [...unique.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const builders = new Map<string, { login: string; points: number; plays: number; push: number }>();
  const credited = chronological.map((p) => {
    const login = p.login.toLowerCase();
    const row = builders.get(login) ?? { login, points: 0, plays: 0, push: 0 };
    const points = p.kind === "push" ? Math.min(p.points, Math.max(0, MAX_PUSH_POINTS_PER_HOUR - row.push)) : p.points;
    if (p.kind === "push") row.push += points;
    row.points += points; row.plays++; builders.set(login, row);
    return { ...p, login, points, rawPoints: p.points };
  });
  const ranked = [...builders.values()].filter((b) => b.points > 0).sort((a, b) => b.points - a.points || a.login.localeCompare(b.login));
  return { builders: ranked, plays: credited.reverse(), total: ranked.reduce((sum, b) => sum + b.points, 0) };
}

export function publicOvertake(previous: readonly Play[], incoming: readonly Play[], now: number): { up: string; down: string } | null {
  const before = publicBoard(previous, now), after = publicBoard(incoming, now);
  const down = before.builders[0], up = after.builders[0];
  if (!down || !up || up.login === down.login || !before.builders.some((b) => b.login === up.login)) return null;
  if (before.builders[1]?.points === down.points || after.builders[1]?.points === up.points) return null;
  const oldIds = new Set(before.plays.map((p) => p.id)), newIds = new Set(after.plays.map((p) => p.id));
  if (before.plays.some((p) => !newIds.has(p.id))) return null;
  if (!after.plays.some((p) => p.login === up.login && p.points > 0 && !oldIds.has(p.id))) return null;
  const priorUp = before.builders.find((b) => b.login === up.login);
  const currentDown = after.builders.find((b) => b.login === down.login);
  if (!priorUp || !currentDown || priorUp.points >= down.points || up.points <= currentDown.points) return null;
  return { up: up.login, down: down.login };
}
