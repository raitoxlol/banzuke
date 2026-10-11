# Brand

"Pulse League" is a placeholder. The name lives in `lib/brand.ts`. Change it there.

## Pitch

Your commits are the game. Your team is on the board.

## What it is

Builders sign in with GitHub and get drafted onto the smallest team. A GitHub App webhook scores every public push, merged PR and release for that team. A live page shows a world map that pings on each push, a team scoreboard and a feed of plays. A Grok commentator writes one play-by-play line from the last 15 minutes of plays.

Planned, not built: player-set cities on the map, weekly seasons with promotion and relegation, a `pulse` CLI for token and efficiency boards (v2), and a 24/7 stream.

## Who it's for

Hackathon rooms, dev communities and friend groups who ship in public and want a reason to ship today.

## Commentator voice

Sports radio, not a hype bot. Short. Names the player and the team. Facts from the play only. No emojis, no hashtags.

- "@sakura-dev merges a PR for Shibuya. Ten points, and they take the lead."
- "Release from @kenji. Akiba jumps 25. That's the play of the hour."
- "Kichijoji has gone quiet. Fifteen minutes, zero pushes."

## Name and wordmark

All caps, wide tracking (0.12em), semibold sans. A pulse dot to the left blinks while live. A small badge on the right reads LIVE or DEMO in pulse color. Pulse red is used for live state only.

## Palette

Dark first. One accent. Team colors are muted so the map reads as data, not decoration.

| Token | Hex | On bg | On surface-2 |
|---|---|---|---|
| bg | #0B0D12 | | |
| surface-1 | #12151C | | |
| surface-2 | #1A1E27 | | |
| border | #272C38 | 1.39 | 1.19 |
| text | #E8EAF0 | 16.16 | 13.87 |
| text-muted | #9AA1B0 | 7.50 | 6.43 |
| pulse (accent) | #5BBDBA | 6.27 | 5.39 |
| success | #4CC38A | 8.77 | 7.53 |
| warn | #E5A84B | 9.29 | 7.97 |
| team-rose | #E07A8A | 6.77 | 5.81 |
| team-blue | #6FA8DC | 7.69 | 6.60 |
| team-gold | #D4B05C | 9.41 | 8.07 |
| team-green | #6FBF8E | 8.81 | 7.56 |
| team-violet | #A68CD9 | 6.82 | 5.86 |
| team-peach | #E39A6B | 8.42 | 7.23 |

All text and accent colors pass WCAG AA (4.5:1) on bg and surface-2. Text on a pulse fill uses bg color (6.27:1). White on pulse fails (2.58:1). Do not use it. Border is decorative and not meant to pass.

Tokens live as CSS variables in `app/globals.css`.

## Type

- Geist for UI (via `next/font`). Inter is the fallback.
- Geist Mono with tabular numbers for scores and points.

## Name candidates

Checked Oct 11, 2026. .com via Verisign RDAP. GitHub via the users API. Taken means registered, not necessarily in use.

| Name | Why | .com | GitHub |
|---|---|---|---|
| Ship Derby | A race to ship, with a sports name. | looks free | looks free |
| Deploy Derby | Same race, and it alliterates. | looks free | looks free |
| Push Derby | Pushes are the base play. | looks free | looks free |
| Ship Bracket | Teams, rounds and a winner. Fits seasons. | looks free | looks free |
| Build Derby | Broader than code. | looks free | looks free |
| Shipcast | Shipping plus broadcast. Says what the page is. | taken | taken (org) |
| Pushball | Short, sporty and ownable as a word. | taken | looks free |
| Commit Clash | Team versus team, built on commits. | taken | looks free |
| Merge League | Close to the current name, more dev-specific. | taken | looks free |
| Live Commit | Plain and literal. | looks free | taken (user) |

## Global mode (branch `global`)

No sign-in. Every public GitHub account is on the board. The page at `/` is the global broadcast; the original sign-in league is kept at `/league`.

**Data.** `/api/firehose` polls `https://api.github.com/events?per_page=100`, honouring `ETag` (304s are free) and `X-Poll-Interval` (60s). It keeps a one-hour rolling window in memory per warm instance. `GITHUB_TOKEN` is optional (raises the limit to 5,000/hr and pulls 3 pages per poll). If the server is rate-limited, the browser polls the same endpoint directly on its own 60/hr budget. If that fails too, the badge flips to DEMO and fake plays run. The public feed is a sample of GitHub, about 5 minutes behind, and push events no longer include commit lists, so each push scores 1 point (capped at 12 per builder per hour, as in `lib/scoring.ts`). Merged PRs score 10 (+ star bonus), releases 25 (12 for pre-releases), and stars score 0 but flash on the ring. Bots are filtered out.

**Teams: random draft (default).** Each GitHub login is hashed with the basho (season) key into one of six stables named after real sumo heya: Isegahama, Sadogatake, Kokonoe, Dewanoumi, Takadagawa and Nishonoseki. The basho is the JST date, so everyone gets redrafted every day; `?basho=anything` forces a custom draw. It costs zero API calls, it's fair and it's stable within a season. Country and region teams were rejected as boring and too expensive (every profile would need a lookup). Language teams exist as an opt-in experiment (`GITHUB_TOKEN` + `BANZUKE_LANG_TEAMS=1`).

**Relevant mode.** `?seed=<github login>` (or type it in the header box). The browser fetches that user's following, followers and the stargazers of their most-starred repo (small N, cached in localStorage for 30 minutes), then highlights those builders wherever they appear in the firehose. It also polls `/users/{login}/events/public` for the seed and one circle member every 2.5 minutes, so their plays land even when the sample misses them. The "Top builders" panel puts your circle first. X handles: `?seed=x:handle` tries the same login on GitHub; there's no reliable public X-to-GitHub lookup, so the user supplies the GitHub login.

**Broadcast.** Five big counters (pushes per minute sampled, builders, merges, releases, stars). A dohyo ring in the middle has one wedge per stable. Builders drift toward the centre as they score, and every play flashes on the rim. Stables and top builders are ranked Yokozuna to Maegashira. A TORIKUMI 取組 callout fires when two stables swap places. Commentary comes from templates built on real plays, and `/api/commentary` stays available for xAI.
