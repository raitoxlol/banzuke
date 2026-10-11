import { defineSchema, defineTable } from "convex/server";
import { toolValidator } from "./tools";
import { authTables } from "@convex-dev/auth/server";
import { v, type Validator } from "convex/values";
import { AGENT_IDS, type Agent } from "../lib/agents";

const lit = AGENT_IDS.map((a) => v.literal(a)) as unknown as [Validator<Agent>, Validator<Agent>, ...Validator<Agent>[]];
/** One of lib/agents.ts AGENTS. */
export const agentV = v.union(...lit);
export const answersV = v.object({
  tool: agentV, hour: v.union(v.literal("3am"), v.literal("3pm")),
  indent: v.union(v.literal("tabs"), v.literal("spaces")), friday: v.union(v.literal("yes"), v.literal("no")),
});
export const kind = v.union(v.literal("push"), v.literal("pr_merged"), v.literal("release"));

export default defineSchema({
  ...authTables,
  // Convex Auth's users table plus the GitHub login we score by.
  users: defineTable({
    name: v.optional(v.string()), image: v.optional(v.string()), email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()), phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()),
    githubLogin: v.optional(v.string()),
  }).index("email", ["email"]),
  players: defineTable({
    login: v.string(), userId: v.optional(v.id("users")), avatar: v.string(), team: v.number(), joinedAt: v.number(),
    answers: v.optional(answersV), // sign-up quiz (lib/quiz.ts); absent = skipped
  }).index("by_login", ["login"]).index("by_team", ["team"]),
  // Shape owned by lib/ingest.ts (Row). Private rows: repo === "" && summary === "".
  plays: defineTable({
    login: v.string(), team: v.number(), kind, points: v.number(), at: v.number(),
    private: v.boolean(), source: v.union(v.literal("webhook"), v.literal("backfill")),
    repo: v.string(), summary: v.string(), dedupeKey: v.string(),
    agent: v.optional(agentV), // detected from commits/branch (lib/agents.ts); absent = use the player's pick
  }).index("by_key", ["dedupeKey"]).index("by_at", ["at"]).index("by_login_at", ["login", "at"]),
  // GitHub App installs, from the webhook `installation` event. Logins only; no repo list.
  installations: defineTable({
    installationId: v.number(), account: v.string(), sender: v.string(), active: v.boolean(), at: v.number(),
  }).index("by_installation", ["installationId"]).index("by_account", ["account"]).index("by_sender", ["sender"]),
  // AI fuel (opt-in CLI): hourly token totals per tool. Counts only; never affects score.
  tokens: defineTable({
    login: v.string(), team: v.number(), tool: toolValidator,
    input: v.number(), output: v.number(), cache: v.number(), windowStart: v.number(), windowEnd: v.number(), syncedAt: v.number(),
  }).index("by_key", ["login", "tool", "windowStart"]).index("by_window", ["windowStart"]),
});
