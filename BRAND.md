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
| team-teal | #5BBDBA | 8.73 | 7.49 |

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
