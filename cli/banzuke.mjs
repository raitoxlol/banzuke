#!/usr/bin/env node
// Banzuke AI-fuel sync. Zero deps. Reads local Claude Code / Codex / OpenCode / Devin CLI logs (and, opt-in, provider usage APIs) for token COUNTS only and posts
// hourly totals {tool, input, output, cache, windowStart, windowEnd}. Prompts, code, paths and project
// names are never read into the payload: each log line is parsed and only numeric usage fields are kept.
import { realpathSync, readFileSync, writeFileSync } from "node:fs";
import { TOOLS } from "../lib/tools.mjs";
import { LOCAL_SOURCES, API_SOURCES, apiConfigured, sqliteBackend } from "./sources.mjs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createInterface, emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";

export const HOUR = 3600_000;
export const WINDOW_HOURS = 72;
const ENDPOINT = "https://fantastic-lapwing-798.ap-southeast-2.convex.site/tokens";
const QUERY = "https://fantastic-lapwing-798.ap-southeast-2.convex.cloud/api/query";
const JOIN = "https://racing-charcoal-9xinp40.vercel.app/join";
const WATCH_MS = 10 * 60_000;
export const STABLES = ["Claude Yoake", "Codex Yoake", "Claude Hiru", "Codex Hiru", "Claude Ippatsu", "Codex Ippatsu"];

export { claudeEvents, codexEvents, opencodeEvent, devinRowEvents, opencodeJsonEvents, opencodeRowEvents } from "./sources.mjs";

/** Hourly buckets in [from, to). The server upserts per (login, tool, windowStart), so re-syncing never double counts. */
export function buckets(tool, events, from, to) {
  const m = new Map();
  for (const e of events) {
    if (e.at < from || e.at >= to) continue;
    const s = Math.floor(e.at / HOUR) * HOUR;
    const b = m.get(s) ?? { tool, input: 0, output: 0, cache: 0, windowStart: s, windowEnd: s + HOUR };
    b.input += e.input; b.output += e.output; b.cache += e.cache; m.set(s, b);
  }
  return [...m.values()].sort((a, b) => a.windowStart - b.windowStart);
}
/** The six fields, in order. This is the whole payload shape. */
const six = ({ tool, input, output, cache, windowStart, windowEnd }) => ({ tool, input, output, cache, windowStart, windowEnd });
const windowFrom = (now, lastSync) => {
  const floor = Math.floor((now - WINDOW_HOURS * HOUR) / HOUR) * HOUR;
  // Since-last-sync: resend from the hour of the last sync (it may have been partial); 72h on first run.
  return lastSync ? Math.max(floor, Math.floor(lastSync / HOUR) * HOUR) : floor;
};

/** Local logs -> everything that leaves the machine. found/notes are per tool id (lib/tools.mjs). */
export function collect({ home = homedir(), now = Date.now(), lastSync = 0, env = process.env, sqlite } = {}) {
  const from = windowFrom(now, lastSync);
  const found = {}, notes = {}, windows = [];
  let backend = sqlite;
  for (const [id, src] of Object.entries(LOCAL_SOURCES)) {
    found[id] = src.found(home, env);
    if (!found[id]) continue;
    if (backend === undefined) backend = sqliteBackend();
    const { events, note } = src.read({ home, env, from, sqlite: backend });
    if (note) notes[id] = note;
    windows.push(...buckets(id, events, from, now).map(six));
  }
  return { found, notes, from, windows };
}

/** Opt-in (--api): hourly totals from provider usage APIs, for each provider whose env keys are set.
 *  Keys are sent only to that provider. Errors are reported per provider, never thrown. */
export async function collectApi({ now = Date.now(), lastSync = 0, env = process.env, fetch: f = globalThis.fetch } = {}) {
  const from = windowFrom(now, lastSync);
  const found = {}, notes = {}, windows = [];
  await Promise.all(Object.entries(API_SOURCES).map(async ([id, src]) => {
    if (!(found[id] = apiConfigured(id, env))) return;
    try { windows.push(...buckets(id, await src.pull({ env, from, now, fetch: f }), from, now).map(six)); }
    catch (e) { notes[id] = String(e?.message ?? e).replace(/(sk-|xai-)[\w-]+/g, "[key]"); }
  }));
  const order = Object.keys(API_SOURCES);
  windows.sort((a, b) => order.indexOf(a.tool) - order.indexOf(b.tool) || a.windowStart - b.windowStart);
  return { found, notes, from, windows };
}

/** --demo: bundled sample totals for the stage. No logs are read and nothing is ever sent. */
export function demoData(now) {
  const h = Math.floor(now / HOUR) * HOUR; const found = {}, windows = [];
  const plan = { claude: [42e3, 9e3, 610e3], codex: [88e3, 12e3, 1.4e6], opencode: [15e3, 4e3, 120e3], devin: [6e3, 2e3, 30e3] };
  for (const [id, [i, o, c]] of Object.entries(plan)) { found[id] = true;
    for (let k = 6; k >= 1; k--) { const f = (k % 3) + 1; windows.push({ tool: id, input: i * f, output: o * f, cache: c * f, windowStart: h - k * HOUR, windowEnd: h - k * HOUR + HOUR }); } }
  return { found, notes: {}, from: h - WINDOW_HOURS * HOUR, windows, demo: true };
}
/** What to say when there's nothing to send: zero usage in the window vs nothing new since last sync. */
export function emptyMessage(found, lastSync) {
  if (lastSync) return "Nothing new since last sync.";
  const names = TOOLS.filter((t) => found[t.id]).map((t) => t.label).join("/") || "AI tool";
  return `No ${names} usage in the last ${WINDOW_HOURS}h on this machine.`;
}

/** Local + (when asked) API, merged. */
export async function collectAll(o) {
  if (o.demo) return demoData(o.now ?? Date.now());
  const local = collect(o);
  if (!o.api) return local;
  const api = await collectApi(o);
  return { found: { ...local.found, ...api.found }, notes: { ...local.notes, ...api.notes }, from: local.from, windows: [...local.windows, ...api.windows] };
}

// ---------- environment probes (all failures degrade to "unknown", never crash) ----------
function ghToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
}
async function ghLogin(token) {
  if (!token) return "";
  try { const r = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${token}`, "user-agent": "banzuke-cli" }, signal: AbortSignal.timeout(5000) }); return r.ok ? (await r.json()).login ?? "" : ""; } catch { return ""; }
}
async function convexQuery(path) {
  try {
    const r = await fetch(QUERY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, args: {}, format: "json" }), signal: AbortSignal.timeout(6000) });
    const j = await r.json(); return j.status === "success" ? j.value : null;
  } catch { return null; }
}
/** Room membership via the public board query. null = couldn't check (offline); the POST's 403 is the real gate. */
async function roomPlayer(login) {
  if (!login) return null;
  const b = await convexQuery("room:board"); if (!b) return null;
  return b.players.find((p) => p.login.toLowerCase() === login.toLowerCase()) ?? false;
}
/** Fuel rank from fuel:totals: { rank, of, total } or null. */
export function fuelRank(totals, login) {
  const ps = totals?.players ?? []; const i = ps.findIndex((p) => p.login.toLowerCase() === login?.toLowerCase());
  return i < 0 ? null : { rank: i + 1, of: ps.length, total: ps[i].total };
}

// ---------- rendering (pure; color is a parameter so plain mode and tests get no escapes) ----------
export function palette(on, env = process.env) {
  const truecolor = /truecolor|24bit/i.test(env.COLORTERM ?? "") || env.TERM_PROGRAM === "iTerm.app";
  const fg = (rgb, c256) => (s) => on ? `\x1b[${truecolor ? `38;2;${rgb}` : `38;5;${c256}`}m${s}\x1b[39m` : String(s);
  const sgr = (a, b) => (s) => on ? `\x1b[${a}m${s}\x1b[${b}m` : String(s);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const c256 = ([r, g, b]) => 16 + 36 * Math.round(r / 51) + 6 * Math.round(g / 51) + Math.round(b / 51);
  const tool = Object.fromEntries(TOOLS.map((t) => [t.id, fg(hex(t.color).join(";"), c256(hex(t.color)))]));
  return { tool, teal: fg("91;189;186", 73), claude: tool.claude, codex: tool.codex, green: fg("111;191;142", 72), red: fg("224;122;138", 168), bold: sgr(1, 22), dim: sgr(2, 22), on };
}
const fmt = (x) => x.toLocaleString("en-US");
export const short = (x) => x >= 1e9 ? (x / 1e9).toFixed(1) + "B" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "k" : String(x);
export function totalsOf(windows) {
  const t = Object.fromEntries(TOOLS.map((x) => [x.id, { input: 0, output: 0, cache: 0 }]));
  for (const w of windows) { const x = t[w.tool]; if (!x) continue; x.input += w.input; x.output += w.output; x.cache += w.cache; }
  return t;
}
const sum = (x) => x.input + x.output + x.cache;
export function bar(v, max, width, c) { const f = max ? Math.max(v ? 1 : 0, Math.round((v / max) * width)) : 0; return c.on ? "█".repeat(f) + c.dim("░".repeat(width - f)) : "#".repeat(f) + ".".repeat(width - f); }
export function wordmark(c) {
  return ["", c.teal(c.bold("  ┏┓ ┏━┓┏┓╻╺━┓╻ ╻╻┏ ┏━╸")) , c.teal(c.bold("  ┣┻┓┣━┫┃┗┫┏━┛┃ ┃┣┻┓┣╸ ")) + "   " + c.teal(c.bold("番付")), c.teal(c.bold("  ┗━┛╹ ╹╹ ╹┗━╸┗━┛╹ ╹┗━╸")) + "   " + c.dim("AI fuel sync"), ""].join("\n");
}
/** One bar per tool that was found (local logs on disk, or API keys set), from the registry. */
export function toolBars(windows, found, c, notes = {}) {
  const t = totalsOf(windows); const shown = TOOLS.filter((x) => found[x.id] != null);
  const max = Math.max(0, ...shown.map((x) => sum(t[x.id])));
  return shown.map(({ id, label }) => { const col = c.tool[id], v = t[id];
    if (!found[id]) return `  ${c.dim(label.padEnd(13) + (API_SOURCES[id] ? " no API key set" : " no logs on this machine"))}`;
    const line = `  ${col(label.padEnd(13))} ${col(bar(sum(v), max, 24, c))} ${c.bold(short(sum(v)).padStart(7))} ${c.dim(`in ${short(v.input)} · out ${short(v.output)} · cache ${short(v.cache)}`)}`;
    return notes[id] ? `${line}\n  ${" ".repeat(13)} ${c.red("! " + notes[id])}` : line;
  }).join("\n");
}
export function payloadPreview(windows, c, full = false) {
  if (!windows.length) return c.dim("  (nothing new since last sync)");
  const rows = (full || windows.length <= 6 ? windows : [...windows.slice(0, 3), null, ...windows.slice(-2)]);
  const out = rows.map((w) => w ? c.dim("  ") + JSON.stringify(w) : c.dim(`  … ${windows.length - 5} more hourly rows, same six fields …`));
  return [c.dim(`  { "windows": [ ${windows.length} rows ] } — only tool, input, output, cache, windowStart, windowEnd`), ...out].join("\n");
}

// ---------- interaction ----------
/** Arrow-key menu. Returns the chosen value; Ctrl-C / q / Esc returns "quit". */
function menu(options, c) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process; let i = 0;
    const draw = (first) => { if (!first) stdout.write(`\x1b[${options.length}A`); for (const [k, o] of options.entries()) stdout.write(`\x1b[2K  ${k === i ? c.teal("❯ " + c.bold(o.label)) : "  " + o.label}  ${c.dim(o.hint ?? "")}\n`); };
    emitKeypressEvents(stdin); stdin.setRawMode(true); stdin.resume(); stdout.write("\x1b[?25l"); draw(true);
    const done = (v) => { stdin.off("keypress", onKey); stdin.setRawMode(false); stdin.pause(); stdout.write("\x1b[?25h"); resolve(v); };
    const onKey = (_s, key = {}) => {
      if (key.ctrl && key.name === "c" || key.name === "escape" || key.name === "q") return done("quit");
      if (key.name === "up" || key.name === "k") i = (i + options.length - 1) % options.length;
      else if (key.name === "down" || key.name === "j" || key.name === "tab") i = (i + 1) % options.length;
      else if (key.name === "return") return done(options[i].value);
      else { const m = options.findIndex((o) => o.key === _s); if (m >= 0) return done(options[m].value); return; }
      draw(false);
    };
    stdin.on("keypress", onKey);
  });
}
const ask = (q) => new Promise((r) => { const rl = createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); r(a); }); });
function spinner(text, c) {
  if (!c.on) return { stop() {} };
  const f = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"; let k = 0;
  const t = setInterval(() => process.stdout.write(`\r\x1b[2K  ${c.teal(f[k++ % f.length])} ${text}`), 80);
  return { stop(msg = "") { clearInterval(t); process.stdout.write(`\r\x1b[2K${msg ? msg + "\n" : ""}`); } };
}

// ---------- state ----------
const statePath = () => process.env.BANZUKE_STATE ?? join(homedir(), ".banzuke.json");
function loadState() { try { return JSON.parse(readFileSync(statePath(), "utf8")); } catch { return {}; } }
function saveState(s) { try { writeFileSync(statePath(), JSON.stringify(s, null, 1)); } catch { /* next run resends 72h; upserts make that safe */ } }

async function send(windows, token, endpoint) {
  const res = await fetch(endpoint ?? ENDPOINT, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ windows }) });
  const body = await res.text(); let json = null; try { json = JSON.parse(body); } catch {}
  return { ok: res.ok, status: res.status, body, json };
}
const rejectMsg = (r) => r.status === 403 ? `You're not in the room yet. Join at ${JOIN} first, then run banzuke again.` : r.status === 401 ? "GitHub token rejected. Run `gh auth login` (or set GITHUB_TOKEN) and try again." : `Rejected (${r.status}): ${r.body}`;

const HELP = `banzuke — share AI token totals (counts only) with the Banzuke room.

  banzuke             interactive (onboarding on first run, then a quick summary + confirm)
  --dry-run           show exactly what would be sent, send nothing
  --yes               send without asking (implies --plain)
  --plain             no colors/TUI, plain text (auto when not a terminal)
  --watch             keep running, resync every 10 min
  --full              ignore last sync, resend the whole 72h window
  --onboard           show the first-run walkthrough again
  --api               also pull hourly totals from provider usage APIs with your own admin keys:
                        ANTHROPIC_ADMIN_KEY, OPENAI_ADMIN_KEY, XAI_MANAGEMENT_KEY + XAI_TEAM_ID
                        (keys go only to that provider; also on with BANZUKE_API=1)
  --demo              sample totals for showing the TUI on stage (reads no logs, never sends)
  --home DIR          read logs under DIR instead of ~

Sources: Claude Code (~/.claude/projects), Codex (~/.codex/sessions), OpenCode (~/.local/share/opencode,
SQLite or legacy JSON), Devin CLI (~/.local/share/devin/cli/sessions.db). SQLite sources need Node >= 22.5
or the sqlite3 binary. API totals overlap with local logs if those tools used the same keys.
  --endpoint URL      post somewhere else (testing)`;

// ---------- plain mode: line-oriented, no escapes; the CI / pipe / --yes path ----------
async function plain(o) {
  const c = palette(false);
  const { found, notes, from, windows } = await collectAll(o);
  if (!Object.values(found).some(Boolean)) { console.log(`No AI tool logs found (${Object.values(LOCAL_SOURCES).map((x) => x.where).join(", ")}). Nothing to send.`); return 0; }
  const t = totalsOf(windows);
  console.log(`Window: ${new Date(from).toISOString()} -> ${new Date(o.now).toISOString()} (${windows.length} hourly totals)`);
  for (const { id: k, label } of TOOLS) if (found[k] != null)
    console.log(`  ${label.padEnd(13)} ${found[k] ? `input ${fmt(t[k].input)}  output ${fmt(t[k].output)}  cache ${fmt(t[k].cache)}` : API_SOURCES[k] ? "(no API key)" : "(no logs)"}${notes[k] ? `  ! ${notes[k]}` : ""}`);
  console.log("\nExactly this will be sent (token counts only, no prompts, code, paths or project names):");
  console.log(JSON.stringify({ windows }, null, 1));
  if (!windows.length) { console.log(emptyMessage(found, o.lastSync) + (o.watch ? "" : " Run with --watch to wait for new usage.")); return 0; }
  if (o.dry || o.demo) { console.log(o.demo ? "Demo: sample data, nothing sent." : "Dry run: nothing sent."); return 0; }
  if (!o.yes) {
    if (!process.stdin.isTTY) { console.log("Not sent (no terminal to confirm). Re-run with --yes to send."); return 0; }
    if (!/^y(es)?$/i.test((await ask("\nSend to Banzuke? [y/N] ")).trim())) { console.log("Not sent."); return 0; }
  }
  const token = ghToken();
  if (!token) { console.error("Need a GitHub token: run `gh auth login` or set GITHUB_TOKEN. It's only used to prove your login to the server."); return 1; }
  const r = await send(windows, token, o.endpoint);
  if (!r.ok) { console.error(rejectMsg(r)); return 1; }
  saveState({ ...loadState(), lastSync: o.now });
  console.log(`Sent. ${r.body}`);
  void c; return 0;
}

// ---------- TUI ----------
async function tui(o) {
  const c = palette(true); const out = (s = "") => process.stdout.write(s + "\n");
  const st = loadState(); const onboard = o.onboard || !st.onboarded;
  const token = ghToken();
  const sp = spinner("checking GitHub and the room…", c);
  const login = await ghLogin(token);
  const player = await roomPlayer(login);
  sp.stop();
  const { found, notes, from, windows } = await collectAll(o);
  const ok = (b) => b ? c.green("✔") : c.red("✘");

  if (onboard) {
    out(wordmark(c));
    out(`  ${c.bold("Banzuke")} counts how much AI fuel your stable burns: Claude Code, Codex, OpenCode, Devin…`);
    out(`  summed per hour from your local logs. It's a side stat; it never changes your shipping score.`);
    out("");
    out(`  ${c.teal("Privacy")}  Only numbers leave this machine: tool, input/output/cache token counts and the hour.`);
    out(`  ${c.dim("         No prompts, code, file paths or project names are ever read into the payload.")}`);
    out("");
    out(`  ${c.bold("Setup")}`);
  } else out(`\n  ${c.teal(c.bold("番付 Banzuke"))} ${c.dim("· AI fuel sync")}`);

  const ghLine = login ? `${ok(true)} GitHub     signed in as ${c.bold("@" + login)}` : token ? `${ok(false)} GitHub     token didn't work ${c.dim("→ run `gh auth login` or set GITHUB_TOKEN")}` : `${ok(false)} GitHub     not signed in ${c.dim("→ run `gh auth login` (or export GITHUB_TOKEN)")}`;
  const roomLine = player ? `${ok(true)} Room       in ${c.bold(STABLES[player.team] ?? "a stable")}` : player === false ? `${ok(false)} Room       not in the room yet ${c.dim("→ join at")} ${c.teal(JOIN)} ${c.dim("first")}` : `${c.dim("·")} Room       ${c.dim("couldn't check (offline?) — the server will verify on send")}`;
  if (onboard) {
    out("  " + ghLine); out("  " + roomLine);
    for (const { id, label } of TOOLS) {
      const local = LOCAL_SOURCES[id], api = API_SOURCES[id];
      if (local) out(`  ${ok(found[id])} ${label.padEnd(13)} ${found[id] ? (notes[id] ? c.red(notes[id]) : "logs found") : c.dim("no " + local.where)}`);
      else if (o.api) out(`  ${found[id] ? ok(true) : c.dim("·")} ${label.padEnd(13)} ${found[id] ? (notes[id] ? c.red(notes[id]) : "usage API") : c.dim("set " + api.env.join(" + ") + " — " + api.hint)}`);
    }
    if (!o.api) out(`  ${c.dim("·")} ${"APIs".padEnd(13)} ${c.dim("off · run with --api to add Anthropic / OpenAI / xAI usage from your admin keys")}`);
    out("");
  } else if (!login || player === false) { out("  " + ghLine); if (login) out("  " + roomLine); }
  else out(`  ${c.dim("@" + login + " · " + (player ? STABLES[player.team] : "room unverified"))}`);

  if (!Object.values(found).some(Boolean)) { out(`\n  No AI tool logs on this machine, nothing to send.`); saveState({ ...st, onboarded: true }); return 0; }
  out(`\n  ${c.bold("Last " + Math.round((o.now - from) / HOUR) + "h")} ${c.dim(`(${windows.length} hourly totals${o.lastSync ? ", since last sync" : ""})`)}`);
  out(toolBars(windows, found, c, notes));
  if (onboard || o.dry) { out(`\n  ${c.bold("Exactly this will be sent")}`); out(payloadPreview(windows, c, o.full)); }
  if (!windows.length) {
    saveState({ ...st, onboarded: true });
    out(`\n  ${emptyMessage(found, o.lastSync)}`);
    if (o.watch) return watch(o, c, token);
    out(c.dim("  Leave it watching and it'll sync new usage every 10 min as you work."));
    out("");
    const pick = await menu([
      ...(login && player !== false ? [{ label: "Watch for new usage", value: "watch", key: "w", hint: "resync every 10 min, Ctrl-C to stop" }] : []),
      { label: "Quit", value: "quit", key: "q" },
    ], c);
    return pick === "watch" ? watch(o, c, token) : 0;
  }
  if (o.dry) { out(`\n  ${c.dim("Dry run: nothing sent.")}`); return 0; }
  const blocked = !o.demo && (!login || player === false);
  out("");
  const choice = await menu([
    ...(blocked ? [] : [{ label: o.watch ? "Send & keep syncing" : "Send", value: "send", key: "s", hint: "post these counts to the board" }]),
    { label: "Dry run", value: "dry", key: "d", hint: "show the full payload, send nothing" },
    { label: "Quit", value: "quit", key: "q" },
  ], c);
  saveState({ ...loadState(), onboarded: true });
  if (choice === "quit") { out(c.dim("  Not sent.")); return 0; }
  if (o.demo && choice === "send") { out(`  ${c.green("✔")} ${c.dim("Demo: this is where it would post the counts. Nothing sent.")}`); out(`  ${c.teal("Fuel")}    #3 of 41 burners · ${short(windows.reduce((a, w) => a + sum(w), 0))} tokens in the last 72h ${c.dim("(sample)")}`); return 0; }
  if (choice === "dry") { out(""); out(payloadPreview(windows, c, true)); out(c.dim("\n  Dry run: nothing sent.")); return 0; }
  const s2 = spinner("sending…", c); const r = await send(windows, token, o.endpoint);
  if (!r.ok) { s2.stop(`  ${c.red("✘")} ${rejectMsg(r)}`); return 1; }
  saveState({ ...loadState(), onboarded: true, lastSync: o.now });
  const rank = fuelRank(await convexQuery("fuel:totals"), login);
  s2.stop(`  ${c.green("✔")} Sent ${windows.length} hourly totals ${c.dim(`(${r.json?.inserted ?? 0} new, ${r.json?.updated ?? 0} updated)`)}`);
  if (player) out(`  ${c.teal("Stable")}  ${c.bold(STABLES[player.team])}`);
  if (rank) out(`  ${c.teal("Fuel")}    #${rank.rank} of ${rank.of} burners · ${short(rank.total)} tokens in the last 72h`);
  out(`  ${c.dim("See it live: https://racing-charcoal-9xinp40.vercel.app/fuel")}`);
  return o.watch ? watch(o, c, token) : 0;
}

/** --watch: resync every 10 min on one live-updating line. Sends without re-asking (you opted in with --watch). */
async function watch(o, c, token) {
  if (o.demo) { console.log(c.dim("  Demo mode doesn't watch or send.")); return 0; }
  const tty = c.on; const line = (s) => tty ? process.stdout.write(`\r\x1b[2K  ${s}`) : console.log(s);
  let next = Date.now() + WATCH_MS, last = "waiting for first resync";
  const tick = tty ? setInterval(() => { const s = Math.max(0, Math.round((next - Date.now()) / 1000)); line(`${c.teal("◉")} watching · ${last} · next sync in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} ${c.dim("(Ctrl-C to stop)")}`); }, 1000) : null;
  process.on("SIGINT", () => { if (tick) clearInterval(tick); process.stdout.write("\n"); process.exit(0); });
  if (!tty) console.log(`Watching: resync every ${WATCH_MS / 60000} min.`);
  for (;;) {
    await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
    const now = Date.now(); const { windows } = await collectAll({ ...o, now, lastSync: loadState().lastSync ?? 0 });
    const tot = windows.reduce((a, w) => a + sum(w), 0);
    if (windows.length) {
      try { const r = await send(windows, token, o.endpoint); if (r.ok) saveState({ ...loadState(), lastSync: now }); last = r.ok ? `${new Date(now).toLocaleTimeString()} synced ${short(tot)} tokens` : `${new Date(now).toLocaleTimeString()} ${rejectMsg(r)}`; }
      catch (e) { last = `${new Date(now).toLocaleTimeString()} offline, will retry`; }
    } else last = `${new Date(now).toLocaleTimeString()} nothing new`;
    if (!tty) console.log(last);
    next = Date.now() + WATCH_MS;
  }
}

export async function main(argv) {
  const has = (f) => argv.includes(f); const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  if (has("--help") || has("-h")) { console.log(HELP); return 0; }
  const st = loadState();
  const o = {
    home: val("--home") ?? homedir(), endpoint: val("--endpoint"), dry: has("--dry-run"), yes: has("--yes"), full: has("--full"),
    watch: has("--watch"), onboard: has("--onboard"), api: has("--api") || process.env.BANZUKE_API === "1", demo: has("--demo"),
    now: val("--now") ? Date.parse(val("--now")) : Date.now(), // --now: fixed clock for tests/demos
    lastSync: has("--full") ? 0 : st.lastSync ?? 0,
  };
  const isPlain = has("--plain") || o.yes || !process.stdout.isTTY || !process.stdin.isTTY || process.env.TERM === "dumb";
  if (isPlain) { const code = await plain(o); if (o.watch && code === 0 && o.yes && !o.dry) await watch(o, palette(false), ghToken()); return code; }
  return tui(o);
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) main(process.argv.slice(2)).then((code) => { process.exitCode = code ?? 0; }).catch((e) => { process.stdout.write("\x1b[?25h"); console.error(e.message); process.exit(1); });
