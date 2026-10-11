"use client";
import { useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/supabase";

// Sumo ranks, top down. Anything past the list is maegashira.
const RANKS = [["横綱", "Yokozuna"], ["大関", "Ozeki"], ["関脇", "Sekiwake"], ["小結", "Komusubi"]] as const;

function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, d = value - a;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const v = Math.round(a + d * (1 - Math.pow(1 - k, 3)));
      setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function Row({ team, rank, lead }: { team: Team; rank: number; lead: number }) {
  const shown = useCountUp(team.score);
  const prev = useRef(team.score);
  const [delta, setDelta] = useState<{ n: number; k: number } | null>(null);
  useEffect(() => {
    const d = team.score - prev.current, seeded = prev.current > 0;
    prev.current = team.score;
    if (d > 0 && seeded) setDelta((x) => ({ n: d, k: (x?.k ?? 0) + 1 }));
  }, [team.score]);
  const [jp, en] = RANKS[rank] ?? ["前頭", "Maegashira"];
  return (
    <li style={{ transform: `translateY(calc(${rank} * var(--row)))`, ["--team" as string]: team.color }} className={rank === 0 ? "top" : ""}>
      <span className="rank"><b>{jp}</b><small>{en}</small></span>
      <span className="name">{team.name}</span>
      <span className="bar"><i style={{ width: `${lead ? (team.score / lead) * 100 : 0}%` }} /></span>
      <span className="score num">{shown}</span>
      {delta && <span key={delta.k} className="delta num">+{delta.n}</span>}
    </li>
  );
}

export function Banzuke({ teams }: { teams: Team[] }) {
  const order = [...teams].sort((a, b) => b.score - a.score).map((t) => t.id);
  const lead = Math.max(1, ...teams.map((t) => t.score));
  return (
    <ol className="banzuke" style={{ height: `calc(${teams.length} * var(--row))` }}>
      {teams.map((t) => <Row key={t.id} team={t} rank={order.indexOf(t.id)} lead={lead} />)}
    </ol>
  );
}
