# Banzuke

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Builders join with GitHub and compete in an open agent race. Spectators read the live broadcast or the sampled public GitHub feed. QR visitors join on their phones.

## Product purpose

Banzuke scores shipped code and turns it into a live competition. The main board shows agent lanes, numbered builder rankings, individual plays, and scrolling commentary. Global ranks observed public GitHub activity and does not represent all activity on GitHub.

## Operating context

The user specifies edition #1J, JST time, a countdown to 18:00, and a large QR code for joining. The screen should be dark, clear, and carefully finished. Room-display use and phone access are inferred from the broadcast and QR requirements.

## Capabilities and constraints

The existing private repository is raitoxlol/banzuke. Its Next.js app uses Convex for reactive scores and GitHub authentication. Public and private work score points. Private work must appear as "a private repo" without exposing a repository name or summary. Preserve joining, scoring, ingestion, and other existing routes.

Main's broadcast design is the visual authority for the join and global pages. The main board has a top strip, an agent race, builder rankings, plays, and commentary. Issue #2 requires a guided six-step join flow: GitHub sign-in and public backfill, agent selection or quiz, optional private-repository installation, optional CLI setup, a real account connection check, and completion. Progress survives reloads. Integration completion comes from authenticated backend evidence.

The GitHub App is banzukeboard. The CLI lives in this private repository; browser sign-in does not grant access to its source. Installation instructions must state the access requirement. Synthetic activity is allowed only under explicit ?demo=1 and must be labeled.

The 18:00 deadline's reset behavior remains open. This session assumes the current JST day closes at 18:00 and the countdown holds at zero.

## Brand commitments

The name is Banzuke. Main's open race includes Claude Code, Codex, Cursor, Devin, OpenCode, Grok, Copilot, and human. Issue #2 keeps light sumo flavor through 番付 and real overtakes; ceremonial rank titles are omitted. Commentary describes actual plays.

## Evidence on hand

README.md, BRAND.md, GO-LIVE.md, lib/quiz.ts, lib/scoring.ts, lib/ingest.ts, and convex/room.ts describe the existing product. Demo mode already labels synthetic data. No commercial claims or invented customer metrics are needed.

The website defaults to Japanese; product names, GitHub identities, commands, and public API contracts retain their original forms.
