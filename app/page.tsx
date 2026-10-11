"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";

const RoomLive = dynamic(() => import("@/components/RoomLive"), { ssr: false });
const RoomDemo = dynamic(() => import("@/components/RoomDemo"), { ssr: false });

/** Live Convex data only. Mock data appears solely with ?demo=1 (or with no Convex configured). */
export default function Room() {
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => setDemo(new URLSearchParams(location.search).get("demo") === "1"), []);
  if (demo === null) return null;
  if (demo || !hasConvex()) return <RoomDemo />;
  return <RoomLive />;
}
