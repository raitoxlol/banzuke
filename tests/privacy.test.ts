// Proves private repo details never reach a stored row or the rendered board.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromWebhook, fromPublicEvents, toRow, playLabel, assertClean } from "../lib/ingest";

const SECRETS = ["stealth-startup", "acme/stealth-startup", "feat: secret pricing engine", "refs/heads/launch-plan",
  "https://github.com/acme/stealth-startup", "deadbeefcafe", "src/pricing.ts", "SECRET_CODE_LINE"];
const player = 2;
const privatePush = {
  ref: "refs/heads/launch-plan", after: "deadbeefcafe", compare: "https://github.com/acme/stealth-startup/compare/x",
  sender: { login: "yuki" },
  repository: { private: true, id: 42, full_name: "acme/stealth-startup", name: "stealth-startup", html_url: "https://github.com/acme/stealth-startup", stargazers_count: 0 },
  commits: [1, 2, 3].map((i) => ({ id: `c${i}`, message: `feat: secret pricing engine ${i}`, url: "https://github.com/acme/stealth-startup/commit/x",
    author: { username: "yuki" }, added: ["src/pricing.ts"], modified: [], removed: [], patch: "SECRET_CODE_LINE" })),
};

const leaks = (s: string) => SECRETS.filter((x) => s.includes(x));

test("private push: scores, but the stored row has only login/kind/points/time", () => {
  const play = fromWebhook("push", privatePush, 0)!;
  assert.equal(play.points, 3);
  const row = toRow(play, player);
  assert.deepEqual(leaks(JSON.stringify(row)), []);
  assert.equal(row.repo, ""); assert.equal(row.summary, ""); assert.equal(row.private, true);
  assert.equal(row.login, "yuki"); assert.doesNotThrow(() => assertClean(row));
  assert.throws(() => assertClean({ ...row, repo: "acme/stealth-startup" })); assert.equal(row.kind, "push");
});

test("private merged PR and release: same", () => {
  const pr = fromWebhook("pull_request", { ...privatePush, action: "closed", pull_request: { merged: true, number: 7, title: "feat: secret pricing engine", head: { ref: "launch-plan" } } }, 0)!;
  const rel = fromWebhook("release", { ...privatePush, action: "published", release: { id: 9, tag_name: "stealth-startup-v1", prerelease: false } }, 0)!;
  for (const p of [pr, rel]) assert.deepEqual(leaks(JSON.stringify(toRow(p, player))), []);
  assert.equal(toRow(rel, player).summary, "");
});

test("render: private row shows 'a private repo', nothing else", () => {
  const row = toRow(fromWebhook("push", privatePush, 0)!, player);
  assert.equal(playLabel(row), "a private repo");
  // even a row tampered with upstream renders nothing from repo/summary
  assert.equal(playLabel({ ...row, repo: "acme/stealth-startup", summary: "feat: secret pricing engine" }), "a private repo");
});

test("public push keeps repo and the dedupe key is hashed", () => {
  const row = toRow(fromWebhook("push", { ...privatePush, repository: { ...privatePush.repository, private: false } }, 0)!, player);
  assert.equal(row.repo, "acme/stealth-startup");
  assert.ok(!row.dedupeKey.includes("deadbeef"));
});

test("backfill: last 72h only, real commit counts, hourly cap, same key as webhook push", () => {
  const now = Date.parse("2026-10-11T03:00:00Z");
  const ev = (id: string, h: number, size: number, head = id) => ({ id, type: "PushEvent", actor: { login: "yuki" }, repo: { id: 1, name: "yuki/app" },
    created_at: new Date(now - h * 3600_000).toISOString(), payload: { size, head } });
  const plays = fromPublicEvents("yuki", [ev("old", 80, 5), ev("a", 1.5, 5), ev("b", 1.4, 5), ev("c", 1.3, 5), ev("d", 10, 2, "deadbeefcafe")], now);
  assert.equal(plays.length, 4);
  assert.deepEqual(plays.map((p) => p.points), [2, 5, 5, 2]); // 12/hour cap
  const hook = fromWebhook("push", { ...privatePush, repository: { ...privatePush.repository, private: false } }, 0)!;
  assert.equal(toRow(plays[0], player).dedupeKey, toRow(hook, player).dedupeKey);
});
