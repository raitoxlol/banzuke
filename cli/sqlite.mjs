// Read-only SQLite for the zero-dep CLI: node:sqlite (Node >= 22.5) if present, else the `sqlite3` binary
// (ships with macOS). Queries select numeric fields only; text columns never reach JS.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

let nodeSqlite;
function loadNodeSqlite() {
  if (nodeSqlite !== undefined) return nodeSqlite;
  try {
    const emit = process.emitWarning; process.emitWarning = () => {}; // hide the ExperimentalWarning
    try { nodeSqlite = createRequire(import.meta.url)("node:sqlite"); } finally { process.emitWarning = emit; }
  } catch { nodeSqlite = null; }
  return nodeSqlite;
}
function hasBinary() { try { execFileSync("sqlite3", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } }

/** Which backend would be used, or null if neither (then SQLite sources report "needs sqlite3"). */
export function sqliteBackend() { return loadNodeSqlite() ? "node" : hasBinary() ? "cli" : null; }

/** Run one read-only query. Returns rows, or null if the DB can't be read. Never throws. */
export function sqliteQuery(dbPath, sql, backend = sqliteBackend()) {
  try {
    if (backend === "node") {
      const db = new (loadNodeSqlite().DatabaseSync)(dbPath, { readOnly: true });
      try { return db.prepare(sql).all(); } finally { db.close(); }
    }
    if (backend === "cli") {
      const out = execFileSync("sqlite3", ["-readonly", "-json", dbPath, sql], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 << 20 });
      return out.trim() ? JSON.parse(out) : [];
    }
  } catch { /* locked, missing table, corrupt: treat as unreadable */ }
  return null;
}
/** Table names in a DB (or [] when unreadable). */
export function sqliteTables(dbPath, backend) {
  return (sqliteQuery(dbPath, "SELECT name FROM sqlite_master WHERE type='table'", backend) ?? []).map((r) => r.name);
}
