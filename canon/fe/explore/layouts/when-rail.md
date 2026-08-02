# WHEN to use a left RAIL (two-pane master-detail), and when not to

> The layout heuristic for the rail decision, sibling to `when-drawer`, gathering the scattered rail
> rules into one place. Drawn from the Mock Interview page on 2026-06-21: the interview mode had
> only TWO items (Flashcards / Mock interview) and still rendered a rail — **an empty rail is a
> void, and the layout reads as lopsided**. The quick question: *does this surface have ONE nav axis
> plus a list LONG ENOUGH to feed a rail?*

## The root rule — STRICT

- **DEFAULT is NO rail.** A centered single column (`max-w-3xl mx-auto`) is the default for EVERY
  page in the Learn area. **A rail is an exception that must be EARNED**, never the starting layout.
  The reason: the Learn area ALREADY has `LearnShell`'s icon sidebar for moving between surfaces, so
  a second rail is heavy and goes empty or lopsided the moment the content does not fill it. Settled
  2026-06-21: if you are touching a second rail and in doubt, REMOVE it.
- **A rail — the left nav column of a two-pane layout — is used ONLY when the surface has one nav
  axis AND one list of items long enough to browse**: the module-to-lesson tree, a deck list, a
  topic list, a category list. A rail is durable navigation or filtering over a rich set of items.
  There must be at least one REAL sub-list, long enough.
- **No list to feed it means no rail.** "Two or three mode toggles" is not a list, and putting it in
  a rail leaves the rail empty. This directly CORRECTS
  `rating-scale-row-and-page-internal-rail-layout` §2: two items are not enough to feed a rail.
- **The "earn the rail" test:** (1) is there a sub-list of roughly 5 items or more to browse?
  (2) does that list SURVIVE every state of the surface, rather than vanishing in one mode? Fail
  either one and there is NO rail.

## Inventory, measured 2026-06-21

| Surface | Rail? | Why |
|---|---|---|
| **Content map** (`/learn/content`, module-to-lesson tree) | Keep | a long, durable content tree |
| **Review — Flashcards** (deck list) | Keep | the deck list feeds it |
| **Review — Mock interview** | Drop | random across the whole course, NO list, so one column plus mode tabs |
| **Practice** (topic list) | Keep | the topic list feeds it (page-internal, standalone) |
| **Leaderboard** (category) | Keep | category nav, the rail acting as a filter |
| **Challenge solve · Mind map** | Drop | full-bleed, a focused surface |
| **A reading, setup or single-task form page** | Drop | centered single column |

## The decision table

| Situation | Layout | Source rule |
|---|---|---|
| One nav axis plus a **long list** (module/lesson, deck, topic, category) | **two panes: left rail plus right pane** | `rating-scale-row-and-page-internal-rail-layout` §2 · `master-detail-rail-as-filter-and-mobile-chips` |
| Nav of only **two or three modes**, no sub-list | **`TabsCard` or `SegmentedControl` at the top of the pane**, plus one column | `single-select-among-options-use-tabs` |
| A solve or focused single-job surface (challenge solve) | **full-bleed, course rail dropped** | [`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) |
| A canvas filling the viewport (mind map) | **full-bleed, no chrome** | [`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md) |
| One reading, setup or focused form column (one task) | **centered `max-w-3xl mx-auto`, no rail** | `three-tier-page-layout` |

## WHERE the rail goes, if there is one

- **A route inside `LearnShell`** → the rail is `LearnShell.leftRail`, at layout level, with its
  state in the **URL** (the rail and the pane are not in one component tree).
  See `learn-content-padding-shell-p6`.
- **A STANDALONE route**, with no shell → a page-internal two-pane layout (`ResizableRail`, and the
  content declares its own `p-6`). See `standalone-page-internal-rail-when-no-learnshell`.

## Mobile — STRICT

A left vertical rail suits only `lg+`. On a narrow screen the rail is `hidden lg:flex` and **folds
into a horizontally scrolling chip row** (mode chips plus topic chips) at the top of the pane,
reading the same URL state. See `master-detail-rail-as-filter-and-mobile-chips`.

## Common traps

- **A surface with two modes where one HAS a list and the other does not** — Review is the case:
  Flashcards has a deck list, Mock interview is random across the whole course and has none. **Do
  not force one layout on the whole surface.** The mode with a list gets the rail; the mode without
  gets one column plus tabs. Do not keep an empty rail in the list-less mode for the sake of
  consistency: an empty rail is worse than an asymmetric one.
- **Count the items BEFORE choosing a rail.** Fewer than roughly 4 nav items and no sub-list means
  certainly no rail.

## First applied 2026-06-21

The **Mock interview** page (`/learn/flashcards/interview`): the interview mode had only two items,
so the rail came out empty and lopsided. The rail was REMOVED on the interview route and the mode
switch moved into the pane (one centered column); **review KEPT its rail**, having a deck list.

Files: `learn/layout.tsx` (`isFlashcardInterview = isFlashcards && segments.includes("interview")`,
gating `leftRail` on `isFlashcards && !isFlashcardInterview`) · `Flashcards/index.tsx` (an in-pane
`SegmentedControl` mode switch, `hidden lg:block`, when `mode === "interview"`; mobile still uses
`FlashcardMobileNav`) · `InterviewSession` (the empty "Độ sẵn sàng" meter reflowed from
`flex-wrap items-center` to `flex-col gap-2`, moving the hint onto its own line). `tsc` and `eslint`
clean.

## Related

`when-drawer` (hiding the secondary behind a drawer) ·
`rating-scale-row-and-page-internal-rail-layout` (a rail is fed by a list) ·
`single-select-among-options-use-tabs` (few options become tabs) ·
`master-detail-rail-as-filter-and-mobile-chips` (rail as filter, and the mobile chips) ·
`standalone-page-internal-rail-when-no-learnshell` (rail at layout level versus page level) ·
[`solving-surface-fullbleed-no-course-rails.md`](solving-surface-fullbleed-no-course-rails.md) and
[`fullbleed-canvas-no-chrome-and-orient-zoom.md`](fullbleed-canvas-no-chrome-and-orient-zoom.md)
(full-bleed drops the rail) · `elements/sidebar` (the rail block).
