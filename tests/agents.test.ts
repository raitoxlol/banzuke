import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAgent, tallyRace, AGENT_IDS } from "../lib/agents";
import { fromWebhook, fromPublicEvents, toRow } from "../lib/ingest";

test("detects agents from trailers, emails and branch prefixes", () => {
  assert.equal(detectAgent("fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"), "claude");
  assert.equal(detectAgent("refs/heads/codex/add-race"), "codex");
  assert.equal(detectAgent("feat\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>"), "cursor");
  assert.equal(detectAgent("devin-ai-integration[bot]"), "devin");
  assert.equal(detectAgent("built with opencode"), "opencode");
  assert.equal(detectAgent("Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>"), "copilot");
  assert.equal(detectAgent("made by Grok Bot"), "grok");
  assert.equal(detectAgent("fix typo", "refs/heads/main", "ryan@example.com"), null);
  assert.equal(detectAgent(), null);
});

test("race: detected agent beats the player's pick; unpicked = human; all lanes present, sorted", () => {
  const players = [{ login: "a", answers: { tool: "cursor" } }, { login: "b" }];
  const plays = [
    { id: "1", login: "a", points: 5, at: 10 },
    { id: "2", login: "a", points: 3, at: 30, agent: "claude" },
    { id: "3", login: "b", points: 2, at: 20 },
  ];
  const r = tallyRace(players, plays);
  assert.equal(r.lanes.length, AGENT_IDS.length);
  assert.deepEqual(r.lanes.slice(0, 3).map((l) => [l.id, l.points]), [["cursor", 5], ["claude", 3], ["human", 2]]);
  assert.equal(r.lanes.find((l) => l.id === "claude")!.builders, 1);
  assert.equal(r.leader, "cursor");
  assert.equal(r.total, 10);
  assert.deepEqual(r.last, { agent: "claude", at: 30, id: "2" });
  const empty = tallyRace([], []);
  assert.equal(empty.leader, null); assert.equal(empty.last, null); assert.equal(empty.total, 0);
});

test("ingest tags plays with the agent, private plays keep it without leaking details", () => {
  const files = { added: ["a"], removed: [], modified: [] };
  const push = fromWebhook("push", {
    sender: { login: "x" }, repository: { private: true, full_name: "x/secret" }, ref: "refs/heads/main", after: "abc",
    commits: [{ id: "1", message: "ship\n\nCo-Authored-By: Claude <noreply@anthropic.com>", author: { email: "x@y.z" }, ...files }],
  }, 0)!;
  assert.equal(push.agent, "claude");
  const row = toRow(push, 0);
  assert.equal(row.agent, "claude"); assert.equal(row.repo, ""); assert.equal(row.summary, "");
  const pr = fromWebhook("pull_request", { action: "closed", sender: { login: "x" }, repository: { id: 1 },
    pull_request: { merged: true, number: 2, title: "t", head: { ref: "codex/race" } } }, 0)!;
  assert.equal(pr.agent, "codex");
  const now = Date.parse("2026-10-11T05:00:00Z");
  const [bf] = fromPublicEvents("x", [{ id: "e", type: "PushEvent", created_at: "2026-10-11T04:00:00Z", actor: { login: "x" }, repo: { name: "x/r" },
    payload: { size: 1, head: "h", ref: "refs/heads/cursor/fix", commits: [] } }], now);
  assert.equal(bf.agent, "cursor");
  assert.equal(toRow({ ...bf, agent: undefined }, 0).agent, undefined);
  assert.ok(!("agent" in toRow({ ...bf, agent: undefined }, 0)));
});
