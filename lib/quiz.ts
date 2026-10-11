// Sign-up quiz. Data shape: Answers (stored on players.answers). Pure: no Convex, no React.
// Q1 picks your main agent (your lane in the race when your commits don't say).
// The rest are for fun and sort you into one of six internal groups (players.team), which only balances sign-ups.
import { AGENTS, AGENT_IDS, agentLabel, type Agent } from "./agents";

export interface Answers { tool: Agent; hour: "3am" | "3pm"; indent: "tabs" | "spaces"; friday: "yes" | "no" }

export const QUESTIONS = [
  { key: "tool", q: "メインで使うコーディングエージェントは？", opts: AGENTS.map((a) => [a.id, a.id === "human" ? "自分だけ" : a.label] as const) },
  { key: "hour", q: "開発を仕上げるなら午前3時？午後3時？", opts: [["3am", "午前3時"], ["3pm", "午後3時"]] },
  { key: "indent", q: "差分を読む？そのまま承認する？", opts: [["tabs", "差分を読む"], ["spaces", "すべて承認"]] },
  { key: "friday", q: "エージェントが壊したらどうする？", opts: [["yes", "指示を出し直す"], ["no", "自分で直す"]] },
] as const;

export const GROUPS = 6;

/** Preferred group from answers alone: flavor (3am / 3pm / reprompter) x agent parity. */
export function preferred(a: Answers): number {
  const flavor = a.friday === "yes" ? 2 : a.hour === "3am" ? 0 : 1;
  return flavor * 2 + (AGENT_IDS.indexOf(a.tool) % 2);
}

/** Group for a quiz-taker given current sizes (length 6): preferred unless it's 2+ bigger than the smallest sibling. */
export function sortIntoStable(a: Answers, sizes: number[]): number {
  const want = preferred(a);
  const sibs = [0, 2, 4].map((x) => x + (want % 2));
  const min = Math.min(...sibs.map((t) => sizes[t]));
  if (sizes[want] - min < 2) return want;
  return sibs.find((t) => sizes[t] === min)!;
}

/** Quiz-skippers: smallest group, lowest id wins ties. */
export const smallest = (sizes: number[]) => sizes.indexOf(Math.min(...sizes));

/** Short tag, e.g. "Codex · 3am". */
export const whyTag = (a?: Answers) => (a ? `${agentLabel(a.tool)} · ${a.hour}` : "");
