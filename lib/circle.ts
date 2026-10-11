// Relevant mode. Seed = a GitHub login ("raitoxlol"), or an X handle ("x:handle" / "@handle") that we try as a
// GitHub login and confirm via the profile's twitter_username. Everything runs unauthenticated from the browser,
// small N, cached in localStorage for 30 minutes.
import type { RawEvent } from "./firehose";

const API = "https://api.github.com";
const TTL = 30 * 60_000;
async function gh<T>(path: string): Promise<T | null> {
  try { const r = await fetch(API + path); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}
export interface Circle { login: string; members: string[]; via: "github" | "x" }

export async function loadCircle(seed: string): Promise<Circle> {
  const isX = /^(x:|@)/i.test(seed);
  const handle = seed.replace(/^(x:|@)/i, "").trim();
  const key = `bz-circle:${seed.toLowerCase()}`;
  try { const c = JSON.parse(localStorage.getItem(key) ?? "null"); if (c && Date.now() - c.t < TTL) return c.v; } catch {}
  const user = await gh<{ login: string; twitter_username?: string | null }>(`/users/${encodeURIComponent(handle)}`);
  if (!user) return { login: handle, members: [], via: isX ? "x" : "github" };
  const [following, followers, repos] = await Promise.all([
    gh<{ login: string }[]>(`/users/${user.login}/following?per_page=60`),
    gh<{ login: string }[]>(`/users/${user.login}/followers?per_page=60`),
    gh<{ name: string; stargazers_count: number }[]>(`/users/${user.login}/repos?sort=updated&per_page=10`),
  ]);
  const top = (repos ?? []).filter((r) => r.stargazers_count > 0).sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  const stargazers = top ? await gh<{ login: string }[]>(`/repos/${user.login}/${top.name}/stargazers?per_page=40`) : null;
  const members = [...new Set([user.login, ...(following ?? []), ...(followers ?? []), ...(stargazers ?? [])].map((u) => (typeof u === "string" ? u : u.login).toLowerCase()))];
  const v: Circle = { login: user.login, members, via: isX ? "x" : "github" };
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch {}
  return v;
}

export async function circleEvents(login: string): Promise<RawEvent[]> {
  return (await gh<RawEvent[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=30`)) ?? [];
}
