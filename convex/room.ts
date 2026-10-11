import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { kind, answersV, agentV } from "./schema";
import { sortIntoStable, smallest } from "../lib/quiz";
import { tallyRace } from "../lib/agents";
import { assertClean, fetchPublicEvents, fromPublicEvents, toRow, type Row, BACKFILL_HOURS } from "../lib/ingest";
import { MAX_PUSH_POINTS_PER_HOUR } from "../lib/scoring";

const STABLES = 6;
const rowV = v.object({
  login: v.string(), team: v.number(), kind, points: v.number(), at: v.number(), private: v.boolean(),
  source: v.union(v.literal("webhook"), v.literal("backfill")), repo: v.string(), summary: v.string(), dedupeKey: v.string(), agent: v.optional(agentV),
});

/** Insert once per dedupeKey. Returns true if new. */
async function put(ctx: MutationCtx, r: Row) {
  assertClean(r);
  const dup = await ctx.db.query("plays").withIndex("by_key", (q) => q.eq("dedupeKey", r.dedupeKey)).first();
  if (dup) return false;
  await ctx.db.insert("plays", r);
  return true;
}

/** Signed-in user joins the room: sorted by quiz answers (or smallest stable if skipped), then a 72h backfill. */
export const join = mutation({
  args: { answers: v.optional(answersV) },
  handler: async (ctx, { answers }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("not signed in");
    const user = await ctx.db.get(userId);
    const login = user?.githubLogin;
    if (!login) throw new Error("not a GitHub account");
    const have = await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", login)).first();
    if (have) {
      // Re-taking the quiz updates your agent pick; your team and points stay.
      if (answers) await ctx.db.patch(have._id, { answers });
      return { login, team: have.team, fresh: false };
    }
    const sizes = await Promise.all(Array.from({ length: STABLES }, (_, t) =>
      ctx.db.query("players").withIndex("by_team", (q) => q.eq("team", t)).collect().then((r) => r.length)));
    const team = answers ? sortIntoStable(answers, sizes) : smallest(sizes);
    await ctx.db.insert("players", { login, userId, avatar: user.image ?? "", team, joinedAt: Date.now(), answers });
    await ctx.scheduler.runAfter(0, internal.room.backfill, { login, team });
    return { login, team, fresh: true };
  },
});

/** 72h of public history: 1 to 3 API calls per user. GITHUB_TOKEN (Convex env) lifts the limit to 5000/h. */
export const backfill = internalAction({
  args: { login: v.string(), team: v.number() },
  handler: async (ctx, { login, team }) => {
    const plays = fromPublicEvents(login, await fetchPublicEvents(login));
    if (plays.length) await ctx.runMutation(internal.room.insertMany, { rows: plays.map((p) => toRow(p, team)) });
    return plays.length;
  },
});

export const insertMany = internalMutation({
  args: { rows: v.array(rowV) },
  handler: async (ctx, { rows }) => { let n = 0; for (const r of rows) if (await put(ctx, r)) n++; return n; },
});

/** Webhook rows arrive already stripped. Team is looked up here; push points get the rolling-hour cap. */
export const recordWebhook = internalMutation({
  args: { row: rowV },
  handler: async (ctx, { row }) => {
    const p = await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", row.login)).first();
    if (!p) return "not a room player";
    let points = row.points;
    if (row.kind === "push") {
      const hour = await ctx.db.query("plays").withIndex("by_login_at", (q) => q.eq("login", row.login).gte("at", Date.now() - 3600_000)).collect();
      const used = hour.filter((h) => h.kind === "push").reduce((s, h) => s + h.points, 0);
      points = Math.min(points, Math.max(0, MAX_PUSH_POINTS_PER_HOUR - used));
      if (!points) return "hour cap";
    }
    return (await put(ctx, { ...row, team: p.team, points })) ? "ok" : "duplicate";
  },
});

/** Everything the Room board needs, reactive. */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - BACKFILL_HOURS * 3600_000;
    const [players, plays] = await Promise.all([
      ctx.db.query("players").collect(),
      ctx.db.query("plays").withIndex("by_at", (q) => q.gte("at", since)).order("desc").take(4000),
    ]);
    return {
      players: players.map((p) => ({ login: p.login, avatar: p.avatar, team: p.team, answers: p.answers })),
      plays: plays.map(({ login, team, kind, points, at, private: priv, repo, summary, agent, _id }) =>
        ({ id: _id as string, login, team, kind, points, at, private: priv, repo, summary, ...(agent ? { agent } : {}) })),
    };
  },
});


/** Host tool: add someone without a phone (`npx convex run room:addPlayer '{"login":"x"}'`). Same draft + backfill. */
export const addPlayer = internalMutation({
  args: { login: v.string(), team: v.optional(v.number()) },
  handler: async (ctx, { login, team }) => {
    const have = await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", login)).first();
    if (have) return have.team;
    const t = team ?? (await ctx.db.query("players").collect()).length % STABLES;
    await ctx.db.insert("players", { login, avatar: `https://github.com/${login}.png`, team: t, joinedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.room.backfill, { login, team: t });
    return t;
  },
});

/** Host tool: remove a player and their plays (`npx convex run room:removePlayer '{"login":"x"}'`). */
export const removePlayer = internalMutation({
  args: { login: v.string() },
  handler: async (ctx, { login }) => {
    for (const p of await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", login)).collect()) await ctx.db.delete(p._id);
    const plays = await ctx.db.query("plays").withIndex("by_login_at", (q) => q.eq("login", login)).collect();
    for (const p of plays) await ctx.db.delete(p._id);
    return plays.length;
  },
});

/** Agent race: points + builders per agent lane, and the agent of the newest play. */
export const race = query({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - BACKFILL_HOURS * 3600_000;
    const [players, plays] = await Promise.all([
      ctx.db.query("players").collect(),
      ctx.db.query("plays").withIndex("by_at", (q) => q.gte("at", since)).order("desc").take(4000),
    ]);
    return tallyRace(players, plays.map((p) => ({ id: p._id as string, login: p.login, points: p.points, at: p.at, agent: p.agent })));
  },
});

/** Webhook `installation` event: upsert by installation id. */
export const recordInstall = internalMutation({
  args: { installationId: v.number(), account: v.string(), sender: v.string(), active: v.boolean() },
  handler: async (ctx, a) => {
    const have = await ctx.db.query("installations").withIndex("by_installation", (q) => q.eq("installationId", a.installationId)).first();
    const row = { ...a, at: Date.now() };
    if (have) await ctx.db.replace(have._id, row); else await ctx.db.insert("installations", row);
  },
});

/** For /join onboarding: is the GitHub App installed for the signed-in user? null = not signed in.
 *  installed = an active install on their account or one they installed, or (older installs, before this table) any webhook-scored play. */
export const myInstall = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const login = userId ? (await ctx.db.get(userId))?.githubLogin : undefined;
    if (!login) return null;
    const rows = [
      ...(await ctx.db.query("installations").withIndex("by_account", (q) => q.eq("account", login)).collect()),
      ...(await ctx.db.query("installations").withIndex("by_sender", (q) => q.eq("sender", login)).collect()),
    ].filter((r) => r.active);
    const plays = await ctx.db.query("plays").withIndex("by_login_at", (q) => q.eq("login", login)).order("desc").take(500);
    const webhookPlays = plays.filter((p) => p.source === "webhook").length;
    return { login, installed: rows.length > 0 || webhookPlays > 0, installations: rows.length, webhookPlays, joined: Boolean(await ctx.db.query("players").withIndex("by_login", (q) => q.eq("login", login)).first()) };
  },
});
