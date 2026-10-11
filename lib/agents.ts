// The agent race: which coding agent ships the most. Pure: no Convex, no React.
// A play's agent = what its commits say (trailers, co-authors, bot emails, branch prefixes),
// else the player's pick from the join quiz, else "human".

export const AGENTS = [
  { id: "claude", label: "Claude Code", color: "#E39A6B" },
  { id: "codex", label: "Codex", color: "#6FA8DC" },
  { id: "cursor", label: "Cursor", color: "#D4B05C" },
  { id: "devin", label: "Devin", color: "#5BBDBA" },
  { id: "opencode", label: "OpenCode", color: "#B48EDB" },
  { id: "grok", label: "Grok", color: "#E8EAF0" },
  { id: "copilot", label: "Copilot", color: "#6FBF8E" },
  { id: "human", label: "Human / other", color: "#9AA1B0" },
] as const;
export type Agent = (typeof AGENTS)[number]["id"];
export const AGENT_IDS = AGENTS.map((a) => a.id) as Agent[];
export const isAgent = (x: unknown): x is Agent => typeof x === "string" && (AGENT_IDS as string[]).includes(x);
export const agentLabel = (id: Agent) => AGENTS.find((a) => a.id === id)!.label;

// Order matters: specific signatures first. Matched against commit messages, author names/emails, branch names.
const SIGNS: [Agent, RegExp][] = [
  ["claude", /noreply@anthropic\.com|claude[ -]?code|co-authored-by:\s*claude|\bclaude\/|generated with \[?claude/i],
  ["codex", /\bcodex\b|chatgpt-codex|codex\/|@openai\.com/i],
  ["cursor", /cursoragent|cursor[ -]agent|@cursor\.(com|sh)|\bcursor\//i],
  ["devin", /devin-ai-integration|\bdevin\b|devin\//i],
  ["opencode", /\bopencode\b|opencode\//i],
  ["grok", /\bgrok\b|grok[ -]?bot|@x\.ai/i],
  ["copilot", /copilot/i],
];

/** First agent whose signature appears in any of the texts, else null. */
export function detectAgent(...texts: (string | null | undefined)[]): Agent | null {
  const t = texts.filter(Boolean).join("\n");
  if (!t) return null;
  for (const [id, re] of SIGNS) if (re.test(t)) return id;
  return null;
}

/** Text worth scanning from a GitHub commit object (webhook or events API shape). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const commitText = (c: any) => [c?.message, c?.author?.name, c?.author?.email, c?.committer?.email].filter(Boolean).join("\n");

export interface Lane { id: Agent; label: string; color: string; points: number; builders: number }
export interface Race { lanes: Lane[]; total: number; leader: Agent | null; last: { agent: Agent; at: number; id: string } | null }

type P = { login: string; answers?: { tool?: string } };
type Pl = { id: string; login: string; points: number; at: number; agent?: string };

export const playerAgent = (p?: P): Agent => (p?.answers?.tool && isAgent(p.answers.tool) ? p.answers.tool : "human");
export const playAgent = (play: Pl, player?: P): Agent => (isAgent(play.agent) ? play.agent : playerAgent(player));

/** Points per agent (all 8 lanes, sorted by points), distinct builders per lane, newest play. */
export function tallyRace(players: P[], plays: Pl[]): Race {
  const by = new Map(players.map((p) => [p.login, p]));
  const lanes = new Map<Agent, Lane & { who: Set<string> }>(AGENTS.map((a) => [a.id, { ...a, points: 0, builders: 0, who: new Set() }]));
  let last: Race["last"] = null, total = 0;
  for (const p of players) lanes.get(playerAgent(p))!.who.add(p.login);
  for (const play of plays) {
    const a = playAgent(play, by.get(play.login));
    const lane = lanes.get(a)!;
    lane.points += play.points; lane.who.add(play.login); total += play.points;
    if (!last || play.at > last.at) last = { agent: a, at: play.at, id: play.id };
  }
  const out = [...lanes.values()].map(({ who, ...l }) => ({ ...l, builders: who.size }))
    .sort((a, b) => b.points - a.points || AGENT_IDS.indexOf(a.id) - AGENT_IDS.indexOf(b.id));
  const leader = out[0].points > 0 && out[0].points > out[1].points ? out[0].id : null;
  return { lanes: out, total, leader, last };
}
