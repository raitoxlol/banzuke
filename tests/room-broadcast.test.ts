import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBroadcast, jstDeadlineForDay, remainingSeconds, type RoomData } from "../lib/room-broadcast";
import { tallyRace } from "../lib/agents";

const play = (overrides: Partial<RoomData["plays"][number]> = {}): RoomData["plays"][number] => ({
  id: "play", login: "builder", team: 0, kind: "push", points: 5, at: 1,
  private: false, repo: "builder/project", summary: "ship a feature", ...overrides,
});

test("broadcast ranks real builders, tags agents (detected > pick > human), keeps zero-score members and orphans", () => {
  const data: RoomData = {
    players: [
      { login: "builder", avatar: "", team: 2, answers: { tool: "codex", hour: "3am", indent: "tabs", friday: "yes" } },
      { login: "waiting", avatar: "", team: 5 },
    ],
    plays: [play({ id: "old", points: 12, at: 1 }), play({ id: "new", points: 12, at: 2, agent: "cursor" }), play({ id: "orphan", login: "missing", team: 1, points: 10, at: 3 })],
  };
  const model = deriveBroadcast(data);
  assert.deepEqual(model.builders.map(({ login, score }) => [login, score]), [["builder", 24], ["missing", 10], ["waiting", 0]]);
  assert.deepEqual(model.race, tallyRace(data.players, data.plays));
  assert.equal(model.feed.find((e) => e.id === "old")?.agent, "codex");
  assert.equal(model.feed.find((e) => e.id === "new")?.agent, "cursor");
  assert.equal(model.feed[0].id, "orphan");
  assert.equal(model.feed[0].agent, "human");
  assert.ok(/Team (Blue|Orange) に\+10点/.test(model.commentary));
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
    assert.ok(model.commentary.includes("非公開リポジトリ"));
    const serialized = JSON.stringify(model);
    for (const secret of ["hidden-launch", "SECRET", "pricing implementation"]) assert.ok(!serialized.includes(secret), `${kind} leaked ${secret}`);
  }
});

test("broadcast is deterministic and empty means empty (no mock data)", () => {
  const a = play({ id: "a", login: "left", at: 10 });
  const b = play({ id: "b", login: "right", at: 10 });
  assert.deepEqual(deriveBroadcast({ players: [], plays: [b, a] }), deriveBroadcast({ players: [], plays: [a, b] }));
  assert.deepEqual(deriveBroadcast({ players: [], plays: [a] }).feed.map((e) => e.id), ["a"]);
  const empty = deriveBroadcast({ players: [], plays: [] });
  assert.equal(empty.race.total, 0);
  assert.equal(empty.feed.length, 0);
  assert.equal(empty.builders.length, 0);
  assert.ok(empty.commentary.includes("最初のプッシュを待っています"));
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
