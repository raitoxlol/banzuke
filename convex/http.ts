import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { fromWebhook, toRow } from "../lib/ingest";
import { cleanWindows } from "../lib/fuel";

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

// AI fuel from the CLI. Identity = whoever GitHub says owns the bearer token; the token is not stored.
http.route({
  path: "/tokens",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return new Response("missing GitHub token", { status: 401 });
    const gh = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${token}`, "user-agent": "banzuke", accept: "application/vnd.github+json" } });
    if (!gh.ok) return new Response("GitHub token rejected", { status: 401 });
    const { login } = (await gh.json()) as { login?: string };
    if (!login) return new Response("no login", { status: 401 });
    let windows;
    try { windows = cleanWindows(JSON.parse(await req.text()), Date.now()); } catch (e) { return new Response((e as Error).message, { status: 400 }); }
    const res = await ctx.runMutation(internal.fuel.record, { login, windows });
    return Response.json(res, { status: "error" in res ? 403 : 200 });
  }),
});

export default http;
