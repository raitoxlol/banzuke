// Sign-up quiz. Data shape: Answers (stored on players.answers). Pure: no Convex, no React.
// Q1 picks your main agent (your lane in the race when your commits don't say).
// The rest are for fun and sort you into one of six internal groups (players.team), which only balances sign-ups.
import { AGENTS, AGENT_IDS, agentLabel, type Agent } from "./agents";

export interface Answers { tool: Agent; hour: "3am" | "3pm"; indent: "tabs" | "spaces"; friday: "yes" | "no" }

export const QUESTIONS = [
  { key: "tool", q: "Your main coding agent?", opts: AGENTS.map((a) => [a.id, a.id === "human" ? "Just me" : a.label] as const) },
  { key: "hour", q: "Ship at 3am or 3pm?", opts: [["3am", "3am"], ["3pm", "3pm"]] },
  { key: "indent", q: "Read the diff or just accept?", opts: [["tabs", "Read it"], ["spaces", "Accept all"]] },
  { key: "friday", q: "Agent broke it. Now what?", opts: [["yes", "Reprompt"], ["no", "Fix it myself"]] },
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
