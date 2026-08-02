# Front end — patterns

A layout is a shell. A pattern is **a whole recurring behaviour inside one**: what a browsable list is
made of, what a form does between the first keystroke and the success state, what a page shows while
it waits, where a surface lands when it is opened. Most of these were settled once against a real
screen that got it wrong, and the ruling is written with that case named — which is what lets a reader
tell whether their case is the same case.

Do not confuse this shelf with `principles/`. A principle states a test that applies
everywhere; a pattern states a shape that recurs and the anatomy it always has.

| File | Decides |
|---|---|
| [`search-filter-list-surface.md`](search-filter-list-surface.md) | the minimum anatomy of any browsable list — search, count, list, pager, in a fixed vertical order — for lists that need no tile or grid |
| [`form-flow.md`](form-flow.md) | the five steps of a multi-field form: validate, disable while invalid, submit, then a success state, through the shared react-hook-form hooks |
| [`when-drawer.md`](when-drawer.md) | when a surface's secondary part is heavy enough to collapse behind a label with a caret that opens a drawer, leaving the primary part laid out directly |
| [`overlay-from-popover-render-in-panel.md`](overlay-from-popover-render-in-panel.md) | that a secondary overlay opened from inside a popover renders in-panel, because a body-level drawer or modal lands behind it and no hand-added z-index can win |
| [`loading-feedback-three-tiers-splash-toploader-skeleton.md`](loading-feedback-three-tiers-splash-toploader-skeleton.md) | the three tiers of loading feedback kept apart — entry splash, navigation top bar, region skeleton — and which event each one answers |
| [`asynccontent-remove-debug-hold.md`](asynccontent-remove-debug-hold.md) | that `AsyncContent` has no `debug` prop and no artificial hold, leaving the priority chain and nothing else |
| [`labeled-section-render-empty-not-self-hide.md`](labeled-section-render-empty-not-self-hide.md) | that a labelled section on a page the user chose to open renders the house empty state rather than returning null |
| [`layout-must-funnel-to-courses-and-cover-full-data-state-matrix.md`](layout-must-funnel-to-courses-and-cover-full-data-state-matrix.md) | that every surface carries a route into a course and that a layout is only finished when the whole data-state matrix has been built, empty region included |
| [`surface-lands-on-dashboard-no-auto-forward.md`](surface-lands-on-dashboard-no-auto-forward.md) | that a surface with a dashboard lands on it and never auto-forwards into an item, so the learner keeps the where-am-I orientation and presses Continue themselves |
| [`setup-screen-tabs-for-history-stats.md`](setup-screen-tabs-for-history-stats.md) | that history and statistics for a session-based feature become tabs above the existing setup screen rather than a new route or shell |
| [`selection-anchored-entry-and-intent-state.md`](selection-anchored-entry-and-intent-state.md) | the selection-anchored entry point scoped to the reading container, and intent state that survives the target surface mounting |
| [`meter-tracks-out-of-box-default-target.md`](meter-tracks-out-of-box-default-target.md) | that a goal meter ships with a sensible default target so activity moves the bar immediately, because a meter waiting on configuration reads as broken |
| [`progress-block-growing-quantity-headline-not-vanity-strip.md`](progress-block-growing-quantity-headline-not-vanity-strip.md) | that a progress block leads with one growing quantity as a meter rather than a strip of peer numbers that tell no story between them |
| [`learn-home-surfaces-share-flat-chrome.md`](learn-home-surfaces-share-flat-chrome.md) | the one flat chrome every home or overview page in the Learn area shares, tier by tier, with the content dashboard as the reference |
| [`course-home-no-duplicate-surfaces.md`](course-home-no-duplicate-surfaces.md) | that a course home does not repeat a surface the sidebar already navigates to, and that every piece of data has exactly one home |

## Reading order

There is none. Open the pattern the surface is about to grow.
[`search-filter-list-surface.md`](search-filter-list-surface.md) has a shell half on the other shelf —
[`layouts/catalog-grid.md`](../layouts/catalog-grid.md) is the same anatomy with the grid-and-line
toggle and the page around it. When a pattern and a principle appear to
disagree, read the principle: a pattern is one shape a principle takes, and a shape applied where its
principle does not hold is the usual way a screen goes wrong.
