"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { hasConvex } from "@/lib/convex";
import { demoPlay, demoRoom } from "@/lib/demo";
import { RoomBoard, RoomData } from "@/components/RoomBoard";
import { ViewToggle } from "@/components/ViewToggle";

const RoomLive = dynamic(() => import("@/components/RoomLive"), { ssr: false });

function RoomDemo() {
  const [data, setData] = useState<RoomData>({ players: [], plays: [] });
  useEffect(() => {
    setData(demoRoom());
    const t = setInterval(() => setData((d) => ({ ...d, plays: [demoPlay(), ...d.plays].slice(0, 400) })), 1800);
    return () => clearInterval(t);
  }, []);
  return <RoomBoard data={data} live={false} />;
}

export default function Room() {
  return <>{hasConvex() ? <RoomLive /> : <RoomDemo />}<ViewToggle view="room" /></>;
}
