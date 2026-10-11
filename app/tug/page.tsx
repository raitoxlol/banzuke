"use client";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";

const Tug = dynamic(() => import("@/components/TugOfWar").then((m) => (hasConvex() ? m.TugLive : m.TugDemo)), { ssr: false });

export default function TugPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", alignContent: "center", padding: "0 48px", boxSizing: "border-box" }}>
      <Tug />
    </main>
  );
}
