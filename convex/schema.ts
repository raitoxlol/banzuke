import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const answersV = v.object({
  tool: v.union(v.literal("claude"), v.literal("codex")), hour: v.union(v.literal("3am"), v.literal("3pm")),
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
  }).index("by_key", ["dedupeKey"]).index("by_at", ["at"]).index("by_login_at", ["login", "at"]),
});
