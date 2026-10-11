// Server gate + aggregation for AI fuel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanWindows, summarize, HOUR } from "../lib/fuel";

const now = Date.parse("2026-10-11T04:30:00Z");
const h = Date.parse("2026-10-11T03:00:00Z");
const w = { tool: "claude", input: 1, output: 2, cache: 3, windowStart: h, windowEnd: h + HOUR };

test("gate keeps only the six fields; extra text is dropped", () => {
  const [c] = cleanWindows({ windows: [{ ...w, prompt: "SECRET_PROMPT", cwd: "/Users/yuki/stealth" }] }, now);
  assert.deepEqual(c, w);
  assert.ok(!JSON.stringify(c).includes("SECRET"));
});

test("gate rejects garbage", () => {
  for (const bad of [{ ...w, tool: "gpt" }, { ...w, input: -1 }, { ...w, output: 1.5 }, { ...w, cache: "9" },
    { ...w, windowStart: h + 1, windowEnd: h + 1 + HOUR }, { ...w, windowEnd: h + 2 * HOUR },
    { ...w, windowStart: h - 80 * HOUR, windowEnd: h - 79 * HOUR }, { ...w, windowStart: h + 2 * HOUR, windowEnd: h + 3 * HOUR }])
    assert.throws(() => cleanWindows({ windows: [bad] }, now), JSON.stringify(bad));
  assert.throws(() => cleanWindows({}, now));
});

test("summarize: tools, players, stables", () => {
  const s = summarize([
    { ...w, tool: "claude", login: "a", team: 0 }, { ...w, tool: "codex", login: "b", team: 1, input: 100 },
    { ...w, tool: "codex", login: "a", team: 0 },
  ] as any);
  assert.deepEqual(s.tools, { claude: 6, codex: 111 });
  assert.deepEqual(s.players.map((p) => [p.login, p.total]), [["b", 105], ["a", 12]]);
  assert.deepEqual(s.stables, [{ team: 1, total: 105 }, { team: 0, total: 12 }]);
});
