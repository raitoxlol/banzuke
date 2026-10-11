# Banzuke 番付

**A live leaderboard for the room, built and run by a Grok Bot team.**
Builders sign in with GitHub, get sorted at random onto **Team Blue** or **Team Orange**, and every push, merged PR and release scores live on a projector board.

Live: **https://banzuke.raitox.tech** · Join: **https://banzuke.raitox.tech/join**
Built at the Grok Bot Tokyo Hackathon (Oct 11, 2026).

> **Note for reviewers:** the board is intentionally almost empty right now. Banzuke was built for the people in this room, and participants join live during the presentation by scanning the QR code (`/join`). Until then, the only player is the builder (Team Orange). Add `?demo=1` to `/` or `/tug` to see it with sample data.

## What it does
- **Instant score:** signing in with GitHub backfills your last 72 hours of public activity.
- **Private repos count, privately:** install the [GitHub App](https://github.com/apps/banzukeboard/installations/new) and private pushes score. Repo names and commit messages are never stored or shown.
- **Team battle:** Blue vs Orange with a two-sided bar and a 逆転 flash when the lead flips. Teams are assigned by hashing your GitHub login: random, but fixed and evenly split.
- **Team battle:** Team Blue vs Team Orange. Pick a side on /join (or get a random one). Per-agent token counts live only on /fuel.
- **AI fuel:** the opt-in `banzuke` CLI totals local token usage and sends only the numbers to `/fuel`.
- **Works with your Grok Bot:** a public API plus a skill file let anyone's Grok Bot check how its human is doing.

## The Grok Bot team
| Bot | Role |
|---|---|
| **Wright** | Lead engineer: architecture, backend, CLI, tests, deploys; writes GitHub issues for Codex and reviews its PRs |
| **Gyoji** | Live commentator: turns board data into play-by-play, never leaks private repos |
| **Recruiter** | Writes EN/JP invites and FAQs (human approves every send) |
| **Ops** | Health checks pages and the webhook, watches logs, reports fixes |
| Human (らいと) | Direction, design calls, approvals. Codex built the broadcast UI from Wright's issues |

## Stack
- **Next.js 15** (React, TypeScript) on **Vercel**, with the custom domain on Cloudflare DNS
- **Convex**: realtime database, queries and mutations, and Convex Auth (GitHub)
- **GitHub App webhook** (HMAC verified) for live and private scoring, plus the GitHub public events API for the 72h backfill
- **Node CLI** (`cli/banzuke.mjs`) with an interactive terminal UI

## Use with your Grok Bot
```
Read https://banzuke.raitox.tech/skill.md and save it as a skill, then tell me how I'm doing on Banzuke (my GitHub is <login>).
```
Public read-only API: `GET /api/status?login=<github>` and `GET /api/board`.

## AI fuel CLI
```bash
npx github:raitoxlol/banzuke          # setup + sync
npx github:raitoxlol/banzuke --demo   # sample data
```

## Scoring
| Play | Points |
|---|---|
| Push | 1 per counted commit (max 5 per push, 12 push points per hour) |
| Merged PR | 10 (+2 at 10★, +5 at 50★) |
| Release | 25 (prerelease 12) |

## Run locally
```bash
npm install && npm run dev   # demo mode without NEXT_PUBLIC_CONVEX_URL
npx convex dev               # live backend
npm test
```
