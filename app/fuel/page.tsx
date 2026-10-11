"use client";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";

const FuelPanel = dynamic(() => import("@/components/FuelPanel"), { ssr: false });

export default function Fuel() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <a href="/" className="muted small">← Banzuke</a>
      <h1>AI使用量</h1>
      {hasConvex() ? <FuelPanel top={20} /> : <p className="muted">現在、使用量の集計を利用できません。</p>}
    </main>
  );
}
