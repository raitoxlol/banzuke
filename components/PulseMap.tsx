"use client";
import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { PulseEvent, Team } from "@/lib/supabase";

const W = 960, H = 500;
const WORLD = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function PulseMap({ events, teams }: { events: PulseEvent[]; teams: Team[] }) {
  const [land, setLand] = useState<string | null>(null);
  const projection = useMemo(() => geoNaturalEarth1().fitSize([W, H], { type: "Sphere" }), []);
  const color = useMemo(() => new Map(teams.map((t) => [t.id, t.color])), [teams]);

  useEffect(() => {
    fetch(WORLD).then((r) => r.json()).then((topo) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geo = feature(topo, topo.objects.countries) as any;
      setLand(geoPath(projection)(geo));
    }).catch(() => setLand(null));
  }, [projection]);

  const now = Date.now();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label="Live map of pushes">
      {land && <path d={land} className="land" />}
      {events.slice(0, 80).map((e) => {
        const p = projection([e.lng, e.lat]);
        if (!p) return null;
        const age = (now - new Date(e.created_at).getTime()) / 1000;
        const fresh = age < 20;
        const r = 3 + Math.min(e.points, 25) / 3;
        return (
          <g key={e.id} transform={`translate(${p[0]},${p[1]})`} opacity={Math.max(0.25, 1 - age / 900)}>
            {fresh && <circle r={r} className="ping" stroke={color.get(e.team_id)} />}
            <circle r={r} fill={color.get(e.team_id) ?? "#fff"} />
          </g>
        );
      })}
    </svg>
  );
}
