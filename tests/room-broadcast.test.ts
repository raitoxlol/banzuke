import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBroadcast, jstDeadlineForDay, remainingSeconds, type RoomData } from "../lib/room-broadcast";
import { tallySides } from "../lib/sides";

const play = (overrides: Partial<RoomData["plays"][number]> = {}): RoomData["plays"][number] => ({
  id: "play", login: "builder", team: 0, kind: "push", points: 5, at: 1,
  private: false, repo: "builder/project", summary: "ship a feature", ...overrides,
});

test("broadcast preserves stored push scores, zero-score members, current membership, and orphan plays", () => {
  const data: RoomData = {
    players: [
      { login: "builder", avatar: "", team: 2, answers: { tool: "codex", hour: "3am", indent: "tabs", friday: "yes" } },
      { login: "waiting", avatar: "", team: 5 },
    ],
    plays: [play({ id: "old", points: 12, at: 1 }), play({ id: "new", points: 12, at: 2 }), play({ id: "orphan", login: "missing", team: 1, points: 10, at: 3 })],
  };
  const model = deriveBroadcast(data);
  assert.equal(model.stables.length, 6);
  assert.deepEqual(model.stables.map(({ id, score, builders }) => ({ id, score, builders })), [
    { id: 2, score: 24, builders: 1 }, { id: 1, score: 10, builders: 1 },
    { id: 0, score: 0, builders: 0 }, { id: 3, score: 0, builders: 0 },
    { id: 4, score: 0, builders: 0 }, { id: 5, score: 0, builders: 1 },
  ]);
  assert.deepEqual(model.sides, tallySides(data.players, data.plays));
  assert.equal(model.feed.find((entry) => entry.id === "new")?.side, "codex");
  assert.equal(model.feed.find((entry) => entry.id === "new")?.team, 2);
  assert.equal(model.feed[0].id, "orphan");
  assert.equal(model.feed[0].side, "codex");
  assert.ok(model.commentary.includes("+10 for Codex Yoake"));
  assert.deepEqual(data.plays.map((entry) => entry.id), ["old", "new", "orphan"]);
});

test("broadcast masks tampered private repo and summary before safe entries and commentary", () => {
  for (const kind of ["push", "pr_merged", "release"] satisfies RoomData["plays"][number]["kind"][]) {
    const model = deriveBroadcast({ players: [], plays: [play({ kind, private: true, repo: "acme/hidden-launch", summary: "SECRET pricing implementation" })] });
    assert.equal(model.feed[0].label, "a private repo");
    assert.equal(model.feed[0].points, 5);
    assert.equal(model.feed[0].login, "builder");
    assert.equal("repo" in model.feed[0], false);
    assert.equal("summary" in model.feed[0], false);
    assert.ok(model.commentary.includes("a private repo"));
    const serialized = JSON.stringify(model);
    for (const secret of ["hidden-launch", "SECRET", "pricing implementation"]) assert.ok(!serialized.includes(secret), `${kind} leaked ${secret}`);
  }
});

test("broadcast deterministically orders tied stable scores and same-time plays", () => {
  const a = play({ id: "a", login: "left", team: 0, at: 10 });
  const b = play({ id: "b", login: "right", team: 1, at: 10 });
  const first = deriveBroadcast({ players: [], plays: [b, a] });
  const second = deriveBroadcast({ players: [], plays: [a, b] });
  assert.deepEqual(first, second);
  assert.deepEqual(first.stables.map((stable) => stable.id), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(first.feed.map((entry) => entry.id), ["a", "b"]);
  const empty = deriveBroadcast({ players: [], plays: [] });
  assert.equal(empty.sides.claude + empty.sides.codex, 0);
  assert.equal(empty.feed.length, 0);
  assert.ok(empty.commentary.includes("Join the match"));
});

test("JST deadline uses the Japanese calendar day across UTC and JST midnight boundaries", () => {
  const cases = [
    ["2026-10-11T00:00:00Z", "2026-10-11T09:00:00Z"],
    ["2026-10-11T08:59:59Z", "2026-10-11T09:00:00Z"],
    ["2026-10-11T09:00:00Z", "2026-10-11T09:00:00Z"],
    ["2026-10-11T14:59:59Z", "2026-10-11T09:00:00Z"],
    ["2026-10-11T15:00:00Z", "2026-10-12T09:00:00Z"],
    ["2026-12-31T15:00:00Z", "2027-01-01T09:00:00Z"],
  ];
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timezone;
      for (const [now, deadline] of cases) assert.equal(jstDeadlineForDay(Date.parse(now)), Date.parse(deadline), `${timezone}: ${now}`);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("captured countdown rounds up and holds zero after the deadline, including the next JST day", () => {
  const deadlineMs = jstDeadlineForDay(Date.parse("2026-10-11T08:00:00Z"));
  assert.equal(remainingSeconds({ deadlineMs, nowMs: deadlineMs - 1 }), 1);
  assert.equal(remainingSeconds({ deadlineMs, nowMs: deadlineMs - 3600_000 }), 3600);
  assert.equal(remainingSeconds({ deadlineMs, nowMs: deadlineMs }), 0);
  assert.equal(remainingSeconds({ deadlineMs, nowMs: Date.parse("2026-10-11T15:00:00Z") }), 0);
  assert.equal(remainingSeconds({ deadlineMs, nowMs: deadlineMs + 24 * 3600_000 }), 0);
});
