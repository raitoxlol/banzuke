"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RoomBoard } from "./RoomBoard";
import { TugLive } from "./TugOfWar";
import JoinCta from "./JoinCta";

export default function RoomLive() {
  const data = useQuery(api.room.board) ?? { players: [], plays: [] };
  return (
    <>
      <JoinCta />
      <div style={{ margin: "0 0 24px" }}><TugLive /></div>
      <RoomBoard data={data} live />
    </>
  );
}
