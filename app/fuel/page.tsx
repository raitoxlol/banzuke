"use client";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";

const FuelPanel = dynamic(() => import("@/components/FuelPanel"), { ssr: false });

export default function Fuel() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <a href="/" className="muted small">← Banzuke</a>
      <h1>AI fuel</h1>
      {hasConvex() ? <FuelPanel top={20} /> : <p className="muted">Needs Convex (see GO-LIVE.md).</p>}
    </main>
  );
}
