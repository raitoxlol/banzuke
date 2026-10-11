"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";

const Live = dynamic(() => import("@/components/TugOfWar").then((m) => m.TugLive), { ssr: false });
const Demo = dynamic(() => import("@/components/TugOfWar").then((m) => m.TugDemo), { ssr: false });

/** Full-screen agent race. Live data only; mock lanes via ?demo=1. */
export default function TugPage() {
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => setDemo(new URLSearchParams(location.search).get("demo") === "1" || !hasConvex()), []);
  return (
    <main style={{ minHeight: "100vh", display: "grid", alignContent: "center", padding: "0 48px", boxSizing: "border-box" }}>
      {demo === null ? null : demo ? <Demo /> : <Live />}
    </main>
  );
}
