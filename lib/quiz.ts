// Sign-up sorting quiz. Data shape: Answers (stored on players.answers). Pure: no Convex, no React.
import type { Stable } from "./firehose";

export interface Answers { tool: "claude" | "codex"; hour: "3am" | "3pm"; indent: "tabs" | "spaces"; friday: "yes" | "no" }

export const QUESTIONS = [
  { key: "tool", q: "Claude Code or Codex?", opts: [["claude", "Claude Code"], ["codex", "Codex"]] },
  { key: "hour", q: "Ship at 3am or 3pm?", opts: [["3am", "3am"], ["3pm", "3pm"]] },
  { key: "indent", q: "Read the diff or just accept?", opts: [["tabs", "Read it"], ["spaces", "Accept all"]] },
  { key: "friday", q: "Agent broke it. Now what?", opts: [["yes", "Reprompt"], ["no", "Fix it myself"]] },
] as const;

/** Room stables: even ids are Team Claude Code, odd ids Team Codex. Sub-flavor: 3am / 3pm / reprompter. */
export const ROOM_STABLES: Stable[] = [
  { id: 0, name: "Claude Yoake", jp: "夜明", color: "#E39A6B" },   // Claude · 3am
  { id: 1, name: "Codex Yoake", jp: "夜明", color: "#6FA8DC" },    // Codex · 3am
  { id: 2, name: "Claude Hiru", jp: "昼", color: "#D4B05C" },      // Claude · 3pm
  { id: 3, name: "Codex Hiru", jp: "昼", color: "#6FBF8E" },       // Codex · 3pm
  { id: 4, name: "Claude Ippatsu", jp: "一発", color: "#E07A8A" },   // Claude · reprompter
  { id: 5, name: "Codex Ippatsu", jp: "一発", color: "#A68CD9" },    // Codex · reprompter
];

export const side = (team: number) => (team % 2 === 0 ? "Claude Code" : "Codex");

/** Preferred stable from answers alone. */
export function preferred(a: Answers): number {
  const flavor = a.friday === "yes" ? 2 : a.hour === "3am" ? 0 : 1;
  return flavor * 2 + (a.tool === "codex" ? 1 : 0);
}

/**
 * Stable for a quiz-taker given current sizes (length 6). Tool side is fixed (it's the identity);
 * within the side, take the preferred stable unless it's 2+ bigger than the smallest sibling, then the smallest.
 */
export function sortIntoStable(a: Answers, sizes: number[]): number {
  const want = preferred(a);
  const sibs = [0, 2, 4].map((x) => x + (want % 2));
  const min = Math.min(...sibs.map((t) => sizes[t]));
  if (sizes[want] - min < 2) return want;
  return sibs.find((t) => sizes[t] === min)!;
}

/** Old draft for quiz-skippers: smallest stable, lowest id wins ties. */
export const smallest = (sizes: number[]) => sizes.indexOf(Math.min(...sizes));

/** Short board tag, e.g. "Codex · 3am". */
export const whyTag = (a?: Answers) => (a ? `${a.tool === "codex" ? "Codex" : "Claude Code"} · ${a.hour}` : "");
