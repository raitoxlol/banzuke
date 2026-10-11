import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { summarize, FUEL_HOURS, HOUR } from "../lib/fuel";
import { toolValidator as tool } from "./tools";

/** Upsert per (login, tool, windowStart): re-syncing an hour replaces it, never double counts. */
export const record = internalMutation({
  args: { login: v.string(), windows: v.array(v.object({ tool, input: v.number(), output: v.number(), cache: v.number(), windowStart: v.number(), windowEnd: v.number() })) },
  handler: async (ctx, { login, windows }) => {
    const p = await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", login)).first();
    if (!p) return { error: "not a room player" };
    let inserted = 0, updated = 0;
    for (const w of windows) {
      const have = await ctx.db.query("tokens").withIndex("by_key", (q) => q.eq("login", login).eq("tool", w.tool).eq("windowStart", w.windowStart)).first();
      const row = { login, team: p.team, ...w, syncedAt: Date.now() };
      if (have) { await ctx.db.replace(have._id, row); updated++; } else { await ctx.db.insert("tokens", row); inserted++; }
    }
    return { login, inserted, updated };
  },
});

/** Per-tool totals (+ Claude vs Codex headline), per player and per stable, last 72h. Team is read live from players. */
export const totals = query({
  args: {},
  handler: async (ctx) => {
    const since = Math.floor((Date.now() - FUEL_HOURS * HOUR) / HOUR) * HOUR;
    const [rows, players] = await Promise.all([
      ctx.db.query("tokens").withIndex("by_window", (q) => q.gte("windowStart", since)).collect(),
      ctx.db.query("players").collect(),
    ]);
    const team = new Map(players.map((p) => [p.login, p.team]));
    const avatar = new Map(players.map((p) => [p.login, p.avatar]));
    const live = rows.filter((r) => team.has(r.login)).map((r) => ({ ...r, team: team.get(r.login)! }));
    const s = summarize(live);
    return { ...s, players: s.players.map((p) => ({ ...p, avatar: avatar.get(p.login) ?? "" })) };
  },
});

/** Host tool: drop someone's fuel rows (`npx convex run fuel:clear '{"login":"x"}'`). */
export const clear = internalMutation({
  args: { login: v.string() },
  handler: async (ctx, { login }) => {
    const rows = await ctx.db.query("tokens").withIndex("by_key", (q) => q.eq("login", login)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});
