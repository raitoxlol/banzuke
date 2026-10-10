# Pulse League

Teams of builders compete live on what they ship. Sign in with GitHub, get drafted onto a team, and every public push, merged PR and release scores for your team on a 24/7 broadcast: a world map that pings with each push, a live scoreboard, and a Grok play-by-play commentator.

**Status:** hackathon v1 scaffold (Grok Bot Tokyo Hackathon, Oct 11, 2026). Token-count scoring comes in v2 with a local CLI.

## Run it now (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys, the page runs in **demo mode** with fake plays, so you can work on the broadcast UI right away.

## Go live (about 15 minutes)

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor, and turn on the **GitHub** auth provider (Authentication → Providers). Copy the URL, anon key and service role key.
2. **Env**: `cp .env.example .env.local` and fill it in. Pick any long random `GITHUB_WEBHOOK_SECRET` and `PULSE_ADMIN_TOKEN`.
3. **Deploy** to Vercel with the same env vars.
4. **GitHub App**: create one (Settings → Developer settings → GitHub Apps) using the values in `github-app/manifest.json`. Webhook URL: `https://<your-app>/api/github/webhook`. Secret: your `GITHUB_WEBHOOK_SECRET`. Permissions: Contents read, Metadata read, Pull requests read. Events: Push, Pull request, Release.
5. **Play**: open `/join`, sign in with GitHub, then install the GitHub App on the repos you want to count.
6. **Commentator**: call `POST /api/commentary` with `Authorization: Bearer $PULSE_ADMIN_TOKEN` every few minutes (Vercel cron, GitHub Actions schedule, or Hermes). It writes one Grok line from the last 15 minutes of plays.

Test the webhook locally without GitHub:

```bash
GITHUB_WEBHOOK_SECRET=... node scripts/simulate.mjs <your_github_login>
```

(The login must have joined first, so it exists in `players`.)

## Scoring (`lib/scoring.ts`)

| Play | Points | Guard rails |
|---|---|---|
| Push | 1 per counted commit | max 5 commits per push, 12 push points per hour; bots, merges, empty and duplicate commits ignored |
| Merged PR | 10 (+2 at 10★, +5 at 50★) | |
| Release | 25 (prerelease 12) | |

Only public repos count. Each webhook delivery is stored once (`dedupe_key`), so replays don't double-score.

## Layout

```
app/page.tsx                    live broadcast (map, scoreboard, plays, commentary)
app/join, app/auth/callback     GitHub sign-in → auto-draft onto the smallest team
app/api/github/webhook          verifies signature, scores push / PR / release
app/api/commentary              Grok play-by-play line (xAI API)
app/api/join                    drafts the signed-in player (draft_player RPC)
lib/scoring.ts                  all scoring rules
supabase/schema.sql             tables, team_scores view, draft function, RLS, realtime
scripts/simulate.mjs            send a signed fake push
```

## Next up

- Player cities on the map (now a hashed spot near Tokyo until they set one)
- Weekly seasons, promotion and relegation
- v2: `pulse` CLI that reads Claude Code / Codex usage for token and efficiency boards
- Stream the page 24/7 (headless browser → OBS/ffmpeg → YouTube/Twitch)
