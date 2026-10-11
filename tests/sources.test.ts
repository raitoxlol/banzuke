// New fuel sources (OpenCode, Devin CLI, provider usage APIs), the shared tool registry, --demo and zero usage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// @ts-ignore plain .mjs
import { collect, collectApi, demoData, emptyMessage } from "../cli/banzuke.mjs";
// @ts-ignore plain .mjs
import { sqliteBackend, devinRowEvents, opencodeRowEvents } from "../cli/sources.mjs";
import { TOOLS, TOOL_IDS } from "../lib/tools.mjs";
import { cleanWindows, summarize, HOUR } from "../lib/fuel";

const fx = join(__dirname, "fixtures");
const now = Date.parse("2026-10-11T04:00:00Z");
const H2 = Date.parse("2026-10-11T02:00:00Z"), H3 = Date.parse("2026-10-11T03:00:00Z");
const win = (tool: string, input: number, output: number, cache: number, s: number) => ({ tool, input, output, cache, windowStart: s, windowEnd: s + HOUR });
const SIX = ["tool", "input", "output", "cache", "windowStart", "windowEnd"];
const SECRETS = ["SECRET", "stealth", "pricing", "Users", "yuki", "msg_", "ses_", "req_", "claude-sonnet", "swe-1", "Edit", "tartan"];
const noSqlite = !sqliteBackend() && "no node:sqlite or sqlite3 binary";

test("OpenCode SQLite (session_message, 2.x): reasoning->output, cache read+write, compaction counted, user rows ignored; DB wins over legacy JSON", { skip: noSqlite }, () => {
  const r = collect({ home: join(fx, "home2"), now, env: {} });
  assert.equal(r.found.opencode, true);
  assert.deepEqual(r.windows.filter((w: any) => w.tool === "opencode"), [win("opencode", 100, 50, 550, H2), win("opencode", 6, 7, 3, H3)]);
});

test("OpenCode legacy JSON (0.x storage/message): assistant only", () => {
  const r = collect({ home: join(fx, "home3"), now, env: {} });
  assert.deepEqual(r.windows, [win("opencode", 10, 5, 22, H2)]);
});

test("Devin CLI sessions.db: metrics from chat_message JSON, retries deduped by request_id, s/ISO timestamps", { skip: noSqlite }, () => {
  const r = collect({ home: join(fx, "home2"), now, env: {} });
  assert.deepEqual(r.windows.filter((w: any) => w.tool === "devin"), [win("devin", 200, 30, 1000, H2), win("devin", 7, 1, 20, H3)]);
});

test("SQLite sources without a backend: found, nothing sent, clear note", () => {
  const r = collect({ home: join(fx, "home2"), now, env: {}, sqlite: null });
  assert.match(r.notes.devin, /sqlite3/);
  assert.match(r.notes.opencode, /sqlite3/);
  assert.equal(r.windows.filter((w: any) => w.tool === "devin").length, 0);
});

test("row parsers are pure and defensive", () => {
  assert.deepEqual(devinRowEvents([{ rid: null, at: "bad" }, { rid: "x", at: 1760000000, i: -5, o: "9" }]), [{ at: 1760000000000, input: 0, output: 0, cache: 0 }]);
  assert.deepEqual(opencodeRowEvents([{ at: 5, i: 1, o: 1, r: 1, cr: null, cw: 2 }]), [{ at: 5, input: 1, output: 2, cache: 2 }]);
});

// ---- provider usage APIs: fake fetch records every request ----
function fakeFetch(routes: Record<string, any[]>) {
  const calls: { url: string; init: any }[] = [];
  const f = async (url: string, init: any) => { calls.push({ url, init }); const host = new URL(url).host; const body = routes[host].shift(); return { ok: true, status: 200, json: async () => body }; };
  return { f, calls };
}
const env = { ANTHROPIC_ADMIN_KEY: "sk-ant-admin-AAA", OPENAI_ADMIN_KEY: "sk-admin-OOO", XAI_MANAGEMENT_KEY: "xai-mgmt-XXX", XAI_TEAM_ID: "team1" };

test("APIs: Anthropic (paged), OpenAI (cached split), xAI (total) -> hourly windows; each key only goes to its own host", async () => {
  const { f, calls } = fakeFetch({
    "api.anthropic.com": [
      { data: [{ starting_at: "2026-10-11T02:00:00Z", ending_at: "2026-10-11T03:00:00Z", results: [{ uncached_input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 2 }, model: "claude-SECRET", workspace_id: "wrkspc_SECRET" }] }], has_more: true, next_page: "p2" },
      { data: [{ starting_at: "2026-10-11T03:00:00Z", results: [] }], has_more: false, next_page: null },
    ],
    "api.openai.com": [{ data: [{ start_time: H3 / 1000, end_time: H3 / 1000 + 3600, results: [{ input_tokens: 1000, input_cached_tokens: 400, output_tokens: 50, project_id: "proj_SECRET" }] }], has_more: false }],
    "management-api.x.ai": [{ timeSeries: [{ group: [], dataPoints: [{ timestamp: "2026-10-11T02:00:00Z", values: [77] }, { timestamp: "2026-10-11T03:00:00Z", values: [0] }] }], limitReached: false }],
  });
  const r = await collectApi({ now, env, fetch: f });
  assert.deepEqual(r.notes, {});
  assert.deepEqual(r.windows, [win("anthropic-api", 10, 5, 103, H2), win("openai-api", 600, 50, 400, H3), win("xai-api", 77, 0, 0, H2), win("xai-api", 0, 0, 0, H3)]);
  assert.ok(calls[1].url.includes("page=p2") || calls.some((c) => c.url.includes("page=p2")));
  const own: Record<string, string> = { "api.anthropic.com": env.ANTHROPIC_ADMIN_KEY, "api.openai.com": env.OPENAI_ADMIN_KEY, "management-api.x.ai": env.XAI_MANAGEMENT_KEY };
  for (const c of calls) {
    const sent = JSON.stringify(c.init) + c.url, host = new URL(c.url).host;
    for (const [h, k] of Object.entries(own)) assert.equal(sent.includes(k), h === host, `${k} -> ${host}`);
  }
  const payload = JSON.stringify(r.windows);
  for (const k of [...Object.values(env), "SECRET"]) assert.ok(!payload.includes(k));
});

test("APIs: off without keys; provider errors become notes with keys scrubbed", async () => {
  assert.deepEqual((await collectApi({ now, env: {}, fetch: async () => { throw new Error("no"); } })).windows, []);
  const r = await collectApi({ now, env: { OPENAI_ADMIN_KEY: "sk-admin-OOO" }, fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }) as any });
  assert.match(r.notes["openai-api"], /401/);
  assert.equal(r.found["openai-api"], true);
});

// ---- registry ----
test("registry: one list drives the gate, summarize and the TS type", () => {
  for (const id of TOOL_IDS) assert.doesNotThrow(() => cleanWindows({ windows: [win(id, 1, 1, 1, H3)] }, now));
  assert.throws(() => cleanWindows({ windows: [win("cursor", 1, 1, 1, H3)] }, now));
  const dts = readFileSync(join(__dirname, "..", "lib", "tools.d.mts"), "utf8");
  assert.deepEqual([...dts.match(/type ToolId = ([^;]+);/)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]), [...TOOL_IDS]);
  assert.equal(new Set(TOOLS.map((t) => t.color)).size, TOOLS.length);
  const s = summarize([{ ...win("opencode", 5, 0, 0, H3), login: "a", team: 0 }, { ...win("anthropic-api", 2, 0, 0, H3), login: "a", team: 0 }] as any);
  assert.equal(s.tools.opencode, 5); assert.deepEqual(s.sides, { claude: 2, codex: 0 }); assert.equal(s.players[0].top, "opencode");
});

test("privacy: new sources emit only the six fields and no text", { skip: noSqlite }, () => {
  const ws = [...collect({ home: join(fx, "home2"), now, env: {} }).windows, ...collect({ home: join(fx, "home3"), now, env: {} }).windows];
  assert.ok(ws.length >= 5);
  const payload = JSON.stringify({ windows: ws });
  for (const s of SECRETS) assert.ok(!payload.includes(s), s);
  for (const w of ws) assert.deepEqual(Object.keys(w), SIX);
});

// ---- zero usage + demo ----
const cli = join(__dirname, "..", "cli", "banzuke.mjs");
const sh = (home: string, at: string, ...args: string[]) => spawnSync(process.execPath, [cli, "--home", home, "--now", at, ...args],
  { encoding: "utf8", env: { ...process.env, BANZUKE_STATE: join(fx, "nope", "state.json"), GITHUB_TOKEN: "", XDG_DATA_HOME: "", CODEX_HOME: "" } });

test("plain: logs present but zero usage in the window says so and points at --watch", () => {
  const r = sh(join(fx, "home"), "2026-10-20T00:00:00Z", "--plain");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No Claude Code\/Codex usage in the last 72h on this machine\. Run with --watch/);
  assert.equal(emptyMessage({ claude: true }, 123), "Nothing new since last sync.");
});

test("--demo: sample totals for every local tool, reads no logs, never sends", () => {
  const r = sh(join(fx, "nope"), "2026-10-11T04:00:00Z", "--demo", "--yes");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /OpenCode\s+input/); assert.match(r.stdout, /Devin CLI\s+input/);
  assert.match(r.stdout, /Demo: sample data, nothing sent/);
  const d = demoData(now);
  for (const w of d.windows) assert.doesNotThrow(() => cleanWindows({ windows: [w] }, now));
});
