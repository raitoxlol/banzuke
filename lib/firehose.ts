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

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RawEvent { id: string; type: string; actor: any; repo: any; payload: any; created_at: string; org?: any }

/** Score one public event. `team` is resolved by the caller. Returns null for events that don't score. */
export function toPlay(e: RawEvent, team: number, received?: number): Play | null {
  const login: string = e.actor?.display_login ?? e.actor?.login ?? "";
  if (!login || BOT.test(login) || BOT.test(e.actor?.login ?? "")) return null;
  const created = Date.parse(e.created_at);
  const base = { id: e.id, at: received ?? created, created, login, avatar: e.actor?.avatar_url ?? "", repo: e.repo?.name ?? "", team };
  const p = e.payload ?? {};
  switch (e.type) {
    case "PushEvent": {
      // The public feed no longer carries commit lists, so a push scores a flat point (size if present, capped).
      const n = Math.max(1, Math.min(Number(p.distinct_size ?? p.size ?? 1) || 1, 3));
      const branch = String(p.ref ?? "").replace("refs/heads/", "");
      return { ...base, kind: "push", points: n * POINTS.push, summary: branch ? `to ${branch}` : "pushed" };
    }
    case "PullRequestEvent": {
      const pr = p.pull_request ?? {};
      if (p.action !== "closed" && p.action !== "merged") return null;
      if (!pr.merged && !pr.merged_at && p.action !== "merged") return null;
      const stars = Number(pr.base?.repo?.stargazers_count ?? 0);
      return { ...base, kind: "pr_merged", points: prPoints(stars), summary: pr.title ? `#${pr.number} ${pr.title}` : `#${pr.number ?? ""} merged` };
    }
    case "ReleaseEvent": {
      if (p.action && p.action !== "published") return null;
      const r = p.release ?? {};
      return { ...base, kind: "release", points: releasePoints(!!r.prerelease), summary: r.tag_name ?? r.name ?? "release" };
    }
    case "WatchEvent":
      return { ...base, kind: "star", points: 0, summary: "starred" };
  }
  return null;
}

export function ownerKey(e: RawEvent): string { return String(e.repo?.name ?? "").split("/")[0] || String(e.actor?.id ?? ""); }
export function langFromPayload(e: RawEvent): string | null | undefined {
  return e.payload?.pull_request?.base?.repo?.language;
}
