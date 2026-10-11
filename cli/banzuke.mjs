#!/usr/bin/env node
// Banzuke AI-fuel sync. Zero deps. Reads local Claude Code / Codex logs for token COUNTS only and posts
// hourly totals {tool, input, output, cache, windowStart, windowEnd}. Prompts, code, paths and project
// names are never read into the payload: each log line is parsed and only numeric usage fields are kept.
import { realpathSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const HOUR = 3600_000;
export const WINDOW_HOURS = 72;
const ENDPOINT = "https://fantastic-lapwing-798.ap-southeast-2.convex.site/tokens";
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

function ghToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
}
const ask = (q) => new Promise((r) => { const rl = createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); r(a); }); });
const fmt = (x) => x.toLocaleString("en-US");

async function main(argv) {
  const has = (f) => argv.includes(f); const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  if (has("--help") || has("-h")) {
    console.log("banzuke: share AI token totals (counts only) with the Banzuke room.\n  --yes  skip the prompt   --dry-run  print, don't send\n  --home DIR  read logs under DIR instead of ~   --endpoint URL");
    return;
  }
  const home = val("--home") ?? homedir();
  const state = join(homedir(), ".banzuke.json");
  let lastSync = 0; try { lastSync = JSON.parse(readFileSync(state, "utf8")).lastSync ?? 0; } catch {}
  if (has("--full")) lastSync = 0;
  const now = Date.now();
  const { found, from, windows } = collect({ home, now, lastSync });
  if (!found.claude && !found.codex) { console.log("No Claude Code (~/.claude/projects) or Codex (~/.codex/sessions) logs found. Nothing to send."); return; }
  const tot = { claude: [0, 0, 0], codex: [0, 0, 0] };
  for (const w of windows) { const t = tot[w.tool]; t[0] += w.input; t[1] += w.output; t[2] += w.cache; }
  console.log(`Window: ${new Date(from).toISOString()} -> ${new Date(now).toISOString()} (${windows.length} hourly totals)`);
  for (const [k, label] of [["claude", "Claude Code"], ["codex", "Codex"]])
    console.log(`  ${label.padEnd(12)} ${found[k] ? `input ${fmt(tot[k][0])}  output ${fmt(tot[k][1])}  cache ${fmt(tot[k][2])}` : "(no logs)"}`);
  console.log("\nExactly this will be sent (token counts only, no prompts, code, paths or project names):");
  console.log(JSON.stringify({ windows }, null, 1));
  if (!windows.length) { console.log("Nothing new since last sync."); return; }
  if (has("--dry-run")) return;
  if (!has("--yes") && !/^y(es)?$/i.test((await ask("\nSend to Banzuke? [y/N] ")).trim())) { console.log("Not sent."); return; }
  const token = ghToken();
  if (!token) { console.error("Need a GitHub token: run `gh auth login` or set GITHUB_TOKEN. It's only used to prove your login to the server."); process.exit(1); }
  const res = await fetch(val("--endpoint") ?? ENDPOINT, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ windows }) });
  const body = await res.text();
  if (!res.ok) { console.error(`Rejected (${res.status}): ${body}`); process.exit(1); }
  try { writeFileSync(state, JSON.stringify({ lastSync: now })); } catch { /* next run just resends the 72h; upserts make that safe */ }
  console.log(`Sent. ${body}`);
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
