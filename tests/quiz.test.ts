import { test } from "node:test";
import assert from "node:assert/strict";
import { sortIntoStable, preferred, smallest, side, whyTag, type Answers } from "../lib/quiz";

const a = (o: Partial<Answers>): Answers => ({ tool: "claude", hour: "3pm", indent: "spaces", friday: "no", ...o });
const empty = [0, 0, 0, 0, 0, 0];

test("answers map to the expected stable", () => {
  assert.equal(sortIntoStable(a({ hour: "3am" }), empty), 0);
  assert.equal(sortIntoStable(a({ tool: "codex", hour: "3am" }), empty), 1);
  assert.equal(sortIntoStable(a({}), empty), 2);
  assert.equal(sortIntoStable(a({ tool: "codex" }), empty), 3);
  assert.equal(sortIntoStable(a({ friday: "yes", hour: "3am" }), empty), 4);
  assert.equal(sortIntoStable(a({ tool: "codex", friday: "yes" }), empty), 5);
});

test("tool side never flips; overfull preferred stable spills to smallest sibling", () => {
  const sizes = [5, 0, 3, 0, 4, 0];
  const t = sortIntoStable(a({ hour: "3am" }), sizes);
  assert.equal(t, 2);
  assert.equal(side(t), "Claude Code");
  assert.equal(sortIntoStable(a({ hour: "3am" }), [4, 9, 3, 9, 9, 9]), 0); // within 1: keep identity
});

test("everyone the same answers stays balanced within the side", () => {
  const sizes = [...empty];
  for (let i = 0; i < 30; i++) sizes[sortIntoStable(a({ tool: "codex", hour: "3am" }), sizes)]++;
  const codex = [sizes[1], sizes[3], sizes[5]];
  assert.ok(Math.max(...codex) - Math.min(...codex) <= 2, String(codex));
  assert.equal(sizes[0] + sizes[2] + sizes[4], 0);
});

test("skip falls back to smallest stable; tag", () => {
  assert.equal(smallest([2, 1, 1, 3, 3, 3]), 1);
  assert.equal(preferred(a({ tool: "codex", hour: "3am" })), 1);
  assert.equal(whyTag(a({ tool: "codex", hour: "3am" })), "Codex · 3am");
  assert.equal(whyTag(undefined), "");
});
