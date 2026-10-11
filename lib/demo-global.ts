import type { RawEvent } from "./firehose";
// Offline fallback: plausible events so the broadcast never opens empty.
const USERS = ["sakura-dev", "kenji", "lena-k", "arjun", "mika", "noah", "chloe", "yuki", "ana-p", "tomas", "ife", "wei", "omar", "zoe", "ravi", "hana", "luca", "sven"];
const REPOS = ["api", "web", "cli", "infra", "notebook", "app", "engine", "dotfiles", "site", "sdk"];
let n = 1;
export function demoRaw(at = Date.now()): RawEvent {
  const u = USERS[Math.floor(Math.random() * USERS.length)];
  const r = Math.random();
  const type = r > 0.96 ? "ReleaseEvent" : r > 0.85 ? "PullRequestEvent" : r > 0.8 ? "WatchEvent" : "PushEvent";
  return {
    id: `demo-${n++}`, type, created_at: new Date(at).toISOString(),
    actor: { id: u.length * 977, login: u, display_login: u, avatar_url: "" },
    repo: { name: `${u}/${REPOS[Math.floor(Math.random() * REPOS.length)]}` },
    payload: type === "PullRequestEvent" ? { action: "closed", pull_request: { merged: true, number: 40 + n, title: "feat: ship it" } }
      : type === "ReleaseEvent" ? { action: "published", release: { tag_name: `v0.${n % 9}.0` } }
      : { ref: "refs/heads/main", size: 1 + Math.floor(Math.random() * 3) },
  };
}
