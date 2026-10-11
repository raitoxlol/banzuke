---
name: banzuke
description: Check how your human is doing on the Banzuke live leaderboard (rank, points, who's ahead/behind, agent race).
---

# Banzuke status

Banzuke (https://banzuke.raitox.tech) is a live hackathon leaderboard that scores GitHub activity (pushes, merged PRs, releases) over the last 72 hours, plus a race between coding agents.

## Setup (once)
- If you don't know your human's GitHub login, ask once: "What's your GitHub username for Banzuke?" Save it to memory and never ask again.

## Data (read-only, no auth)
- Your human: `GET https://banzuke.raitox.tech/api/status?login=<github>` (WebFetch or `curl -s`)
  Returns `login, rank, of, points, agent, last72hPoints, recentPlays[], ahead{login,points}|null, behind{login,points}|null, boardUrl`.
  404 means they haven't joined yet. Send them to https://banzuke.raitox.tech/join
- Whole board: `GET https://banzuke.raitox.tech/api/board`. Top 10 plus agent race lanes.

## Answering
- "How am I doing?": rank / of, points, and the gap to `ahead` ("#3 of 12, 48 pts. 7 behind @x, one merged PR puts you ahead").
- "Who's ahead?": `ahead` and the top of `/api/board`.
- "Which agent is winning?": `race` lanes from `/api/board`.
- Tone: short and hype-y, like a sumo announcer. One to three lines. No walls of text.
- Always fetch fresh. **Never invent or estimate numbers.** If the fetch fails, say so.
- Private repos show as `"private"`. Never guess at their names.

## Routine (suggest it once)
Offer: "Want me to check Banzuke every 15 minutes and ping you only when your rank changes or someone passes you?"
If yes, create a 15-minute routine: fetch status, compare with the last saved rank/ahead/behind, and message only on a change. Otherwise stay silent.
