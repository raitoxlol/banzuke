import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { fromWebhook, toRow } from "../lib/ingest";

const http = httpRouter();
auth.addHttpRoutes(http);

async function verify(secret: string, body: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const hex = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  let diff = hex.length ^ header.length;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ (header.charCodeAt(i) || 0);
  return diff === 0;
}

// GitHub App webhook: https://<deployment>.convex.site/github/webhook
// The payload is scored and stripped here (toRow); only the stripped row reaches the database.
http.route({
  path: "/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret || !(await verify(secret, body, req.headers.get("x-hub-signature-256")))) return new Response("bad signature", { status: 401 });
    const play = fromWebhook(req.headers.get("x-github-event"), JSON.parse(body), 0);
    if (!play) return Response.json({ ignored: "no points" });
    const res = await ctx.runMutation(internal.room.recordWebhook, { row: toRow(play, -1) });
    return Response.json({ result: res, kind: play.kind, private: play.private });
  }),
});

export default http;
