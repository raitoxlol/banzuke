"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Side, Sides } from "@/lib/sides";

const C = { claude: "var(--team-peach)", codex: "var(--team-blue)" } as const;
const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const };

export function TugBar({ s }: { s: Sides }) {
  const total = s.claude + s.codex;
  const pct = total ? (s.claude / total) * 100 : 50; // marker position from left; Claude pulls right
  const leader: Side | null = s.claude === s.codex ? null : s.claude > s.codex ? "claude" : "codex";
  const [flash, setFlash] = useState<Side | null>(null);
  const [flip, setFlip] = useState(false);
  const lastId = useRef(s.last?.id), lastLeader = useRef(leader);
  useEffect(() => {
    if (s.last && s.last.id !== lastId.current) { lastId.current = s.last.id; setFlash(s.last.side); const t = setTimeout(() => setFlash(null), 1200); return () => clearTimeout(t); }
  }, [s.last]);
  useEffect(() => {
    if (leader && lastLeader.current && leader !== lastLeader.current) { setFlip(true); setTimeout(() => setFlip(false), 2500); }
    if (leader) lastLeader.current = leader;
  }, [leader]);

  const side = (k: Side, name: string, n: number, pl: number, align: "left" | "right") => (
    <div style={{ textAlign: align, transition: "transform .3s", transform: flash === k ? "scale(1.08)" : "none", textShadow: flash === k ? `0 0 24px ${C[k]}` : "none" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: C[k], letterSpacing: 1 }}>{name}{leader === k ? " 👑" : ""}</div>
      <div style={{ ...mono, fontSize: 88, fontWeight: 700, lineHeight: 1, color: "var(--fg)" }}>{n.toLocaleString()}</div>
      <div style={{ ...mono, fontSize: 20, color: "var(--muted)" }}>{pl} {pl === 1 ? "player" : "players"}</div>
    </div>
  );

  return (
    <section style={{ position: "relative", width: "100%", padding: "24px 32px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 24, marginBottom: 20 }}>
        {side("claude", "Claude Code", s.claude, s.claudePlayers, "left")}
        <div style={{ fontFamily: "var(--font-jp)", fontSize: 44, color: "var(--muted)", paddingBottom: 12 }}>綱引き</div>
        {side("codex", "Codex", s.codex, s.codexPlayers, "right")}
      </div>
      <div style={{ position: "relative", height: 56, borderRadius: 28, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: C.claude, opacity: flash === "claude" ? 1 : 0.75, transition: "width 1.2s cubic-bezier(.2,.8,.2,1), opacity .3s" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, right: 0, background: C.codex, opacity: flash === "codex" ? 1 : 0.75, transition: "left 1.2s cubic-bezier(.2,.8,.2,1), opacity .3s" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "var(--fg)", opacity: 0.35 }} />
        <div style={{ position: "absolute", top: "50%", left: `${pct}%`, width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: "50%", background: "var(--fg)", border: "4px solid var(--bg)", boxShadow: "0 0 18px rgba(0,0,0,.6)", transition: "left 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </div>
      {flip && leader && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(11,13,18,.7)", borderRadius: 16, pointerEvents: "none" }}>
          <div style={{ textAlign: "center", color: C[leader] }}>
            <div style={{ fontFamily: "var(--font-jp)", fontSize: 120, fontWeight: 700, lineHeight: 1 }}>逆転</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{leader === "claude" ? "Claude Code" : "Codex"} takes the lead</div>
          </div>
        </div>
      )}
    </section>
  );
}

export function TugLive() {
  const s = useQuery(api.room.sides);
  return <TugBar s={s ?? { claude: 0, codex: 0, claudePlayers: 0, codexPlayers: 0, last: null }} />;
}

/** No Convex: fake numbers that tick, so it still demos. */
export function TugDemo() {
  const [s, set] = useState<Sides>({ claude: 142, codex: 131, claudePlayers: 38, codexPlayers: 41, last: null });
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => set((o) => {
      const side: Side = Math.random() < 0.5 ? "claude" : "codex", pts = 1 + Math.floor(Math.random() * 6);
      return { ...o, [side]: o[side] + pts, last: { side, at: Date.now(), id: String(++n) } };
    }), 2500);
    return () => clearInterval(t);
  }, []);
  return <TugBar s={s} />;
}
