// Sends a signed fake GitHub push webhook to your running app.
// Usage: GITHUB_WEBHOOK_SECRET=... node scripts/simulate.mjs <github_login> [url] [--private]
// url defaults to $CONVEX_SITE_URL/github/webhook (e.g. https://xxx.convex.site/github/webhook).
import { createHmac, randomUUID } from "node:crypto";

const login = process.argv[2] ?? "raitoxlol";
const priv = process.argv.includes("--private");
const url = process.argv.slice(3).find((a) => a.startsWith("http")) ?? `${process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3211"}/github/webhook`;
const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) throw new Error("set GITHUB_WEBHOOK_SECRET");

const payload = {
  sender: { login },
  after: randomUUID().replace(/-/g, ""),
  ref: "refs/heads/launch-plan",
  repository: { id: 42, full_name: priv ? "acme/stealth-startup" : `${login}/demo`, private: priv, stargazers_count: 3 },
  commits: [
    { id: randomUUID(), message: priv ? "feat: secret pricing engine" : "feat: live map pings", distinct: true, author: { username: login }, modified: ["app/page.tsx"] },
    { id: randomUUID(), message: "fix: score caps", distinct: true, author: { username: login }, modified: ["lib/scoring.ts"] },
  ],
};
const body = JSON.stringify(payload);
const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-github-event": "push", "x-github-delivery": randomUUID(), "x-hub-signature-256": sig },
  body,
});
console.log(res.status, await res.text());
