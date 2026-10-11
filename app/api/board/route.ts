import { NextResponse } from "next/server";
import { API_HEADERS, boardFor } from "@/lib/status";
import { snapshot } from "@/lib/status-source";

export const dynamic = "force-dynamic";
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: API_HEADERS }); }
export async function GET() { return NextResponse.json(boardFor(await snapshot()), { headers: API_HEADERS }); }
