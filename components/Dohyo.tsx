"use client";
import type { Builder, TeamRow } from "@/lib/board";
import type { Play } from "@/lib/firehose";

const C = 500; // viewBox center
function hash(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function polar(team: number, key: string, r: number) {
  const a = ((team + 0.08 + (hash(key) % 1000) / 1000 * 0.84) / 6) * Math.PI * 2 - Math.PI / 2;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
}

/** Six wedges, one per stable. Builders sit closer to the centre the more they score. Plays flash on the rim. */
export function Dohyo({ teams, builders, flashes, total, perMin }: {
  teams: TeamRow[]; builders: Builder[]; flashes: Play[]; total: number; perMin: number;
}) {
  const color = new Map(teams.map((t) => [t.id, t.color]));
  const top = builders[0]?.score || 1;
  const arc = (i: number, r: number) => {
    const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2 + 0.02, a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2 - 0.02;
    return `M${C + Math.cos(a0) * r} ${C + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${C + Math.cos(a1) * r} ${C + Math.sin(a1) * r}`;
  };
  const byId = [...teams].sort((a, b) => a.id - b.id);
  return (
    <svg viewBox="0 0 1000 1000" className="dohyo" role="img" aria-label="チームごとの最新の活動">
      <defs>
        <radialGradient id="core"><stop offset="0" stopColor="#5BBDBA" stopOpacity=".16" /><stop offset="1" stopColor="#5BBDBA" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={C} cy={C} r={470} className="ring-outer" />
      <g className="spin">
        {[150, 260, 370].map((r) => <circle key={r} cx={C} cy={C} r={r} className="ring" />)}
        {byId.map((t) => <line key={t.id} x1={C} y1={C} x2={C + Math.cos((t.id / 6) * Math.PI * 2 - Math.PI / 2) * 460} y2={C + Math.sin((t.id / 6) * Math.PI * 2 - Math.PI / 2) * 460} className="spoke" />)}
      </g>
      {byId.map((t) => {
        const share = t.score / Math.max(1, teams.reduce((s, x) => s + x.score, 0));
        return <g key={t.id}>
          <path d={arc(t.id, 452)} stroke={t.color} strokeOpacity=".22" strokeWidth="14" fill="none" />
          <path d={arc(t.id, 452)} stroke={t.color} strokeWidth="14" fill="none" pathLength={1} strokeDasharray={`${share * 2.4} 1`} className="arc-fill" />
          <text {...(() => { const [x, y] = polar(t.id, "", 0); const a = ((t.id + 0.5) / 6) * Math.PI * 2 - Math.PI / 2; return { x: C + Math.cos(a) * 412 + x * 0, y: C + Math.sin(a) * 412 + y * 0 }; })()} className="wedge-label" fill={t.color}>{t.name.toUpperCase()}</text>
        </g>;
      })}
      <circle cx={C} cy={C} r={150} fill="url(#core)" />
      {builders.slice(0, 60).map((b) => {
        const r = 70 + (1 - Math.sqrt(b.score / top)) * 300;
        const [x, y] = polar(b.team, b.login, r);
        return <circle key={b.login} className="builder" style={{ transform: `translate(${x}px, ${y}px)` }} r={3 + Math.sqrt(b.score) * 1.6} fill={color.get(b.team)} />;
      })}
      {flashes.map((p) => {
        const [x, y] = polar(p.team, p.login, 330 + (hash(p.id) % 110));
        const big = p.kind !== "push" && p.kind !== "star";
        return <g key={p.id} transform={`translate(${x} ${y})`}>
          <circle r={big ? 14 : 6} className={`flash ${big ? "big" : ""}`} stroke={color.get(p.team)} />
          <circle r={big ? 5 : 2.5} fill={color.get(p.team)} className="spark" />
        </g>;
      })}
      <text x={C} y={C - 18} className="core-num">{total.toLocaleString("ja-JP")}</text>
      <text x={C} y={C + 24} className="core-label">直近1時間の得点</text>
      <text x={C} y={C + 56} className="core-sub">毎分{perMin.toFixed(0)}件の活動を取得</text>
    </svg>
  );
}
