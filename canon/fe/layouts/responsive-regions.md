# Regions that CHANGE with the screen — responsive and adaptive

> A region changes how it is arranged with the viewport. The distinction
> ([supercharge.design](https://supercharge.design/articles/adaptive-layout-vs-responsive-layout)):
> **responsive** is fluid within ONE shape (max-width, flex-wrap); **adaptive** CHANGES the shape or
> shell at a breakpoint (rail becomes chips, two panes become a stack). This codebase uses both,
> plus adaptive-by-task ([`surface-job-drives-layout.md`](surface-job-drives-layout.md)).

## Adaptive rules — STRICT

- **A vertical rail exists only at `lg+`.** On a narrow screen it FOLDS into a horizontally
  scrolling CHIP row at the top of the pane, reading the same URL state: `hidden lg:flex` on the
  rail, `flex lg:hidden overflow-x-auto` on the chip row. Grounded in `LearnMobileTabBar`,
  `LearnMobileBar` and `useSmViewpoint`.
- **The mobile nav bar of `/learn/**` is ALWAYS at the FOOTER (`fixed bottom-0`), never at the top —
  settled 2026-07-09.** `LearnShell` picks one of two components depending on whether the page has a
  suitable `leftRail`: `LearnMobileTabBar` for a reader page, where the content map and the
  on-this-page rail fold into three tabs (contents / lesson / on this page), and `LearnMobileBar`
  for every page without such a rail — mock interview, flashcards, mind map, leaderboard,
  foundations — which is a single button opening the course-menu drawer.

  The two components differ in CONTENT, which is correct: a reader needs three views, other pages
  need one drawer. They must NOT differ in POSITION. `LearnMobileBar` used to be `sticky top-16`,
  below the navbar, while `LearnMobileTabBar` was `fixed bottom-0`, so every rail-less page (Mock
  Interview, Flashcards) looked as though it had LOST its mobile nav entirely next to a Content
  page — all that remained was a faint line of links at the top.

  The fix: `LearnMobileBar` moved from `sticky top-16 border-b` to
  `fixed inset-x-0 bottom-0 h-16 border-t`, matching `LearnMobileTabBar`'s position and height
  exactly; and `LearnShell`'s `max-lg:pb-16`, which reserves the space so content is not covered,
  changed from applying only when `useTabBar` to applying ALWAYS, since both bars are now
  fixed-bottom.
- **Two panes STACK on mobile** (`flex-col lg:grid`): context on top, workspace or detail below as a
  tab strip or collapsible ([`full-bleed-work-surface.md`](full-bleed-work-surface.md)).
- **Reposition and reflow** (Material, Fluent): a vertical card becomes horizontal, a FAB becomes a
  nav rail as width allows. Use it when there is room; do not cram.
- **Swap the overlay by modality:** on desktop a Drawer or Modal beside the content, on mobile a
  bottom sheet (`placement="bottom"` with `useSmViewpoint`) — `when-drawer`.

## Responsive — fluid, same shape

- Container `max-w-*` with `mx-auto`; flex-wrap for chips and buttons; `min-w-0` along a flex chain
  so it can actually shrink.
- **A block WIDER than the column SCROLLS (`overflow-x-auto`) instead of breaking the layout** —
  mermaid, tables, code: `foundations/wide-content-scrolls-not-blocks-ui`.
- Against scrollbar jitter: `foundations/scrollbar-gutter`.

## Gotchas

- A left vertical rail does not suit mobile, so there must ALWAYS be a chip-row branch. A rail left
  `hidden` with nothing in its place means the nav is simply gone.
- Changing shape at a breakpoint must keep ONE source of state, the URL. Never two states, one for
  desktop and one for mobile.

## Related

[`region-model.md`](region-model.md) ·
[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`full-bleed-work-surface.md`](full-bleed-work-surface.md) · `when-drawer` ·
`foundations/breakpoints` · `foundations/wide-content-scrolls-not-blocks-ui` ·
`foundations/scrollbar-gutter` · `components/sidebar` (the mobile fold).
