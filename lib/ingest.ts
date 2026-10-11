// The one place plays become rows. Data shape (Convex table `plays`, see convex/schema.ts):
//   { login, team, kind, points, at, private, source, repo, summary, dedupeKey }
// Private repos: ONLY login, kind, points, time survive. repo/summary are blanked here, and
// convex/room.ts re-asserts it before every insert. dedupeKey is a one-way hash so it leaks nothing.
// Pure TS with no Node APIs so it runs in Convex's default runtime and in tests.
import { MAX_COMMITS_PER_PUSH, POINTS, prPoints, pushPoints, releasePoints, countableCommits, Commit } from "./scoring";

export type Kind = "push" | "pr_merged" | "release";
export interface Play {
  login: string; kind: Kind; points: number; at: string; private: boolean;
  repo: string; summary: string; key: string; source: "webhook" | "backfill";
}
export interface Row {
  login: string; team: number; kind: Kind; points: number; at: number;
  private: boolean; source: "webhook" | "backfill"; repo: string; summary: string; dedupeKey: string;
}

/** Two independent FNV-1a 32-bit passes = 64-bit one-way key. Plenty for dedupe, reveals nothing. */
export function hashKey(k: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < k.length; i++) {
    const c = k.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0; b ^= b >>> 15;
  }
  return a.toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** Strip-before-insert. A private play keeps login, kind, points and time; nothing else. */
export function toRow(p: Play, team: number): Row {
  return {
    login: p.login, team, kind: p.kind, points: p.points, at: Date.parse(p.at),
    private: p.private, source: p.source,
    repo: p.private ? "" : p.repo.slice(0, 140),
    summary: p.private ? "" : p.summary.slice(0, 140),
    dedupeKey: hashKey(p.key),
  };
}
/** Last line of defence, run inside the insert mutation. */
export function assertClean(r: Row) {
  if (r.private && (r.repo !== "" || r.summary !== "")) throw new Error("private play carries repo details");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Score a GitHub App webhook delivery. Keys match backfill keys so a push is never counted twice. */
export function fromWebhook(event: string | null, payload: any, pushPointsThisHour: number, now = new Date()): Play | null {
  const login: string | undefined = payload.sender?.login;
  if (!login || /\[bot\]$/.test(login)) return null;
  const priv = Boolean(payload.repository?.private);
  const repo: string = payload.repository?.full_name ?? "";
  const base = { login, at: now.toISOString(), private: priv, repo, source: "webhook" as const };
  if (event === "push") {
    const commits: Commit[] = payload.commits ?? [];
    const points = pushPoints(commits, pushPointsThisHour);
    if (!points) return null;
    return { ...base, kind: "push", points, summary: countableCommits(commits)[0]?.message.split("\n")[0] ?? "", key: `push:${payload.after}` };
  }
  if (event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged) {
    return { ...base, kind: "pr_merged", points: prPoints(payload.repository?.stargazers_count ?? 0),
      summary: `merged #${payload.pull_request.number}: ${payload.pull_request.title}`, key: `pr:${payload.repository?.id}#${payload.pull_request.number}` };
  }
  if (event === "release" && payload.action === "published") {
    return { ...base, kind: "release", points: releasePoints(Boolean(payload.release?.prerelease)),
      summary: `released ${payload.release?.tag_name}`, key: `rel:${payload.release?.id}` };
  }
  return null;
}

export const BACKFILL_HOURS = 72;

/**
 * Score /users/{login}/events/public for the last 72h. Pushes count real commits (size, capped 5 per push)
 * and the 12-per-hour push cap is applied per clock hour, same as live.
 */
export function fromPublicEvents(login: string, events: any[], now = Date.now()): Play[] {
  const since = now - BACKFILL_HOURS * 3600_000;
  const hour = new Map<number, number>();
  const out: Play[] = [];
  for (const e of [...events].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    const t = Date.parse(e.created_at);
    if (!(t >= since) || (e.actor?.login ?? "").toLowerCase() !== login.toLowerCase()) continue;
    const p = e.payload ?? {}, repo = e.repo?.name ?? "";
    const base = { login, at: new Date(t).toISOString(), private: false, repo, source: "backfill" as const };
    if (e.type === "PushEvent") {
      const n = Math.min(Number(p.distinct_size ?? p.size ?? 1) || 1, MAX_COMMITS_PER_PUSH);
      const h = Math.floor(t / 3600_000), used = hour.get(h) ?? 0;
      const points = Math.min(n * POINTS.push, Math.max(0, 12 - used));
      if (!points) continue;
      hour.set(h, used + points);
      out.push({ ...base, kind: "push", points, summary: `${n} commit${n > 1 ? "s" : ""}`, key: `push:${p.head ?? e.id}` });
    } else if (e.type === "PullRequestEvent" && p.action === "closed" && p.pull_request?.merged) {
      out.push({ ...base, kind: "pr_merged", points: prPoints(p.pull_request?.base?.repo?.stargazers_count ?? 0),
        summary: `merged #${p.pull_request.number}: ${p.pull_request.title ?? ""}`, key: `pr:${e.repo?.id}#${p.pull_request.number}` });
    } else if (e.type === "ReleaseEvent" && (!p.action || p.action === "published")) {
      out.push({ ...base, kind: "release", points: releasePoints(Boolean(p.release?.prerelease)),
        summary: `released ${p.release?.tag_name ?? ""}`, key: `rel:${p.release?.id ?? e.id}` });
    }
  }
  return out;
}

/** Up to 3 pages (300 events, GitHub's max), stopping once past 72h. 80 users x 3 = 240 requests: fine with a token (5000/h). */
export async function fetchPublicEvents(login: string, token = process.env.GITHUB_TOKEN, now = Date.now()) {
  const all: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "banzuke", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
    if (!r.ok) break;
    const batch: any[] = await r.json();
    all.push(...batch);
    if (batch.length < 100 || Date.parse(batch[batch.length - 1]?.created_at) < now - BACKFILL_HOURS * 3600_000) break;
  }
  return all;
}

/** What the board shows for a row. Private rows never carry a repo, and the renderer doesn't look for one. */
export function playLabel(r: { private: boolean; repo: string; summary: string }): string {
  return r.private ? "a private repo" : [r.repo, r.summary].filter(Boolean).join(" · ");
}
