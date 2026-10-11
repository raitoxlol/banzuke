"use client";
// AI fuel: Claude Code vs Codex token tug-of-war + top burners. Data: api.fuel.totals (opt-in CLI, counts only).
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROOM_STABLES } from "@/lib/quiz";

const CLAUDE = "#E39A6B", CODEX = "#6FA8DC";
export const short = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`;
const CMD = "npx github:raitoxlol/banzuke";

export function FuelPanel({ top = 5 }: { top?: number }) {
  const d = useQuery(api.fuel.totals);
  if (!d) return null;
  const { claude, codex } = d.tools;
  const sum = claude + codex;
  const pct = sum ? (claude / sum) * 100 : 50;
  const color = new Map(ROOM_STABLES.map((s) => [s.id, s.color]));
  return (
    <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b style={{ letterSpacing: ".14em", fontSize: 12 }}>AI FUEL · TOKENS BURNED · 72H</b>
        <span className="muted small num">{short(sum)}</span>
      </header>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <span style={{ color: CLAUDE }}>Claude Code <span className="num">{short(claude)}</span></span>
        <span style={{ color: CODEX }}><span className="num">{short(codex)}</span> Codex</span>
      </div>
      <div aria-label={`Claude Code ${pct.toFixed(0)}%`} style={{ position: "relative", height: 18, borderRadius: 9, overflow: "hidden", background: CODEX }}>
        <div style={{ width: `${pct}%`, height: "100%", background: CLAUDE, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />
        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 2, background: "var(--bg)" }} />
      </div>
      {d.players.length ? (
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {d.players.slice(0, top).map((p, i) => (
            <li key={p.login} style={{ display: "grid", gridTemplateColumns: "18px 22px 1fr auto", gap: 8, alignItems: "center" }}>
              <span className="muted small num">{i + 1}</span>
              {p.avatar ? <img src={p.avatar} alt="" width={22} height={22} style={{ borderRadius: "50%", outline: `2px solid ${color.get(p.team)}` }} /> : <span />}
              <span>@{p.login}</span>
              <span className="num" style={{ color: p.claude >= p.codex ? CLAUDE : CODEX }}>{short(p.total)}</span>
            </li>
          ))}
        </ol>
      ) : <p className="muted small" style={{ margin: 0 }}>No fuel yet.</p>}
      <p className="muted small" style={{ margin: 0 }}>Add yours: <code className="num">{CMD}</code> (counts only, never prompts or code)</p>
    </section>
  );
}
export default FuelPanel;
