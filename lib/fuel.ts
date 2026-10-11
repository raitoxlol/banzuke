// AI fuel: token totals from the opt-in CLI (cli/banzuke.mjs). A stat, never score. Pure: no Convex, no React.
import { TOOLS, isTool, type ToolId } from "./tools.mjs";
export type Tool = ToolId;
export { TOOLS };
export interface FuelWindow { tool: Tool; input: number; output: number; cache: number; windowStart: number; windowEnd: number }
export const HOUR = 3600_000;
export const FUEL_HOURS = 72;
const MAX_PER_FIELD = 2_000_000_000; // per hour; generous, just blocks garbage

/** Server-side gate: only the six fields, hour-aligned, inside the last 72h, sane non-negative ints. */
export function cleanWindows(body: unknown, now: number): FuelWindow[] {
  const ws = (body as { windows?: unknown })?.windows;
  if (!Array.isArray(ws) || ws.length > (FUEL_HOURS + 1) * TOOLS.length) throw new Error("bad windows");
  const ok = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= MAX_PER_FIELD;
  return ws.map((w) => {
    const { tool, input, output, cache, windowStart, windowEnd } = (w ?? {}) as FuelWindow;
    if (!isTool(tool)) throw new Error("bad tool");
    if (![input, output, cache].every(ok)) throw new Error("bad counts");
    if (!Number.isInteger(windowStart) || windowStart % HOUR || windowEnd !== windowStart + HOUR) throw new Error("bad window");
    if (windowStart < now - (FUEL_HOURS + 1) * HOUR || windowStart > now) throw new Error("window out of range");
    return { tool, input, output, cache, windowStart, windowEnd };
  });
}

export const burn = (r: { input: number; output: number; cache: number }) => r.input + r.output + r.cache;

export interface FuelRow extends FuelWindow { login: string; team: number }
const zero = () => Object.fromEntries(TOOLS.map((t) => [t.id, 0])) as Record<Tool, number>;
const sideOf = new Map(TOOLS.map((t) => [t.id, t.side]));
/** Per tool, Claude-vs-Codex headline (by model family, see lib/tools.mjs side), per player, per stable. Tokens = input + output + cache. */
export function summarize(rows: FuelRow[]) {
  const tools = zero();
  const sides = { claude: 0, codex: 0 };
  const players = new Map<string, { login: string; team: number; tools: Record<Tool, number>; top: Tool; total: number }>();
  const stables = new Map<number, number>();
  for (const r of rows) {
    const t = burn(r);
    tools[r.tool] += t;
    const side = sideOf.get(r.tool); if (side) sides[side] += t;
    const p = players.get(r.login) ?? { login: r.login, team: r.team, tools: zero(), top: r.tool, total: 0 };
    p.tools[r.tool] += t; p.total += t; if (p.tools[r.tool] > p.tools[p.top]) p.top = r.tool; players.set(r.login, p);
    stables.set(r.team, (stables.get(r.team) ?? 0) + t);
  }
  return {
    tools, sides,
    players: [...players.values()].sort((a, b) => b.total - a.total),
    stables: [...stables].map(([team, total]) => ({ team, total })).sort((a, b) => b.total - a.total),
  };
}
