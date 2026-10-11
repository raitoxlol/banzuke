# Pulse League

Teams of builders compete live on what they ship. Sign in with GitHub, get drafted onto a team, and every public push, merged PR and release scores for your team on a 24/7 broadcast: a world map that pings with each push, a live scoreboard, and a Grok play-by-play commentator.

**Status:** hackathon v1 scaffold (Grok Bot Tokyo Hackathon, Oct 11, 2026). Token-count scoring comes in v2 with a local CLI.

## Run it now (demo mode)

```bash
npm install && npm run dev
```

No `NEXT_PUBLIC_CONVEX_URL` = demo mode (fake room incl. private plays). With Convex: `npx convex dev` in a second terminal. Going live: see **GO-LIVE.md**. Tests: `npm test` (private-repo stripping, backfill, dedupe).

## How it works

- `/` Room board (Convex, reactive `useQuery`), big QR to `/join`. `/global` public firehose, no sign-in.
- `/join` GitHub sign-in (Convex Auth) → drafted into the smallest of 6 stables → `room.backfill` action scores the last 72h of `/users/{login}/events/public` (≤3 pages).
- GitHub App webhook → `convex/http.ts` `/github/webhook` (HMAC verified) → `room.recordWebhook`.
- All plays go through `lib/ingest.ts` `toRow()`. **Private repos keep only login, kind, points, time**; repo and summary are blanked before insert and `assertClean` refuses anything else. `dedupeKey` is a one-way hash shared by webhook and backfill (push = head sha), so nothing double-counts.

## Scoring (`lib/scoring.ts`)

| Play | Points | Guard rails |
|---|---|---|
| Push | 1 per counted commit | max 5 commits per push, 12 push points per hour; bots, merges, empty and duplicate commits ignored |
| Merged PR | 10 (+2 at 10★, +5 at 50★) | |
| Release | 25 (prerelease 12) | |

Public and private repos count (private shown as "a private repo"). Each play is stored once (`dedupeKey`).

## Next up

- Player cities on the map (now a hashed spot near Tokyo until they set one)
- Weekly seasons, promotion and relegation
- v2: `pulse` CLI that reads Claude Code / Codex usage for token and efficiency boards
- Stream the page 24/7 (headless browser → OBS/ffmpeg → YouTube/Twitch)
