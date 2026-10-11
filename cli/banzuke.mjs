#!/usr/bin/env node
// Banzuke AI-fuel sync. Zero deps. Reads local Claude Code / Codex logs for token COUNTS only and posts
// hourly totals {tool, input, output, cache, windowStart, windowEnd}. Prompts, code, paths and project
// names are never read into the payload: each log line is parsed and only numeric usage fields are kept.
import { realpathSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
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
const n = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);

function* jsonlFiles(dir, since) {
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p, since);
    else if (e.name.endsWith(".jsonl")) { try { if (statSync(p).mtimeMs >= since) yield p; } catch {} }
  }
}
function* lines(file) { for (const l of readFileSync(file, "utf8").split("\n")) if (l.trim()) { try { yield JSON.parse(l); } catch {} } }

/** Claude Code: assistant lines carry message.usage. Streaming repeats a message, so dedupe by message.id+requestId. */
export function claudeEvents(files) {
  const seen = new Set(), out = [];
  for (const f of files) for (const j of lines(f)) {
    const u = j?.message?.usage; const at = Date.parse(j?.timestamp);
    if (!u || !Number.isFinite(at)) continue;
    const key = j.message.id && `${j.message.id}:${j.requestId ?? ""}`;
    if (key) { if (seen.has(key)) continue; seen.add(key); }
    out.push({ at, input: n(u.input_tokens), output: n(u.output_tokens), cache: n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens) });
  }
  return out;
}

/** Codex: event_msg payload.type "token_count", info.last_token_usage per turn. input_tokens includes cached
 *  input, so input = input - cached. Repeated events (same running total) are skipped. */
export function codexEvents(files) {
  const out = [];
  for (const f of files) {
    let prevTotal = -1;
    for (const j of lines(f)) {
      const p = j?.payload; if (j?.type !== "event_msg" || p?.type !== "token_count" || !p.info) continue;
      const at = Date.parse(j.timestamp); const last = p.info.last_token_usage; const total = p.info.total_token_usage?.total_tokens;
      if (!last || !Number.isFinite(at)) continue;
      if (total != null) { if (total === prevTotal) continue; prevTotal = total; }
      const cached = n(last.cached_input_tokens);
      out.push({ at, input: Math.max(0, n(last.input_tokens) - cached), output: n(last.output_tokens), cache: cached });
    }
  }
  return out;
}

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

/** Everything that leaves the machine. Only these six fields, all numbers except tool. */
export function collect({ home = homedir(), now = Date.now(), lastSync = 0 } = {}) {
  const floor = Math.floor((now - WINDOW_HOURS * HOUR) / HOUR) * HOUR;
  // Since-last-sync: resend from the hour of the last sync (it may have been partial); 72h on first run.
  const from = lastSync ? Math.max(floor, Math.floor(lastSync / HOUR) * HOUR) : floor;
  const claudeDirs = [join(home, ".claude", "projects"), join(home, ".config", "claude", "projects")];
  const codexDir = join(process.env.CODEX_HOME ?? join(home, ".codex"), "sessions");
  const found = { claude: claudeDirs.some(existsSync), codex: existsSync(codexDir) };
  const cf = claudeDirs.flatMap((d) => [...jsonlFiles(d, from)]);
  const xf = [...jsonlFiles(codexDir, from)];
  const windows = [...buckets("claude", claudeEvents(cf), from, now), ...buckets("codex", codexEvents(xf), from, now)]
    .map(({ tool, input, output, cache, windowStart, windowEnd }) => ({ tool, input, output, cache, windowStart, windowEnd }));
  return { found, from, windows };
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
  return { teal: fg("91;189;186", 73), claude: fg("227;154;107", 173), codex: fg("111;168;220", 74), green: fg("111;191;142", 72), red: fg("224;122;138", 168), bold: sgr(1, 22), dim: sgr(2, 22), on };
}
const fmt = (x) => x.toLocaleString("en-US");
export const short = (x) => x >= 1e9 ? (x / 1e9).toFixed(1) + "B" : x >= 1e6 ? (x / 1e6).toFixed(1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(1) + "k" : String(x);
export function totalsOf(windows) {
  const t = { claude: { input: 0, output: 0, cache: 0 }, codex: { input: 0, output: 0, cache: 0 } };
  for (const w of windows) { const x = t[w.tool]; x.input += w.input; x.output += w.output; x.cache += w.cache; }
  return t;
}
const sum = (x) => x.input + x.output + x.cache;
export function bar(v, max, width, c) { const f = max ? Math.max(v ? 1 : 0, Math.round((v / max) * width)) : 0; return c.on ? "█".repeat(f) + c.dim("░".repeat(width - f)) : "#".repeat(f) + ".".repeat(width - f); }
export function wordmark(c) {
  return ["", c.teal(c.bold("  ┏┓ ┏━┓┏┓╻╺━┓╻ ╻╻┏ ┏━╸")) , c.teal(c.bold("  ┣┻┓┣━┫┃┗┫┏━┛┃ ┃┣┻┓┣╸ ")) + "   " + c.teal(c.bold("番付")), c.teal(c.bold("  ┗━┛╹ ╹╹ ╹┗━╸┗━┛╹ ╹┗━╸")) + "   " + c.dim("AI fuel sync"), ""].join("\n");
}
export function toolBars(windows, found, c) {
  const t = totalsOf(windows); const max = Math.max(sum(t.claude), sum(t.codex));
  return [["claude", "Claude Code", c.claude], ["codex", "Codex", c.codex]].map(([k, label, col]) =>
    found[k] ? `  ${col(label.padEnd(12))} ${col(bar(sum(t[k]), max, 24, c))} ${c.bold(short(sum(t[k])).padStart(7))} ${c.dim(`in ${short(t[k].input)} · out ${short(t[k].output)} · cache ${short(t[k].cache)}`)}`
             : `  ${c.dim(label.padEnd(12) + " no logs on this machine")}`).join("\n");
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
  --home DIR          read logs under DIR instead of ~
  --endpoint URL      post somewhere else (testing)`;

// ---------- plain mode: line-oriented, no escapes; the CI / pipe / --yes path ----------
async function plain(o) {
  const c = palette(false);
  const { found, from, windows } = collect({ home: o.home, now: o.now, lastSync: o.lastSync });
  if (!found.claude && !found.codex) { console.log("No Claude Code (~/.claude/projects) or Codex (~/.codex/sessions) logs found. Nothing to send."); return 0; }
  const t = totalsOf(windows);
  console.log(`Window: ${new Date(from).toISOString()} -> ${new Date(o.now).toISOString()} (${windows.length} hourly totals)`);
  for (const [k, label] of [["claude", "Claude Code"], ["codex", "Codex"]])
    console.log(`  ${label.padEnd(12)} ${found[k] ? `input ${fmt(t[k].input)}  output ${fmt(t[k].output)}  cache ${fmt(t[k].cache)}` : "(no logs)"}`);
  console.log("\nExactly this will be sent (token counts only, no prompts, code, paths or project names):");
  console.log(JSON.stringify({ windows }, null, 1));
  if (!windows.length) { console.log("Nothing new since last sync."); return 0; }
  if (o.dry) { console.log("Dry run: nothing sent."); return 0; }
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
  const { found, from, windows } = collect({ home: o.home, now: o.now, lastSync: o.lastSync });
  const ok = (b) => b ? c.green("✔") : c.red("✘");

  if (onboard) {
    out(wordmark(c));
    out(`  ${c.bold("Banzuke")} counts how much AI fuel your stable burns: Claude Code vs Codex tokens,`);
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
    out(`  ${ok(found.claude)} Claude Code ${found.claude ? "logs found" : c.dim("no ~/.claude/projects")}`);
    out(`  ${ok(found.codex)} Codex       ${found.codex ? "logs found" : c.dim("no ~/.codex/sessions")}`);
    out("");
  } else if (!login || player === false) { out("  " + ghLine); if (login) out("  " + roomLine); }
  else out(`  ${c.dim("@" + login + " · " + (player ? STABLES[player.team] : "room unverified"))}`);

  if (!found.claude && !found.codex) { out(`\n  No Claude Code or Codex logs on this machine, nothing to send.`); saveState({ ...st, onboarded: true }); return 0; }
  out(`\n  ${c.bold("Last " + Math.round((o.now - from) / HOUR) + "h")} ${c.dim(`(${windows.length} hourly totals${o.lastSync ? ", since last sync" : ""})`)}`);
  out(toolBars(windows, found, c));
  if (onboard || o.dry) { out(`\n  ${c.bold("Exactly this will be sent")}`); out(payloadPreview(windows, c, o.full)); }
  if (!windows.length) { out(`\n  ${c.dim("Nothing new since last sync.")}`); saveState({ ...st, onboarded: true }); return o.watch ? watch(o, c, token) : 0; }
  if (o.dry) { out(`\n  ${c.dim("Dry run: nothing sent.")}`); return 0; }
  const blocked = !login || player === false;
  out("");
  const choice = await menu([
    ...(blocked ? [] : [{ label: o.watch ? "Send & keep syncing" : "Send", value: "send", key: "s", hint: "post these counts to the board" }]),
    { label: "Dry run", value: "dry", key: "d", hint: "show the full payload, send nothing" },
    { label: "Quit", value: "quit", key: "q" },
  ], c);
  saveState({ ...loadState(), onboarded: true });
  if (choice === "quit") { out(c.dim("  Not sent.")); return 0; }
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
  const tty = c.on; const line = (s) => tty ? process.stdout.write(`\r\x1b[2K  ${s}`) : console.log(s);
  let next = Date.now() + WATCH_MS, last = "waiting for first resync";
  const tick = tty ? setInterval(() => { const s = Math.max(0, Math.round((next - Date.now()) / 1000)); line(`${c.teal("◉")} watching · ${last} · next sync in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} ${c.dim("(Ctrl-C to stop)")}`); }, 1000) : null;
  process.on("SIGINT", () => { if (tick) clearInterval(tick); process.stdout.write("\n"); process.exit(0); });
  if (!tty) console.log(`Watching: resync every ${WATCH_MS / 60000} min.`);
  for (;;) {
    await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
    const now = Date.now(); const { windows } = collect({ home: o.home, now, lastSync: loadState().lastSync ?? 0 });
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
    watch: has("--watch"), onboard: has("--onboard"),
    now: val("--now") ? Date.parse(val("--now")) : Date.now(), // --now: fixed clock for tests/demos
    lastSync: has("--full") ? 0 : st.lastSync ?? 0,
  };
  const isPlain = has("--plain") || o.yes || !process.stdout.isTTY || !process.stdin.isTTY || process.env.TERM === "dumb";
  if (isPlain) { const code = await plain(o); if (o.watch && code === 0 && o.yes && !o.dry) await watch(o, palette(false), ghToken()); return code; }
  return tui(o);
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) main(process.argv.slice(2)).then((code) => { process.exitCode = code ?? 0; }).catch((e) => { process.stdout.write("\x1b[?25h"); console.error(e.message); process.exit(1); });
