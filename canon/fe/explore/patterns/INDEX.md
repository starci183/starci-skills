# Front end — patterns

A layout is a shell. A pattern is **a whole recurring behaviour inside one**: what a browsable list is
made of, what a form does between the first keystroke and the success state, what a page shows while
it waits, where a surface lands when it is opened. Most of these were settled once against a real
screen that got it wrong, and the ruling is written with that case named — which is what lets a reader
tell whether their case is the same case.

Do not confuse this shelf with `principles/`. A principle states a test that applies everywhere; a
pattern states a shape that recurs and the anatomy it always has.

| File | Decides |
|---|---|
| [`every-surface-offers-a-path-onward.md`](every-surface-offers-a-path-onward.md) | that every surface carries at least one route back into the product's core loop, and that a layout is unfinished until the whole data-state matrix is designed, empty region included |
| [`form-flow.md`](form-flow.md) | the five steps of a multi-field form: validate, disable while invalid, submit, then a success state |
| [`home-does-not-duplicate-navigation.md`](home-does-not-duplicate-navigation.md) | that a home page does not repeat a surface the navigation already reaches, and that every piece of data has exactly one home |
| [`labeled-section-render-empty-not-self-hide.md`](labeled-section-render-empty-not-self-hide.md) | that a labelled section on a page the reader chose to open renders an empty state rather than removing itself |
| [`loading-feedback-three-tiers-splash-top-bar-skeleton.md`](loading-feedback-three-tiers-splash-top-bar-skeleton.md) | the three tiers of loading feedback kept apart — entry splash, navigation top bar, region skeleton — and which wait each one answers |
| [`loading-state-carries-no-artificial-hold.md`](loading-state-carries-no-artificial-hold.md) | that the async wrapper resolves error, loading, empty, content and nothing else: no hold timer, no minimum display duration, no debug switch that can ship |
| [`meter-tracks-out-of-box-default-target.md`](meter-tracks-out-of-box-default-target.md) | that a goal meter ships with a sensible default target so activity moves the bar immediately, because a meter waiting on configuration reads as broken |
| [`overlay-from-popover-render-in-panel.md`](overlay-from-popover-render-in-panel.md) | that a secondary overlay opened from inside a popover renders in-panel, because a body-level drawer or modal lands behind it and no hand-added z-index can win |
| [`progress-block-growing-quantity-headline-not-vanity-strip.md`](progress-block-growing-quantity-headline-not-vanity-strip.md) | that a progress block leads with one growing quantity as a meter rather than a strip of peer numbers that tell no story between them |
| [`search-filter-list-surface.md`](search-filter-list-surface.md) | the minimum anatomy of any browsable list — search, count, list, pager, in a fixed vertical order — for lists that need no tile or grid |
| [`selection-anchored-entry-and-intent-state.md`](selection-anchored-entry-and-intent-state.md) | the selection-anchored entry point scoped to the reading container, and intent state that survives the target surface mounting |
| [`setup-screen-tabs-for-history-stats.md`](setup-screen-tabs-for-history-stats.md) | that history and statistics for a session-based feature become tabs above the existing setup screen rather than a new route or shell |
| [`sibling-surfaces-share-chrome.md`](sibling-surfaces-share-chrome.md) | that surfaces holding the same role share one chrome — pick one as the reference and mirror it tier by tier, rather than arguing style |
| [`surface-lands-on-its-overview-no-auto-forward.md`](surface-lands-on-its-overview-no-auto-forward.md) | that a surface with an overview lands on the overview and never auto-forwards into an item, so the reader keeps their orientation and presses the primary action themselves |
| [`when-drawer.md`](when-drawer.md) | when a surface's secondary part is heavy enough to collapse behind a label with a caret that opens a drawer, leaving the primary part laid out directly |

## Reading order

There is none. Open the pattern the surface is about to grow.
[`search-filter-list-surface.md`](search-filter-list-surface.md) has a shell half on the other shelf —
[`layouts/catalog-grid.md`](../layouts/catalog-grid.md) is the same anatomy with the grid-and-line
toggle and the page around it. When a pattern and a principle appear to disagree, read the principle:
a pattern is one shape a principle takes, and a shape applied where its principle does not hold is the
usual way a screen goes wrong.
