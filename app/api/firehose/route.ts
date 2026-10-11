// Polls GitHub's public events firehose, honouring ETag and X-Poll-Interval, and keeps a rolling window in memory.
// Clients poll this route; only one upstream call happens per poll interval per warm instance.
import { NextResponse } from "next/server";
import { heyaOf, langFromPayload, langStable, ownerKey, Play, RawEvent, toPlay } from "@/lib/firehose";

export const dynamic = "force-dynamic";
const WINDOW_MS = 60 * 60_000;
const TOKEN = process.env.GITHUB_TOKEN;
// Teams are drafted client-side by login hash. Language lookups are an opt-in experiment (needs a token).
const LANG = !!TOKEN && process.env.BANZUKE_LANG_TEAMS === "1";
const UA = { "User-Agent": "banzuke-live", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
const H: Record<string, string> = TOKEN ? { ...UA, Authorization: `Bearer ${TOKEN}` } : { ...UA };

type State = {
  etag?: string; last: number; interval: number; plays: Map<string, Play>; seen: number; polls: number;
  status: "live" | "rate_limited" | "error" | "starting"; remaining?: number; reset?: number;
  langs: Map<string, string | null>; pending: Map<string, RawEvent[]>;
};
const g = globalThis as unknown as { __bz?: State };
const S: State = (g.__bz ??= { last: 0, interval: 60, plays: new Map(), seen: 0, polls: 0, status: "starting", langs: new Map(), pending: new Map() });

async function lookupLangs(budget: number) {
  const repos = [...S.pending.keys()].slice(0, budget);
  await Promise.all(repos.map(async (repo) => {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: H, cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      S.langs.set(repo, j?.language ?? null);
    } catch { S.langs.set(repo, null); }
    for (const e of S.pending.get(repo) ?? []) ingest(e);
    S.pending.delete(repo);
  }));
}

function ingest(e: RawEvent) {
  if (S.plays.has(e.id)) return;
  let team: number;
  if (LANG) {
    const repo = e.repo?.name as string;
    const fromPayload = langFromPayload(e);
    if (fromPayload !== undefined) S.langs.set(repo, fromPayload);
    if (!S.langs.has(repo)) { const q = S.pending.get(repo) ?? []; q.push(e); S.pending.set(repo, q); return; }
    team = langStable(S.langs.get(repo));
  } else team = heyaOf(ownerKey(e));
  const p = toPlay(e, team, Date.now());
  if (p) { S.plays.set(p.id, p); S.seen++; }
}

async function poll() {
  const pages = TOKEN ? 3 : 1;
  for (let page = 1; page <= pages; page++) {
    const headers = { ...H, ...(page === 1 && S.etag ? { "If-None-Match": S.etag } : {}) };
    const r = await fetch(`https://api.github.com/events?per_page=100&page=${page}`, { headers, cache: "no-store" });
    S.remaining = Number(r.headers.get("x-ratelimit-remaining") ?? NaN);
    S.reset = Number(r.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    S.interval = Math.max(Number(r.headers.get("x-poll-interval") ?? 60) || 60, TOKEN ? 20 : 60);
    if (r.status === 304) { S.status = "live"; break; }
    if (r.status === 403 || r.status === 429) { S.status = "rate_limited"; break; }
    if (!r.ok) { S.status = "error"; break; }
    if (page === 1) S.etag = r.headers.get("etag") ?? undefined;
    const evs = (await r.json()) as RawEvent[];
    evs.forEach(ingest);
    S.status = "live";
  }
  if (LANG && S.pending.size) await lookupLangs(40);
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, p] of S.plays) if (p.at < cutoff) S.plays.delete(k);
  if (S.langs.size > 20000) S.langs.clear();
  S.polls++;
}

export async function GET() {
  const now = Date.now();
  const due = now - S.last >= S.interval * 1000 && !(S.status === "rate_limited" && S.reset && now < S.reset);
  if (due) {
    S.last = now;
    try { await poll(); } catch { S.status = "error"; }
  }
  const plays = [...S.plays.values()].sort((a, b) => b.at - a.at).slice(0, 600);
  return NextResponse.json({
    status: S.status, teams: LANG ? "language" : "draft", plays, seen: S.seen, polls: S.polls,
    nextPollMs: Math.max(0, S.last + S.interval * 1000 - now), remaining: S.remaining, reset: S.reset,
  }, { headers: { "Cache-Control": "no-store" } });
}
