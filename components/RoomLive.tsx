"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RoomBoard } from "./RoomBoard";

export default function RoomLive() {
  const data = useQuery(api.room.board) ?? { players: [], plays: [] };
  return <RoomBoard data={data} live />;
}
