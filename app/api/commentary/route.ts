import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Call every few minutes (Vercel cron or any scheduler) with
//   Authorization: Bearer $PULSE_ADMIN_TOKEN
// It reads the latest plays and writes one Grok commentator line.
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.PULSE_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = serviceClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [{ data: events }, { data: teams }] = await Promise.all([
    db.from("events").select("kind,points,player_login,team_id,repo,summary,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(20),
    db.from("team_scores").select("*").order("score", { ascending: false }),
  ]);
  if (!events?.length) return NextResponse.json({ skipped: "quiet period" });

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const plays = events
    .map((e) => `${teamName.get(e.team_id)} | @${e.player_login} | ${e.kind} +${e.points} | ${e.repo} | ${e.summary}`)
    .join("\n");
  const table = (teams ?? []).map((t) => `${t.name}: ${t.score}`).join(", ");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.XAI_MODEL ?? "grok-4.7",
      max_tokens: 400,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content:
            "You are the live play-by-play commentator for Pulse League, where teams of developers score points by shipping code. " +
            "Write ONE punchy line (max 25 words) about the most exciting recent play. Name the player and team. No hashtags, no emojis.",
        },
        { role: "user", content: `Standings this week: ${table}\nRecent plays (newest first):\n${plays}` },
      ],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `xai ${res.status}` }, { status: 502 });
  const json = await res.json();
  const line: string = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!line) return NextResponse.json({ skipped: "empty" });
  await db.from("commentary").insert({ line });
  return NextResponse.json({ line });
}
