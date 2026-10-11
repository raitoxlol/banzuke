import { test } from "node:test";
import assert from "node:assert/strict";
import { sortIntoStable, preferred, smallest, whyTag, QUESTIONS, type Answers } from "../lib/quiz";
import { AGENT_IDS } from "../lib/agents";

const a = (o: Partial<Answers>): Answers => ({ tool: "claude", hour: "3pm", indent: "spaces", friday: "no", ...o });
const empty = [0, 0, 0, 0, 0, 0];

test("quiz offers every agent in the race, not just two", () => {
  assert.deepEqual(QUESTIONS[0].opts.map(([id]) => id), AGENT_IDS);
  assert.ok(AGENT_IDS.length >= 8);
});

test("answers map to a group in range; flavor drives the row", () => {
  assert.equal(sortIntoStable(a({ hour: "3am" }), empty), 0);
  assert.equal(sortIntoStable(a({ tool: "codex", hour: "3am" }), empty), 1);
  assert.equal(sortIntoStable(a({}), empty), 2);
  assert.equal(sortIntoStable(a({ tool: "codex", friday: "yes" }), empty), 5);
  for (const tool of AGENT_IDS) { const t = sortIntoStable(a({ tool }), empty); assert.ok(t >= 0 && t < 6); }
});

test("overfull preferred group spills to smallest sibling; same answers stay balanced", () => {
  assert.equal(sortIntoStable(a({ hour: "3am" }), [5, 0, 3, 0, 4, 0]), 2);
  const sizes = [...empty];
  for (let i = 0; i < 30; i++) sizes[sortIntoStable(a({ tool: "codex", hour: "3am" }), sizes)]++;
  const odd = [sizes[1], sizes[3], sizes[5]];
  assert.ok(Math.max(...odd) - Math.min(...odd) <= 2, String(odd));
});

test("skip falls back to smallest group; tag", () => {
  assert.equal(smallest([2, 1, 1, 3, 3, 3]), 1);
  assert.equal(preferred(a({ tool: "codex", hour: "3am" })), 1);
  assert.equal(whyTag(a({ tool: "cursor", hour: "3am" })), "Cursor · 3am");
  assert.equal(whyTag(undefined), "");
});
