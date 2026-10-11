// The one list of AI-fuel tools. Shared by the CLI (cli/banzuke.mjs), the server gate (lib/fuel.ts),
// the Convex validators (convex/fuel.ts, convex/schema.ts) and the board (components/FuelPanel.tsx).
// Plain .mjs so the zero-dep CLI can import it. Add a tool here and everything else follows.
// side: model family (informational only; the board races every tool, see lib/agents.ts).
export const TOOLS = [
  { id: "claude",        label: "Claude Code",   color: "#E39A6B", kind: "local", side: "claude" },
  { id: "codex",         label: "Codex",         color: "#6FA8DC", kind: "local", side: "codex" },
  { id: "opencode",      label: "OpenCode",      color: "#B48EDB", kind: "local", side: null },
  { id: "devin",         label: "Devin CLI",     color: "#5BBDBA", kind: "local", side: null },
  { id: "anthropic-api", label: "Anthropic API", color: "#C9805A", kind: "api",   side: "claude" },
  { id: "openai-api",    label: "OpenAI API",    color: "#4F86B8", kind: "api",   side: "codex" },
  { id: "xai-api",       label: "xAI API",       color: "#9AA3AD", kind: "api",   side: null },
];
export const TOOL_IDS = TOOLS.map((t) => t.id);
export const isTool = (x) => typeof x === "string" && TOOL_IDS.includes(x);
export const toolById = (id) => TOOLS.find((t) => t.id === id);
