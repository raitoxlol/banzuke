import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/github";
import { serviceClient } from "@/lib/supabase";
import { pushPoints, prPoints, releasePoints, countableCommits, Commit } from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !verifySignature(secret, body, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event");
  const delivery = req.headers.get("x-github-delivery") ?? crypto.randomUUID();
  const payload = JSON.parse(body);
  const db = serviceClient();

  const login: string | undefined = payload.sender?.login;
  if (!login || /\[bot\]$/.test(login)) return NextResponse.json({ ignored: "bot or no sender" });

  const { data: player } = await db.from("players").select("*").eq("github_login", login).maybeSingle();
  if (!player) return NextResponse.json({ ignored: "not a league player" });

  const repo: string = payload.repository?.full_name ?? "unknown";
  if (payload.repository?.private) return NextResponse.json({ ignored: "private repo" });

  let kind: "push" | "pr_merged" | "release" | null = null;
  let points = 0;
  let summary = "";

  if (event === "push") {
    const commits: Commit[] = payload.commits ?? [];
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: recent } = await db
      .from("events").select("points")
      .eq("player_login", login).eq("kind", "push").gte("created_at", since);
    const already = (recent ?? []).reduce((s, r) => s + r.points, 0);
    points = pushPoints(commits, already);
    const counted = countableCommits(commits);
    summary = counted[0]?.message.split("\n")[0].slice(0, 120) ?? "";
    kind = "push";
  } else if (event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged) {
    kind = "pr_merged";
    points = prPoints(payload.repository?.stargazers_count ?? 0);
    summary = `merged #${payload.pull_request.number}: ${payload.pull_request.title}`.slice(0, 140);
  } else if (event === "release" && payload.action === "published") {
    kind = "release";
    points = releasePoints(Boolean(payload.release?.prerelease));
    summary = `released ${payload.release?.tag_name}`;
  }

  if (!kind || points === 0) return NextResponse.json({ ignored: "no points" });

  const { error } = await db.from("events").insert({
    kind, points, player_login: login, team_id: player.team_id, repo, summary,
    lat: player.lat, lng: player.lng, dedupe_key: delivery,
  });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind, points });
}
