"use client";
import { useEffect, useState } from "react";
import { demoPlay, demoRoom } from "@/lib/demo";
import { RoomBoard } from "@/components/RoomBoard";
import type { RoomData } from "@/lib/room-broadcast";

/** Mock room, only reachable via /?demo=1. */
export default function RoomDemo() {
  const [data, setData] = useState<RoomData>({ players: [], plays: [] });
  useEffect(() => {
    setData(demoRoom());
    const t = setInterval(() => setData((d) => ({ ...d, plays: [demoPlay(), ...d.plays].slice(0, 400) })), 1800);
    return () => clearInterval(t);
  }, []);
  return <RoomBoard data={data} live={false} />;
}
