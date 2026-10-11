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
  assert.ok(Object.values(r.found).every((x) => x === false));
  assert.deepEqual(r.windows, []);
});

test("privacy: payload has only the six fields; no prompt, code, path or project text", () => {
  const payload = JSON.stringify({ windows: run().windows });
  for (const s of ["SECRET", "stealth", "pricing", "Users", "yuki", "msg_", "req_", "claude-sonnet", "Edit"]) assert.ok(!payload.includes(s), s);
  for (const w of run().windows) assert.deepEqual(Object.keys(w), ["tool", "input", "output", "cache", "windowStart", "windowEnd"]);
});

// ---- TUI degrades to plain text when not a TTY (CI, pipes, --plain, --yes) ----
import { spawnSync } from "node:child_process";
// @ts-ignore plain .mjs
import { palette, toolBars, payloadPreview, wordmark, fuelRank } from "../cli/banzuke.mjs";
const cli = join(__dirname, "..", "cli", "banzuke.mjs");
const sh = (...args: string[]) => spawnSync(process.execPath, [cli, "--home", home, "--now", "2026-10-11T04:00:00Z", ...args],
  { encoding: "utf8", env: { ...process.env, BANZUKE_STATE: join(home, "nope", "state.json"), GITHUB_TOKEN: "" } });
const ESC = /\x1b\[/;

test("plain: piped dry run prints totals + exact payload, no ANSI, sends nothing", () => {
  const r = sh("--dry-run");
  assert.equal(r.status, 0);
  assert.ok(!ESC.test(r.stdout), "no escape codes");
  assert.match(r.stdout, /Claude Code\s+input 107\s+output 53\s+cache 3,010/);
  assert.match(r.stdout, /Dry run: nothing sent/);
  const json = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1));
  assert.equal(json.windows.length, 3);
});

test("plain: no TTY and no --yes never sends", () => {
  const r = sh("--plain");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Not sent \(no terminal to confirm\)/);
});

test("plain: --help lists the flags", () => {
  const r = sh("--help");
  for (const f of ["--dry-run", "--yes", "--plain", "--watch", "--full", "--onboard", "--home"]) assert.ok(r.stdout.includes(f), f);
});

test("render helpers: colorless output has no escapes; color uses teal", () => {
  const off = palette(false), on = palette(true, { COLORTERM: "truecolor" }), on256 = palette(true, {});
  const ws = run().windows, found = { claude: true, codex: true };
  for (const s of [toolBars(ws, found, off), payloadPreview(ws, off), wordmark(off)]) assert.ok(!ESC.test(s));
  assert.ok(wordmark(on).includes("38;2;91;189;186") && wordmark(on).includes("番付"));
  assert.ok(wordmark(on256).includes("38;5;73"));
  assert.ok(!payloadPreview(ws, off).match(/SECRET|stealth|Users/));
  assert.deepEqual(fuelRank({ players: [{ login: "a", total: 9 }, { login: "RaitoXLOL", total: 5 }] }, "raitoxlol"), { rank: 2, of: 2, total: 5 });
  assert.equal(fuelRank(null, "x"), null);
});
