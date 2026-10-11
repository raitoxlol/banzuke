import { NextResponse } from "next/server";
import { toPlay } from "@/lib/firehose";
import { PublicCollection, DELIVERY_LIMIT, type SampleStatus } from "@/lib/global-board";

export const dynamic = "force-dynamic";
const token = process.env.GITHUB_TOKEN;
const headers: Record<string, string> = {
  "User-Agent": "banzuke-live", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
type State = { collection: PublicCollection; etag: string | null; next: number; status: SampleStatus; lastSuccessAt: number | null; inFlight: Promise<void> | null };
const globalCache = globalThis as typeof globalThis & { __banzukePublicV2?: State };
const state = globalCache.__banzukePublicV2 ??= { collection: new PublicCollection(), etag: null, next: 0, status: "starting", lastSuccessAt: null, inFlight: null };

async function poll() {
  const pages = token ? 3 : 1;
  for (let page = 1; page <= pages; page++) {
    const response = await fetch(`https://api.github.com/events?per_page=100&page=${page}`, {
      headers: { ...headers, ...(page === 1 && state.etag ? { "If-None-Match": state.etag } : {}) }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const now = Date.now();
    const interval = Number(response.headers.get("x-poll-interval"));
    state.next = Math.max(state.next, now + Math.max(token ? 20 : 60, Number.isFinite(interval) ? interval : 60) * 1000);
    if (response.status === 403 || response.status === 429) {
      const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
      const retry = Number(response.headers.get("retry-after")) * 1000;
      state.next = Math.max(state.next, Number.isFinite(reset) ? reset : 0, now + (Number.isFinite(retry) ? retry : 0));
      state.status = "rate_limited"; return;
    }
    if (response.status === 304) { state.status = "live"; state.lastSuccessAt = now; return; }
    if (!response.ok) throw new Error("Public sample unavailable");
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("Invalid public sample");
    for (const event of raw) { const play = toPlay(event, 0, now); if (play) state.collection.admit(play, now); }
    if (page === 1) state.etag = response.headers.get("etag");
    state.status = "live"; state.lastSuccessAt = now;
  }
}

export async function GET() {
  state.collection.prune(Date.now());
  if (state.inFlight) await state.inFlight;
  else if (Date.now() >= state.next) {
    state.next = Date.now() + 60_000;
    state.inFlight = poll().catch(() => { state.status = "error"; }).finally(() => { state.inFlight = null; });
    await state.inFlight;
  }
  const now = Date.now();
  return NextResponse.json({ status: state.status, plays: state.collection.snapshot(now).slice(0, DELIVERY_LIMIT), nextPollMs: Math.max(0, state.next - now),
    lastSuccessAt: state.lastSuccessAt, capacityReached: state.collection.capacityReached }, { headers: { "Cache-Control": "no-store" } });
}
