import test from "node:test";
import assert from "node:assert/strict";
import { toPlay, parsePlay } from "../lib/firehose";
import { PublicCollection, publicBoard, parsePublicSample, OBSERVED_HOUR, CREATION_HORIZON } from "../lib/global-board";
import { reduceJoin, initialJoinState, parseProgress, completeChoice } from "../lib/onboarding";

const now = Date.UTC(2026, 9, 11);
const event = (id = "1") => ({ id, type: "PushEvent", actor: { login: "Alice", avatar_url: "https://evil.test/avatar" }, repo: { name: "Alice/project" }, payload: { size: 3 }, created_at: new Date(now - 36 * OBSERVED_HOUR).toISOString() });
const play = (id = "1") => { const p = toPlay(event(id), 0, now); assert.ok(p); return p; };
test("source rejects private markers before scoring, including nested repositories", () => {
  for (const e of [{ ...event(), public: false }, { ...event(), repo: { name: "secret/repo", private: true } }, { ...event(), payload: { pull_request: { base: { repo: { private: true } } } } }]) assert.equal(toPlay(e, 0), null);
});
test("source rejects malformed IDs, dates, identity, points and unbounded text", () => {
  for (const e of [{ ...event(), id: "" }, { ...event(), created_at: "invalid" }, { ...event(), actor: { login: "bad/name" } }, { ...event(), payload: { size: Infinity } }, { ...event(), payload: { ref: "x".repeat(300) } }]) assert.equal(toPlay(e, 0), null);
  assert.equal(play().avatar, ""); assert.equal(parsePlay({ ...play(), points: NaN }), null);
});
test("36-hour delayed sample retains creation time and expires by observation", () => {
  const c = new PublicCollection(); assert.equal(c.admit(play(), now), true);
  assert.equal(c.snapshot(now)[0].created, now - 36 * OBSERVED_HOUR);
  assert.equal(c.snapshot(now + OBSERVED_HOUR).length, 0);
  assert.equal(c.admit(play(), now + OBSERVED_HOUR), false);
  assert.equal(c.admit({ ...play("2"), created: now - CREATION_HORIZON - 1 }, now), false);
});
test("bounded ledger refuses new admissions without reopening protected IDs", () => {
  const c = new PublicCollection(1); c.admit(play(), now);
  assert.equal(c.admit(play("2"), now), false); assert.equal(c.capacityReached, true);
  c.snapshot(now + OBSERVED_HOUR); assert.equal(c.admit(play(), now + OBSERVED_HOUR), false);
  assert.equal(c.admit(play("3"), now + OBSERVED_HOUR), false);
});
test("same collection drives credited feed, ranks and totals with stable ties", () => {
  const a = Array.from({ length: 6 }, (_, i) => play(String(i)));
  const b = { ...play("bob"), login: "bob", kind: "pr_merged" as const, points: 12 };
  const view = publicBoard([...a, a[0], b], now);
  assert.deepEqual(view.builders.map((b) => [b.login, b.points]), [["alice", 12], ["bob", 12]]);
  assert.equal(view.total, 24); assert.equal(view.plays.reduce((s, p) => s + p.points, 0), 24);
  assert.deepEqual(publicBoard([...a, b].reverse(), now), publicBoard([...a, b], now));
  assert.equal(publicBoard(a, now + OBSERVED_HOUR).total, 0);
});
test("source envelope accepts successful empty data and rejects poisoned plays", () => {
  const sample = { status: "live", plays: [], nextPollMs: 60000, lastSuccessAt: now, capacityReached: false };
  assert.deepEqual(parsePublicSample(sample), sample);
  assert.equal(parsePublicSample({ ...sample, plays: [{ ...play(), repo: "private" }] }), null);
});
test("local progress never restores integration evidence or another account", () => {
  const p = { version: 1, login: "alice", step: "finish", skipped: ["privateRepos"], cliReady: true, connected: true, joined: true };
  assert.deepEqual(parseProgress(p, "alice"), { version: 1, login: "alice", step: "finish", skipped: ["privateRepos"], cliReady: true });
  assert.equal(parseProgress(p, "bob"), null); assert.equal(parseProgress({ ...p, step: "wrong" }, "alice"), null);
});
test("account change rejects stale success, failure and hydration", () => {
  const alice = reduceJoin(initialJoinState, { type: "account", login: "alice" });
  const bob = reduceJoin(alice, { type: "account", login: "bob" });
  for (const e of [{ type: "success", epoch: alice.epoch, target: "choice" }, { type: "failure", epoch: alice.epoch, target: "join", message: "old failure", answers: null }, { type: "hydrate", epoch: alice.epoch, progress: alice.progress, available: true }] as const) assert.equal(reduceJoin(bob, e), bob);
  assert.equal(bob.joined, false); assert.equal(bob.progress.cliReady, false);
});
test("choice preserves fun answers and retry remembers complete failed choice", () => {
  const answers = completeChoice("codex", { tool: "claude", hour: "3am", indent: "tabs", friday: "yes" });
  assert.deepEqual(answers, { tool: "codex", hour: "3am", indent: "tabs", friday: "yes" });
  const failed = reduceJoin(initialJoinState, { type: "failure", epoch: 0, target: "choice", message: "try again", answers });
  assert.deepEqual(failed.attempt, { kind: "failed", target: "choice", message: "try again", answers });
});

test("stars stay in the feed without zero-score ranked builders; duplicate first observation wins", () => {
  const p = play();
  const star = { ...play("star"), login: "bob", kind: "star" as const, points: 0 };
  assert.deepEqual(publicBoard([star], now).builders, []);
  assert.equal(publicBoard([star], now).plays.length, 1);
  const later = { ...p, at: now + 1000 };
  assert.deepEqual(publicBoard([later, p], now + 1000), publicBoard([p, later], now + 1000));
  assert.equal(publicBoard([later, p], now + 1000).plays[0].at, now);
});
