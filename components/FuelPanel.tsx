"use client";
// AI fuel: Claude vs Codex headline, a multi-segment bar across every tool in the registry, top burners.
// Data: api.fuel.totals (opt-in CLI, counts only). Tools, labels and colors come from lib/tools.mjs.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROOM_STABLES } from "@/lib/quiz";
import { TOOLS } from "@/lib/tools.mjs";

const CLAUDE = TOOLS.find((t) => t.id === "claude")!.color, CODEX = TOOLS.find((t) => t.id === "codex")!.color;
const colorOf = new Map(TOOLS.map((t) => [t.id, t.color]));
export const short = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`;
const CMD = "npx github:raitoxlol/banzuke";

export function FuelPanel({ top = 5 }: { top?: number }) {
  const d = useQuery(api.fuel.totals);
  if (!d) return null;
  const tools = d.tools as Record<string, number>;
  const sum = TOOLS.reduce((a, t) => a + (tools[t.id] ?? 0), 0);
  const live = TOOLS.filter((t) => (tools[t.id] ?? 0) > 0);
  const color = new Map(ROOM_STABLES.map((s) => [s.id, s.color]));
  return (
    <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b style={{ letterSpacing: ".14em", fontSize: 12 }}>AI FUEL · TOKENS BURNED · 72H</b>
        <span className="muted small num">{short(sum)}</span>
      </header>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <span style={{ color: CLAUDE }}>Claude <span className="num">{short(d.sides.claude)}</span></span>
        <span style={{ color: CODEX }}><span className="num">{short(d.sides.codex)}</span> Codex</span>
      </div>
      <div role="img" aria-label={live.map((t) => `${t.label} ${((tools[t.id] / (sum || 1)) * 100).toFixed(0)}%`).join(", ") || "no fuel yet"}
        style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", background: "var(--border)" }}>
        {live.map((t) => <div key={t.id} title={`${t.label} ${short(tools[t.id])}`} style={{ width: `${(tools[t.id] / sum) * 100}%`, background: t.color, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />)}
      </div>
      {live.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }} className="small">
          {live.map((t) => <span key={t.id}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: t.color, marginRight: 6 }} />{t.label} <span className="num muted">{short(tools[t.id])}</span></span>)}
        </div>
      ) : null}
      {d.players.length ? (
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {d.players.slice(0, top).map((p, i) => (
            <li key={p.login} style={{ display: "grid", gridTemplateColumns: "18px 22px 1fr auto", gap: 8, alignItems: "center" }}>
              <span className="muted small num">{i + 1}</span>
              {p.avatar ? <img src={p.avatar} alt="" width={22} height={22} style={{ borderRadius: "50%", outline: `2px solid ${color.get(p.team)}` }} /> : <span />}
              <span>@{p.login}</span>
              <span className="num" style={{ color: colorOf.get(p.top) }}>{short(p.total)}</span>
            </li>
          ))}
        </ol>
      ) : <p className="muted small" style={{ margin: 0 }}>No fuel yet.</p>}
      <p className="muted small" style={{ margin: 0 }}>Add yours: <code className="num">{CMD}</code> (counts only, never prompts or code)</p>
    </section>
  );
}
export default FuelPanel;
