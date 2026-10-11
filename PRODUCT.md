# Banzuke

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Builders join with GitHub and compete in stables. Spectators read the live broadcast. The user requests a screen that makes Claude Code against Codex the first thing people see.

## Product purpose

Banzuke scores shipped code and turns it into a live competition. The main board shows the two sides, sumo stable rankings, individual plays, and scrolling commentary.

## Operating context

The user specifies edition #1J, JST time, a countdown to 18:00, and a large QR code for joining. The screen should be dark, clear, and carefully finished. Room-display use and phone access are inferred from the broadcast and QR requirements.

## Capabilities and constraints

The existing private repository is raitoxlol/banzuke. Its Next.js app uses Convex for reactive scores and GitHub authentication. Public and private work score points. Private work must appear as "a private repo" without exposing a repository name or summary. Preserve joining, scoring, ingestion, and other existing routes.

The user's required layout has a top strip, a full-width tug-of-war bar, stable rankings on the left, plays on the right, and a bottom commentary ticker. The rope moves toward the leading side, and ranking rows animate when positions change.

The 18:00 deadline's reset behavior remains open. This session assumes the current JST day closes at 18:00 and the countdown holds at zero.

## Brand commitments

The name is Banzuke. The user requests a sumo banzuke with Yokozuna, Ozeki, and the following ranks. The scoreboard compares Claude Code and Codex. Commentary uses the existing short sports-broadcast voice and describes actual plays.

## Evidence on hand

README.md, BRAND.md, GO-LIVE.md, lib/quiz.ts, lib/scoring.ts, lib/ingest.ts, and convex/room.ts describe the existing product. Demo mode already labels synthetic data. No commercial claims or invented customer metrics are needed.
