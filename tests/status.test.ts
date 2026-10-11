import test from "node:test";
import assert from "node:assert/strict";
import { statusFor, boardFor } from "../lib/status";

const snap = {
  players: [{ login: "a" }, { login: "b", answers: { tool: "codex" } }, { login: "c" }],
  plays: [
    { id: "1", login: "a", kind: "push", points: 5, at: 1000, private: true, repo: "", summary: "" },
    { id: "2", login: "a", kind: "push", points: 5, at: 2000, private: true, repo: "secret-repo", summary: "secret msg" },
    { id: "3", login: "b", kind: "pr_merged", points: 20, at: 3000, private: false, repo: "b/pub", summary: "hello" },
  ],
} as any;

test("status ranks and neighbours", () => {
  const s = statusFor(snap, "A")!;
  assert.equal(s.rank, 2); assert.equal(s.points, 10);
  assert.deepEqual(s.ahead, { login: "b", points: 20 }); assert.deepEqual(s.behind, { login: "c", points: 0 });
  assert.equal(statusFor(snap, "zzz"), null);
});
test("status never leaks private repo names or commit text", () => {
  const json = JSON.stringify(statusFor(snap, "a")) + JSON.stringify(statusFor(snap, "b")) + JSON.stringify(boardFor(snap));
  assert.ok(!json.includes("secret")); assert.ok(!json.includes("hello"));
  assert.ok(statusFor(snap, "a")!.recentPlays.every((p) => p.repo === "private"));
  assert.equal(statusFor(snap, "b")!.recentPlays[0].repo, "b/pub");
});
test("board top + race", () => {
  const b = boardFor(snap);
  assert.equal(b.top[0].login, "b"); assert.equal(b.race.find((l) => l.agent === "codex")!.points, 20);
});
