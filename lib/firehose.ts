// Global mode: every public GitHub user plays. No sign-in.
// Parses events from https://api.github.com/events into scored plays.
import { POINTS, prPoints, releasePoints } from "./scoring";

export type PlayKind = "push" | "pr_merged" | "release" | "star";
export interface Play {
  id: string; at: number; created: number; kind: PlayKind; points: number;
  login: string; avatar: string; repo: string; team: number; summary: string;
}
export interface Stable { id: number; name: string; jp: string; color: string; langs?: string[] }

// Language stables (used when repo languages can be looked up, i.e. GITHUB_TOKEN is set).
export const LANG_STABLES: Stable[] = [
  { id: 0, name: "Web", jp: "網部屋", color: "#6FA8DC", langs: ["JavaScript", "TypeScript", "HTML", "CSS", "SCSS", "Vue", "Svelte", "Astro", "PHP", "MDX"] },
  { id: 1, name: "Python", jp: "蛇部屋", color: "#D4B05C", langs: ["Python", "Jupyter Notebook", "R", "Julia"] },
  { id: 2, name: "Systems", jp: "鋼部屋", color: "#E39A6B", langs: ["Rust", "Go", "C", "C++", "Zig", "Assembly", "Cuda", "Nim", "Odin"] },
  { id: 3, name: "JVM & Mobile", jp: "携部屋", color: "#A68CD9", langs: ["Java", "Kotlin", "Swift", "Dart", "Objective-C", "Scala", "C#", "Groovy", "Clojure", "F#"] },
  { id: 4, name: "Ops & Shell", jp: "殻部屋", color: "#6FBF8E", langs: ["Shell", "Dockerfile", "HCL", "Nix", "PowerShell", "Makefile", "Lua", "Nushell", "Batchfile"] },
  { id: 5, name: "Everything Else", jp: "雑部屋", color: "#E07A8A" },
];
// Fallback stables when no token: deterministic hash of the repo owner. Every account belongs to exactly one heya, forever.
export const HEYA_STABLES: Stable[] = [
  { id: 0, name: "Isegahama", jp: "伊勢ヶ濱", color: "#6FA8DC" },
  { id: 1, name: "Sadogatake", jp: "佐渡ヶ嶽", color: "#D4B05C" },
  { id: 2, name: "Kokonoe", jp: "九重", color: "#E39A6B" },
  { id: 3, name: "Dewanoumi", jp: "出羽海", color: "#A68CD9" },
  { id: 4, name: "Takadagawa", jp: "高田川", color: "#6FBF8E" },
  { id: 5, name: "Nishonoseki", jp: "二所ノ関", color: "#E07A8A" },
];

export function langStable(lang: string | null | undefined): number {
  if (!lang) return 5;
  const s = LANG_STABLES.find((t) => t.langs?.includes(lang));
  return s ? s.id : 5;
}
/** Basho (season) key: a new draw every day in JST, so stables reshuffle each basho. Override with ?basho=. */
export function currentBasho(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}
/** Random draft: deterministic hash of login + basho into one of six stables. */
export function draft(login: string, basho = currentBasho()): number { return heyaOf(`${login.toLowerCase()}|${basho}`); }
export function heyaOf(ownerId: number | string): number {
  const s = String(ownerId); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 6;
}

const BOT = /\[bot\]$|^dependabot|^renovate|github-actions|-bot$|^bot-/i;
export interface RawEvent { id: string; type: string; actor: Record<string, unknown>; repo: Record<string, unknown>; payload: Record<string, unknown>; created_at: string; public?: boolean }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function isPrivate(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => isPrivate(v, depth + 1));
  const obj = record(value);
  return obj.private === true || obj.public === false || Object.values(obj).some((v) => isPrivate(v, depth + 1));
}
function text(value: unknown, limit: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value) ? value : null;
}
function safeAvatar(value: unknown): string {
  if (typeof value !== "string" || value.length > 512) return "";
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "avatars.githubusercontent.com" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
}
export function toPlay(input: unknown, team: number, received?: number): Play | null {
  if (isPrivate(input)) return null;
  const e = record(input), actor = record(e.actor), repo = record(e.repo), p = record(e.payload);
  const id = text(e.id, 100), login = text(actor.login, 39), name = text(repo.name, 240), date = text(e.created_at, 40);
  if (!id || !/^[a-z\d_.:-]+$/i.test(id) || !login || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(login) || BOT.test(login) || !name || !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(name) || !date) return null;
  const created = Date.parse(date), at = received ?? created;
  if (!Number.isFinite(created) || !Number.isFinite(at) || created < 0 || at < 0 || !Number.isInteger(team) || team < 0 || team > 5) return null;
  const base = { id, at, created, login, avatar: safeAvatar(actor.avatar_url), repo: name, team };
  switch (e.type) {
    case "PushEvent": {
      const size = p.distinct_size ?? p.size ?? 1;
      if (typeof size !== "number" || !Number.isFinite(size) || size < 0 || !Number.isInteger(size)) return null;
      const branch = p.ref === undefined ? "" : text(p.ref, 240);
      if (branch === null) return null;
      return { ...base, kind: "push", points: Math.max(1, Math.min(size, 3)) * POINTS.push, summary: branch ? `to ${branch.replace(/^refs\/heads\//, "")}` : "pushed" };
    }
    case "PullRequestEvent": {
      const pr = record(p.pull_request), stars = record(record(pr.base).repo).stargazers_count ?? 0;
      if (p.action !== "closed" && p.action !== "merged") return null;
      if (pr.merged !== true && !pr.merged_at && p.action !== "merged") return null;
      if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 0) return null;
      if (typeof pr.number !== "number" || !Number.isInteger(pr.number) || pr.number < 1) return null;
      const title = pr.title === undefined ? "merged" : text(pr.title, 300);
      if (!title) return null;
      return { ...base, kind: "pr_merged", points: prPoints(stars), summary: `#${pr.number} ${title}` };
    }
    case "ReleaseEvent": {
      const r = record(p.release);
      if (p.action !== undefined && p.action !== "published") return null;
      if (r.prerelease !== undefined && typeof r.prerelease !== "boolean") return null;
      const summary = text(r.tag_name ?? r.name, 240);
      return summary ? { ...base, kind: "release", points: releasePoints(r.prerelease === true), summary } : null;
    }
    case "WatchEvent": return { ...base, kind: "star", points: 0, summary: "starred" };
    default: return null;
  }
}
export function parsePlay(input: unknown): Play | null {
  const p = record(input);
  const id = text(p.id, 100), login = text(p.login, 39), repo = text(p.repo, 240), summary = text(p.summary, 320);
  if (isPrivate(input) || !id || !/^[a-z\d_.:-]+$/i.test(id) || !login || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(login) || !repo || !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(repo) || !summary
    || typeof p.at !== "number" || !Number.isFinite(p.at) || p.at < 0
    || typeof p.created !== "number" || !Number.isFinite(p.created) || p.created < 0
    || typeof p.team !== "number" || !Number.isInteger(p.team) || p.team < 0 || p.team > 5) return null;
  const { kind, points } = p;
  if ((kind !== "push" && kind !== "pr_merged" && kind !== "release" && kind !== "star") || typeof points !== "number") return null;
  if ((kind === "push" && ![1, 2, 3].includes(points)) || (kind === "pr_merged" && ![10, 12, 15].includes(points))
    || (kind === "release" && ![13, 25].includes(points)) || (kind === "star" && points !== 0)) return null;
  return { id, login, repo, summary, kind, points, at: p.at, created: p.created, team: p.team, avatar: safeAvatar(p.avatar) };
}
export function ownerKey(e: RawEvent): string { return String(e.repo.name ?? "").split("/")[0] || String(e.actor.id ?? ""); }
export function langFromPayload(e: RawEvent): string | null | undefined {
  const lang = record(record(record(e.payload.pull_request).base).repo).language;
  return typeof lang === "string" || lang === null ? lang : undefined;
}
