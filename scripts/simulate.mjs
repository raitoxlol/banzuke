// Sends a signed fake GitHub push webhook to your running app.
// Usage: GITHUB_WEBHOOK_SECRET=... node scripts/simulate.mjs <github_login> [url]
import { createHmac, randomUUID } from "node:crypto";

const login = process.argv[2] ?? "raitoxlol";
const url = process.argv[3] ?? "http://localhost:3000/api/github/webhook";
const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) throw new Error("set GITHUB_WEBHOOK_SECRET");

const payload = {
  sender: { login },
  repository: { full_name: `${login}/demo`, private: false, stargazers_count: 3 },
  commits: [
    { id: randomUUID(), message: "feat: live map pings", distinct: true, author: { username: login }, modified: ["app/page.tsx"] },
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
