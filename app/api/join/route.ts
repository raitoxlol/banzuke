import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Called by /auth/callback after GitHub sign-in. Drafts the player onto a team.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "no session" }, { status: 401 });
  const db = serviceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "bad session" }, { status: 401 });

  const meta = user.user_metadata ?? {};
  const login: string | undefined = meta.user_name ?? meta.preferred_username;
  if (!login) return NextResponse.json({ error: "not a GitHub account" }, { status: 400 });

  const { data: player, error: e2 } = await db.rpc("draft_player", {
    p_login: login, p_auth: user.id, p_name: meta.full_name ?? login, p_avatar: meta.avatar_url ?? null,
  });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  const { data: team } = await db.from("teams").select("*").eq("id", player.team_id).single();
  return NextResponse.json({ player, team });
}
