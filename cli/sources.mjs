// Where each tool keeps its token counts, and how to read only the numbers. One entry per tool in
// lib/tools.mjs. Local sources read files on this machine; API sources (opt-in, --api) ask the
// provider's own usage API with the user's admin key from env. Every reader returns events
// { at, input, output, cache } and nothing else: no prompts, code, paths, model or project names.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sqliteBackend, sqliteQuery, sqliteTables } from "./sqlite.mjs";

export const n = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
const HOUR = 3600_000;

function* walk(dir, since, ext) {
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, since, ext);
    else if (e.name.endsWith(ext)) { try { if (statSync(p).mtimeMs >= since) yield p; } catch {} }
  }
}
function* lines(file) { for (const l of readFileSync(file, "utf8").split("\n")) if (l.trim()) { try { yield JSON.parse(l); } catch {} } }
const readJson = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };
/** Epoch seconds, epoch ms, or ISO string -> ms. */
export const toMs = (t) => typeof t === "number" ? (t < 1e10 ? t * 1000 : t) : typeof t === "string" ? (/^\d+$/.test(t) ? toMs(Number(t)) : Date.parse(t)) : NaN;
const dataHome = (home, env) => env.XDG_DATA_HOME || join(home, ".local", "share");
const sqlNum = (x) => String(Math.floor(Number(x) || 0)); // the only value ever inlined into SQL

// ---------- parsers (pure over parsed records / rows; exported for tests) ----------

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

/** OpenCode tokens {input, output, reasoning, cache:{read, write}} -> event. Reasoning is billed as output. */
export const opencodeEvent = (at, t) => ({ at, input: n(t?.input), output: n(t?.output) + n(t?.reasoning), cache: n(t?.cache?.read) + n(t?.cache?.write) });

/** OpenCode <= 0.x: storage/message/<session>/<message>.json, role "assistant", time.created (ms), tokens. */
export function opencodeJsonEvents(files) {
  const out = [];
  for (const f of files) { const m = readJson(f); if (m?.role !== "assistant" || !m.tokens || !Number.isFinite(m.time?.created)) continue; out.push(opencodeEvent(m.time.created, m.tokens)); }
  return out;
}
/** OpenCode SQLite rows (see OPENCODE_SQL): { at, i, o, r, cr, cw }. */
export const opencodeRowEvents = (rows) => rows.filter((r) => Number.isFinite(r.at)).map((r) => opencodeEvent(r.at, { input: r.i, output: r.o, reasoning: r.r, cache: { read: r.cr, write: r.cw } }));

/** Devin CLI rows (see DEVIN_SQL): { rid, at, i, o, cr, cw }. Retries are sibling nodes with the same
 *  request_id and identical metrics, so request_id dedupes. metrics.input_tokens already excludes cache reads. */
export function devinRowEvents(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const at = toMs(r.at); if (!Number.isFinite(at)) continue;
    if (r.rid != null) { if (seen.has(r.rid)) continue; seen.add(r.rid); }
    out.push({ at, input: n(r.i), output: n(r.o), cache: n(r.cr) + n(r.cw) });
  }
  return out;
}

// ---------- SQL (select numbers only; JSON blobs are reduced inside SQLite) ----------
const OC_COLS = (tbl) => `SELECT time_created AS at, json_extract(data,'$.tokens.input') AS i, json_extract(data,'$.tokens.output') AS o,
  json_extract(data,'$.tokens.reasoning') AS r, json_extract(data,'$.tokens.cache.read') AS cr, json_extract(data,'$.tokens.cache.write') AS cw FROM ${tbl}`;
/** OpenCode >= 1.x keeps messages in SQLite: `message` (1.x) then `session_message` (2.x, current). Both: data JSON + time_created ms. */
export const OPENCODE_SQL = {
  session_message: (from) => `${OC_COLS("session_message")} WHERE time_created >= ${sqlNum(from)} AND json_extract(data,'$.tokens') IS NOT NULL`,
  message: (from) => `${OC_COLS("message")} WHERE time_created >= ${sqlNum(from)} AND json_extract(data,'$.role')='assistant' AND json_extract(data,'$.tokens') IS NOT NULL`,
};
export const DEVIN_SQL = `SELECT json_extract(chat_message,'$.metadata.request_id') AS rid, json_extract(chat_message,'$.metadata.created_at') AS at,
  json_extract(chat_message,'$.metadata.metrics.input_tokens') AS i, json_extract(chat_message,'$.metadata.metrics.output_tokens') AS o,
  json_extract(chat_message,'$.metadata.metrics.cache_read_tokens') AS cr, json_extract(chat_message,'$.metadata.metrics.cache_creation_tokens') AS cw
  FROM message_nodes WHERE json_extract(chat_message,'$.role')='assistant' AND json_extract(chat_message,'$.metadata.metrics') IS NOT NULL`;

// ---------- local sources ----------
const claudeDirs = (home) => [join(home, ".claude", "projects"), join(home, ".config", "claude", "projects")];
const codexDir = (home, env) => join(env.CODEX_HOME || join(home, ".codex"), "sessions");
const opencodeDir = (home, env) => join(dataHome(home, env), "opencode");
function opencodeDbs(home, env) {
  if (env.OPENCODE_DB && env.OPENCODE_DB !== ":memory:") return existsSync(env.OPENCODE_DB) ? [env.OPENCODE_DB] : [];
  try { return readdirSync(opencodeDir(home, env)).filter((f) => /^opencode(-[\w.-]+)?\.db$/.test(f)).map((f) => join(opencodeDir(home, env), f)); } catch { return []; }
}
const devinDb = (home, env) => [join(dataHome(home, env), "devin", "cli", "sessions.db"), join(home, ".local", "share", "devin", "cli", "sessions.db")].find(existsSync);

/** Each: where (shown in setup), found(home, env), read({home, env, from, sqlite}) -> { events, note? }. */
export const LOCAL_SOURCES = {
  claude: {
    where: "~/.claude/projects", verified: true,
    found: (home) => claudeDirs(home).some(existsSync),
    read: ({ home, from }) => ({ events: claudeEvents(claudeDirs(home).flatMap((d) => [...walk(d, from, ".jsonl")])) }),
  },
  codex: {
    where: "~/.codex/sessions", verified: true,
    found: (home, env) => existsSync(codexDir(home, env)),
    read: ({ home, env, from }) => ({ events: codexEvents([...walk(codexDir(home, env), from, ".jsonl")]) }),
  },
  opencode: {
    where: "~/.local/share/opencode", verified: true,
    found: (home, env) => opencodeDbs(home, env).length > 0 || existsSync(join(opencodeDir(home, env), "storage", "message")),
    read: ({ home, env, from, sqlite }) => {
      const events = []; let dbRead = false, note;
      for (const db of opencodeDbs(home, env)) {
        if (!sqlite) { note = "OpenCode keeps tokens in SQLite: install sqlite3 or use Node >= 22.5"; break; }
        const tables = sqliteTables(db, sqlite);
        const tbl = tables.includes("session_message") ? "session_message" : tables.includes("message") ? "message" : null;
        const rows = tbl && sqliteQuery(db, OPENCODE_SQL[tbl](from), sqlite);
        if (rows) { events.push(...opencodeRowEvents(rows)); dbRead = true; }
      }
      // Pre-SQLite installs (0.x). Once a DB has been read, its migration already holds these messages.
      if (!dbRead) events.push(...opencodeJsonEvents([...walk(join(opencodeDir(home, env), "storage", "message"), from, ".json")]));
      return { events, note };
    },
  },
  devin: {
    where: "~/.local/share/devin/cli/sessions.db", verified: false,
    found: (home, env) => !!devinDb(home, env),
    read: ({ home, env, sqlite }) => {
      if (!sqlite) return { events: [], note: "Devin CLI keeps tokens in SQLite: install sqlite3 or use Node >= 22.5" };
      const rows = sqliteQuery(devinDb(home, env), DEVIN_SQL, sqlite);
      return rows ? { events: devinRowEvents(rows) } : { events: [], note: "couldn't read Devin's sessions.db (format changed?)" };
    },
  },
};

// ---------- API sources (opt-in with --api; keys go only to the provider) ----------
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
async function getJson(fetchFn, url, init) {
  const r = await fetchFn(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${new URL(url).host} said ${r.status}`);
  return r.json();
}
/** Each: env (required vars), hint, pull({ env, from, now, fetch }) -> events (one per hour bucket). */
export const API_SOURCES = {
  "anthropic-api": {
    env: ["ANTHROPIC_ADMIN_KEY"], hint: "Admin key (sk-ant-admin…) from console.anthropic.com → Settings → Admin keys", verified: true,
    async pull({ env, from, now, fetch: f }) {
      const out = []; let page = null;
      do {
        const q = new URLSearchParams({ starting_at: iso(from), ending_at: iso(now), bucket_width: "1h", limit: "168" }); if (page) q.set("page", page);
        const j = await getJson(f, `https://api.anthropic.com/v1/organizations/usage_report/messages?${q}`, { headers: { "x-api-key": env.ANTHROPIC_ADMIN_KEY, "anthropic-version": "2023-06-01" } });
        for (const b of j.data ?? []) for (const r of b.results ?? [])
          out.push({ at: Date.parse(b.starting_at), input: n(r.uncached_input_tokens), output: n(r.output_tokens), cache: n(r.cache_read_input_tokens) + n(r.cache_creation?.ephemeral_5m_input_tokens) + n(r.cache_creation?.ephemeral_1h_input_tokens) });
        page = j.has_more ? j.next_page : null;
      } while (page);
      return out;
    },
  },
  "openai-api": {
    env: ["OPENAI_ADMIN_KEY"], hint: "Admin key from platform.openai.com → Organization → Admin keys", verified: true,
    async pull({ env, from, now, fetch: f }) {
      const out = []; let page = null;
      do {
        const q = new URLSearchParams({ start_time: String(Math.floor(from / 1000)), end_time: String(Math.floor(now / 1000)), bucket_width: "1h", limit: "168" }); if (page) q.set("page", page);
        const j = await getJson(f, `https://api.openai.com/v1/organization/usage/completions?${q}`, { headers: { authorization: `Bearer ${env.OPENAI_ADMIN_KEY}` } });
        for (const b of j.data ?? []) for (const r of b.results ?? []) {
          const cached = n(r.input_cached_tokens); // input_tokens includes cached
          out.push({ at: b.start_time * 1000, input: Math.max(0, n(r.input_tokens) - cached), output: n(r.output_tokens), cache: cached });
        }
        page = j.has_more ? j.next_page : null;
      } while (page);
      return out;
    },
  },
  "xai-api": {
    env: ["XAI_MANAGEMENT_KEY", "XAI_TEAM_ID"], hint: "Management key + team ID from console.x.ai (best effort: total tokens only, counted as input)", verified: false,
    async pull({ env, from, now, fetch: f }) {
      const ts = (ms) => iso(ms).replace("T", " ").replace("Z", "");
      const body = { analyticsRequest: { timeRange: { startTime: ts(from), endTime: ts(now - 1000), timezone: "Etc/GMT" }, timeUnit: "TIME_UNIT_HOUR", values: [{ name: "tokens", aggregation: "AGGREGATION_SUM" }], groupBy: [], filters: [] } };
      const j = await getJson(f, `https://management-api.x.ai/v1/billing/teams/${encodeURIComponent(env.XAI_TEAM_ID)}/usage`,
        { method: "POST", headers: { authorization: `Bearer ${env.XAI_MANAGEMENT_KEY}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      return (j.timeSeries ?? []).flatMap((s) => (s.dataPoints ?? []).map((p) => ({ at: Date.parse(p.timestamp), input: n(p.values?.[0]), output: 0, cache: 0 })));
    },
  },
};
export const apiConfigured = (id, env) => API_SOURCES[id].env.every((k) => env[k]);
export { sqliteBackend, HOUR };
