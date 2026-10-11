import { test } from "node:test";
import assert from "node:assert/strict";
import { tallySides } from "../lib/sides";

test("sides: quiz tool wins over team parity, fallback to parity, newest play is last", () => {
  const players = [
    { login: "a", team: 1, answers: { tool: "claude" as const } }, // odd team but said claude
    { login: "b", team: 3 },
    { login: "c", team: 2 },
  ];
  const plays = [
    { id: "1", login: "a", team: 1, points: 5, at: 10 },
    { id: "2", login: "b", team: 3, points: 3, at: 30 },
    { id: "3", login: "c", team: 2, points: 2, at: 20 },
    { id: "4", login: "gone", team: 5, points: 1, at: 5 },
  ];
  const s = tallySides(players, plays);
  assert.deepEqual({ ...s, last: s.last?.id }, { claude: 7, codex: 4, claudePlayers: 2, codexPlayers: 1, last: "2" });
  assert.equal(s.last?.side, "codex");
  assert.deepEqual(tallySides([], []), { claude: 0, codex: 0, claudePlayers: 0, codexPlayers: 0, last: null });
});
