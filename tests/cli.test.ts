// Token-counter CLI: log parsing against fixtures + proof that only counts leave the machine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
// @ts-ignore plain .mjs, zero-dep CLI
import { collect, buckets } from "../cli/banzuke.mjs";

const home = join(__dirname, "fixtures", "home");
const now = Date.parse("2026-10-11T04:00:00Z");
const run = (lastSync = 0) => collect({ home, now, lastSync });

test("Claude Code: sums usage, dedupes streamed repeats, buckets by hour", () => {
  const c = run().windows.filter((w: any) => w.tool === "claude");
  assert.deepEqual(c, [
    { tool: "claude", input: 100, output: 50, cache: 3000, windowStart: Date.parse("2026-10-11T02:00:00Z"), windowEnd: Date.parse("2026-10-11T03:00:00Z") },
    { tool: "claude", input: 7, output: 3, cache: 10, windowStart: Date.parse("2026-10-11T03:00:00Z"), windowEnd: Date.parse("2026-10-11T04:00:00Z") },
  ]);
});

test("Codex: last_token_usage, cached split out of input, null info and repeated totals skipped", () => {
  const x = run().windows.filter((w: any) => w.tool === "codex");
  assert.deepEqual(x, [{ tool: "codex", input: 1500, output: 500, cache: 5500, windowStart: Date.parse("2026-10-11T02:00:00Z"), windowEnd: Date.parse("2026-10-11T03:00:00Z") }]);
});

test("window: 72h cap and since-last-sync", () => {
  assert.equal(collect({ home, now: now + 80 * 3600_000 }).windows.length, 0);
  const since = run(Date.parse("2026-10-11T03:20:00Z")).windows;
  assert.deepEqual(since.map((w: any) => w.tool), ["claude"]);
  assert.equal(buckets("claude", [{ at: now, input: 1, output: 1, cache: 1 }], 0, now).length, 0); // end exclusive
});

test("missing dirs: nothing found, nothing sent", () => {
  const r = collect({ home: join(home, "nope"), now });
  assert.deepEqual(r.found, { claude: false, codex: false });
  assert.deepEqual(r.windows, []);
});

test("privacy: payload has only the six fields; no prompt, code, path or project text", () => {
  const payload = JSON.stringify({ windows: run().windows });
  for (const s of ["SECRET", "stealth", "pricing", "Users", "yuki", "msg_", "req_", "claude-sonnet", "Edit"]) assert.ok(!payload.includes(s), s);
  for (const w of run().windows) assert.deepEqual(Object.keys(w), ["tool", "input", "output", "cache", "windowStart", "windowEnd"]);
});
