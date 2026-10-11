import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { CONVEX_URL } from "./convex";
import type { Snapshot } from "./status";

export async function snapshot(): Promise<Snapshot> {
  return (await new ConvexHttpClient(CONVEX_URL).query(api.room.board, {})) as Snapshot;
}
