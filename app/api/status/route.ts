import { NextResponse } from "next/server";
import { API_HEADERS, statusFor, BOARD_URL } from "@/lib/status";
import { snapshot } from "@/lib/status-source";

export const dynamic = "force-dynamic";
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: API_HEADERS }); }
export async function GET(req: Request) {
  const login = (new URL(req.url).searchParams.get("login") ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return NextResponse.json({ error: "pass ?login=<github login>" }, { status: 400, headers: API_HEADERS });
  const s = statusFor(await snapshot(), login);
  if (!s) return NextResponse.json({ error: "unknown login", login, join: `${BOARD_URL}/join` }, { status: 404, headers: API_HEADERS });
  return NextResponse.json(s, { headers: API_HEADERS });
}
