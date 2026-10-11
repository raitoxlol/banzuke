---
name: Banzuke room broadcast
description: A dark sumo broadcast for Claude Code versus Codex.
colors:
  bg: "#171f1b"
  surface-1: "#1e2922"
  surface-2: "#26342b"
  border: "#3c4a40"
  fg: "#f1efe7"
  muted: "#b1b9ae"
  claude: "#dda36a"
  codex: "#a7c7b5"
  live: "#e15f54"
  qr-ink: "#1B2521"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "80px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  display-wide:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  display-short:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "68px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.02em"
  display-phone:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Barlow, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  side-title:
    fontFamily: "Barlow, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.1
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  label-small:
    fontFamily: "Barlow, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  clock:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1
  rank-score:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1
  play-score:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
  japanese-rank:
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Serif CJK JP", serif'
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.1
  join-control:
    fontFamily: "Barlow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
  feed-control:
    fontFamily: "Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "normal"
rounded:
  square: "0"
  control: "4px"
  panel: "10px"
  round: "50%"
spacing:
  tight: "4px"
  compact: "8px"
  small: "12px"
  phone: "14px"
  standard: "16px"
  panel: "20px"
  large: "24px"
  desktop-inline: "28px"
  wide-inline: "40px"
components:
  join-mobile:
    backgroundColor: "{colors.codex}"
    textColor: "{colors.bg}"
    typography: "{typography.join-control}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
  join-mobile-hover:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
  button-feed-pause:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.feed-control}"
    rounded: "{rounded.control}"
    padding: "8px 0 8px 8px"
  button-feed-pause-hover:
    textColor: "{colors.fg}"
  button-ticker-pause:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "10px"
    width: "36px"
    height: "36px"
  button-ticker-pause-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
  filter:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
  filter-selected:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
  filter-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
  navigation-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "5px 10px"
  navigation-link-selected:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
  broadcast-panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.fg}"
    rounded: "{rounded.panel}"
    padding: "0 20px"
  qr:
    backgroundColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "4px"
    width: "112px"
    height: "112px"
  rope:
    rounded: "{rounded.control}"
    height: "24px"
  rope-marker:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.round}"
    width: "40px"
    height: "40px"
  commentary:
    textColor: "{colors.fg}"
    height: "48px"
---

# Design System: Banzuke room broadcast

## Overview

**Creative North Star: "Sumo room broadcast"**

Banzuke presents a code competition through the ordered ranks of a sumo banzuke and the legible numbers of a sports broadcast. Pine charcoal grounds, ivory text, and stable side colors keep the match readable. Condensed scores carry the largest weight; thin rules and compact controls support them without adding another visual event.

This system governs the room board at `app/page.tsx` and its broadcast component variants. Other routes and the standalone tug variant retain their existing legacy theme. Extend the room's color, type, state, and alignment rules when adding room features. Its current header, full-width match, ranking/feed split, and closing ticker are a page composition recorded in `.impeccable/surfaces/app-page-tsx.md`, not a required template for every new screen.

**Key Characteristics:**

- Large condensed scores with tabular numerals.
- Japanese Mincho ranks paired with plain Barlow UI text.
- Ochre Claude identity and sage Codex identity across data views.
- Flat fields, fine boundaries, and motion tied to changing data.
- Truthful LIVE/DEMO status and visible access to joining.

Source authority is `app/globals.css`, `app/layout.tsx`, `components/RoomBoard.tsx`, `TugOfWar.tsx`, `Ticker.tsx`, `Qr.tsx`, `JoinCta.tsx`, and the live adapter. The finish verdict cleared the corrected room ground and document overflow in desktop, laptop, and phone captures. No shipping raster belongs to this system.

## Colors

The room uses warm ivory on dark pine neutrals, with two pale side colors and a single live-status red. The frontmatter contains the source color values.

### Primary

- **Claude ochre, `claude`.** Claude Code headings, stable names, play dots, play points, the left rope half, and the Claude axis label.

### Secondary

- **Codex sage, `codex`.** The corresponding Codex data on the right, the signed-out phone joining action, the selected-filter underline, and text selection.

### Tertiary

- **Live red, `live`.** The live-status dot. DEMO uses the muted neutral dot and label instead.

### Neutral

- **Pine charcoal, `bg`.** The opaque room ground and the dark foreground on light controls.
- **Panel pine, `surface-1`.** Match, rankings, and feed fields.
- **Selected pine, `surface-2`.** Selected navigation/filter backgrounds and ticker-control hover.
- **Boundary pine, `border`.** Panel edges, row rules, ticker rules, and the feed scrollbar thumb.
- **Ivory, `fg`.** Primary text, focus outlines, the rope marker, and QR paper.
- **Sage gray, `muted`.** Secondary labels, ages, builder counts, inactive controls, and DEMO status.
- **QR ink, `qr-ink`.** The dark modules of the generated joining code.

**The Side identity Rule.** Keep Claude and Codex colors consistent across match totals, ranks, plays, and rope labels. Pair color with the side's name or accessible text.

**The Status truth Rule.** Use live red for an actual LIVE state. Synthetic data carries DEMO and Demo plays.

Selection uses the Codex fill and room ground text. The feed uses a thin scrollbar with the boundary thumb on panel pine. Links keep inherited color and an underline offset of 4px; hover underlines identify the QR action and play-point links.

## Typography

**Display Font:** Barlow Condensed, with sans-serif fallback.

**Body Font:** Barlow, with sans-serif fallback.

**Japanese Font:** Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, Noto Serif CJK JP, then serif. These are fallback choices; the app does not load a Japanese webfont.

**Character:** Barlow Condensed gives the scores and wordmark their narrow broadcast proportions. Barlow keeps controls and play descriptions readable. Mincho letterforms identify the sumo ranking order without making all UI text ceremonial.

### Hierarchy

- **Display.** The `display` family of tokens governs opposing match totals. Use its wide, short-desktop, and phone variants at the recorded breakpoints.
- **Headline.** The `headline` token governs the uppercase wordmark. The adjacent edition is smaller and muted.
- **Title.** The `title` token governs panel headings; `side-title` governs the competing side names.
- **Body.** The `body` token establishes room text. Play names use the same size with semibold emphasis; commentary is slightly larger at 17px. The central lead statement is limited to 22ch.
- **Label.** The `label` and `label-small` tokens govern supporting UI text, play kinds, ages, and axis labels. Uppercase is used for the wordmark, LIVE/DEMO, and VS, not forced across all labels.
- **Numbers.** `clock`, `rank-score`, and `play-score` use the display family with semibold weight. Room numbers use tabular figures; the room's numeric utility uses the display family rather than the legacy monospace family.
- **Ranks.** `japanese-rank` governs the Japanese rank name. The English rank sits below in small muted Barlow.

**The Numeric alignment Rule.** Keep changing numbers tabular and right-align ranking and play values. Large match totals use condensed type, while their labels use Barlow.

## Layout

The room has no fixed maximum width. It fills the available width, gives flexible children a zero minimum width, and lets long names and repository labels truncate inside their own columns. Reuse that containment rule when adding data columns. The spacing vocabulary is compact: tight internal gaps, standard grouping gaps, and larger outer margins.

The current broadcast is a viewport grid above the stacked breakpoint. Its room-only rows are a 112px header, 190px match, flexible middle, and 48px ticker. Outer padding is 20px vertically and 28px horizontally, with 16px row gaps. The middle's 56/44 ranking/feed ratio and 20px gap belong to this page. Rankings and feed use the shared panel token, a 54px heading row, and a bounded content area. Six ranking rows divide the available list height equally; the default list minimum is 312px.

| Condition | Implemented room adjustment |
| --- | --- |
| Width at least 1800px | Outer padding becomes 24px by 40px, gaps become 20px, and header/match/ticker rows become 120/216/54px. Use `display-wide`; wordmark becomes 60px, stable names 23px, stable scores 40px, Japanese ranks 28px, play names 18px, and play labels 15px. |
| Width at most 1180px | Horizontal padding becomes 20px; header and middle gaps become 20px and 16px. The room label disappears. Wordmark becomes 44px, clocks 29px, and stable names 17px. Panel padding becomes 16px; ranking columns use 90px, flexible content, and score, with 12px gaps. |
| Width at least 901px and height at most 850px | Minimum board height becomes 800px, vertical padding 16px, gaps 12px, and match height 176px. Use `display-short`. Side names become 24px; heading and ranking-list minimums become 48px and 288px. |
| Width at most 900px | The board grows with document content, has a 100svh minimum, and uses 16px outer padding. Rankings and feed stack. QR remains beside the identity and clocks. Panel padding becomes 18px; ranking list height is 348px. The feed panel has a 460px minimum and its scroll area a 440px maximum. |
| Width at most 520px | Outer padding and row gaps become 14px; panel padding becomes 12px. Use `display-phone`; wordmark becomes 38px, clocks 25px, and side names 18px. The match's middle column becomes 82px with 8px gaps. Ranking columns become 77px, flexible content, and score with 9px gaps. Stable names become 16px, scores 30px, and Japanese ranks 21px. Point-unit suffixes and the middle axis caption disappear; the footer can wrap. |

The height query can overlap the wide query and wins for the match dimensions and score size. The stacked and phone queries appear later and replace their affected properties. On a signed-out live board at the stacked breakpoint, the join action sits in the existing header row with an 8px gap; the already-selected Room link is hidden only while that action exists.

Reduced-motion mode allows the ticker row to grow with wrapping text. It retains the current 190px match row, or the short desktop's 176px row. The verified desktop and laptop documents end at the viewport on the room ground. The phone document scrolls naturally through the complete broadcast; no empty legacy-colored tail is a room layout rule.

## Elevation & Depth

The room uses flat tonal fields and thin borders. It has no outer panel, QR, or control shadows. Panel pine distinguishes content from the ground; selected pine distinguishes control state. The selected filter's inset bottom line is the only room box-shadow treatment, and it marks selection rather than elevation.

### Shadow Vocabulary

- **Selected filter line.** `inset 0 -2px var(--codex)` supplies the selected filter's sage underline.

**The Flat fields Rule.** Use tonal contrast and rules for room grouping. Keep selected-state marks separate from structural depth.

## Shapes

Panels use the `panel` radius. Controls, navigation links, and the QR paper use the smaller `control` radius. The full-width match field has square corners and top/bottom boundaries. The rope halves curve only at their outside ends. The rope marker and status/play dots are circles; these are data and status shapes, not a general pill-container style.

Panel and row boundaries are 1px. The rope is 24px tall, with a 40px ivory marker and a 4px panel-colored border. The midpoint is an ivory 1px line at reduced opacity. Small live and play dots are 8px and 6px respectively. The progress line under each ranking row is 2px high.

## Components

### Buttons

Room controls are compact and explicit. The feed pause action is transparent with muted text and a small authored SVG pause/play mark. Hover changes the text to ivory. Its pressed state changes the label to Resume feed and freezes both feed entries and displayed ages; match scores and rankings continue to update. Filters can still change the paused subset.

The ticker pause button is a square icon control using the frontmatter token. Hover adds selected pine and ivory. Its pressed state switches the SVG to play and changes its accessible label to Resume commentary. There is no separate visual active-press transform or transition in these controls.

All room links and buttons receive a 2px ivory focus-visible outline with a 4px offset. Keep that shared focus treatment when adding controls.

### Filters

All, Claude, and Codex form one compact button group. The source uses medium-weight Barlow and a 4px group gap. Hover uses selected pine and ivory; the selected button also gets the sage inset line. Selection is exposed with `aria-pressed`. Phone filter padding becomes 6px by 11px.

### Cards / Containers

Rankings and latest plays share the `broadcast-panel` token, a fine boundary, and clipped corners. Their horizontal padding follows the recorded breakpoints. These are continuous data panels; they do not divide every row into a separate card. Empty feed text uses muted body text at 15px with 1.5 line height.

### Navigation

Room and Global firehose are inline header links. The selected link uses selected pine and ivory with no shadow; the inactive link uses muted text. Hover changes text to ivory. Phone navigation uses 12px type and 5px by 7px padding. The signed-out live join action follows the presence rule in Layout. Demo mode does not inject that authenticated-state action.

### Joining access

The QR action is a complete link to `/join`, with a 112px ivory code square and 4px padding. The generated SVG uses QR ink and ivory with a four-module margin. Its caption is a semibold joining label plus muted GitHub instructions; hover underlines the joining label. At the stacked breakpoint the QR is above its caption and the secondary instructions disappear. The separate sage join action appears only after the live auth state resolves as signed out, and only at widths at most 900px. It shares the room focus rule and changes its fill to ivory on hover.

### Stable ranking row

Japanese rank and English translation form the left column. Side-colored stable name and muted builder information occupy the flexible column; the score aligns right. Thin rules and an understated side-colored score track keep the rows tabular. Names truncate inside the flexible column.

The six rows use stable IDs as React keys and positional transforms for ordering. Reordering transitions over 800ms with `cubic-bezier(.16,1,.3,1)`; the score track changes width over 900ms with the same curve. Track width is the stable's score divided by the leading stable's score, or zero when the leading score is zero.

### Latest play row

A small side dot, readable author and kind, repository label, side-colored points link, and right-aligned age form each row. The source displays up to nine filtered entries and keeps the feed vertically scrollable with its themed thin scrollbar. Play-point hover adds an underline and the link opens the scoring explanation. Private work always displays `a private repo`; visual truncation must not reveal the underlying private name or summary.

### Tug-of-war

Opposing scores use the `display` role and a short side-colored lead statement around a modest VS. The rope's fixed colored halves explain side identity. Its marker position is Codex points divided by combined points, as a percentage; zero combined points place it at the center. The marker moves right for a Codex lead and left for a Claude Code lead.

The marker slides over 1200ms with `cubic-bezier(.16,1,.3,1)`. Changed scores count for 900ms using cubic ease-out. A newly scored side has a 1200ms opacity flash; a change between non-tied leaders shows Lead changes for 2500ms. Equal scores show An even match; no scores show The match starts with you. Reduced motion shows final values and positions immediately and suppresses flashes and lead-change notices.

### Commentary

The ticker is a ruled strip, not a raised card. A plain Commentary label, clipped text window, and pause control form the component. Two copies of the same line move continuously over 32 seconds with linear timing; each copy has 80px trailing space. A new line waits until the loop boundary before replacing the moving line.

Pointer hover, focus within, and the explicit pause button each hold playback. The current text freezes while any pause reason remains. Leaving hover/focus preserves an explicit button pause; resuming follows the current commentary. Accessible text contains one copy. Reduced motion disables room animation and transitions, removes the duplicate line, and lets the current commentary wrap without scrolling. The LIVE dot's two-second opacity pulse also stops.

## Do's and Don'ts

### Do:

- **Do** preserve side identity in text, marks, and numeric data.
- **Do** use condensed tabular numbers for changing room scores and clocks.
- **Do** pair Japanese ranks with readable English translations.
- **Do** preserve visible focus, selected controls, and the feed's scroll access.
- **Do** keep private work labeled `a private repo` in both plays and commentary.
- **Do** provide current values and complete wrapping commentary when motion is reduced.

### Don't:

- **Don't** label synthetic demo data LIVE.
- **Don't** introduce another accent for the existing Claude or Codex identity.
- **Don't** add texture, bevels, hard offset shadows, or gradient lettering to the flat room broadcast.
- **Don't** turn the current room page composition into a template for unrelated routes.
- **Don't** treat the legacy root palette, legacy type, or legacy glow effects as room tokens.

No room craft-floor defect is canonized here. The legacy routes remain outside this extraction. The current-day 18:00 JST countdown holds at zero; its future reset behavior remains a product decision. The finish review verifies the ground fix at the three captured sizes, not completed live GitHub authentication or every possible viewport.
