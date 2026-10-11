import test from "node:test";
import assert from "node:assert/strict";
import { teamNames, teamOf, tallyTeams, TEAMS } from "../lib/teams";

test("team names are deterministic and distinct", () => {
  assert.deepEqual([...TEAMS], ["Team Blue", "Team Orange"]); assert.equal(teamOf("raitoxlol"), 1);
  for (const s of ["a", "b", "c", "x"]) { const [a, b] = teamNames(s); assert.notEqual(a.split(" ")[1], b.split(" ")[1]); }
});
test("assignment is deterministic, case-insensitive, and roughly balanced", () => {
  assert.equal(teamOf("RaitoXlol"), teamOf("raitoxlol"));
  const n = Array.from({ length: 400 }, (_, i) => teamOf(`user${i}`)).filter((t) => t === 0).length;
  assert.ok(n > 160 && n < 240, String(n));
});
test("tally + lead", () => {
  const ps = ["u1", "u2", "u3", "u4", "u5", "u6"].map((login) => ({ login }));
  const t = tallyTeams(ps, ps.map((p, i) => ({ id: String(i), login: p.login, points: i + 1, at: i })));
  assert.equal(t.total, 21); assert.equal(t.sides[0].points + t.sides[1].points, 21);
  assert.equal(t.last!.team, teamOf("u6"));
});
