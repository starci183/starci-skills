# A progress meter runs out of the box, on a default target — STRICT

> Read from the "Mục tiêu tuần" block sitting at zero on 2026-06-25 for a learner who had in fact
> been studying, because no target had been configured.

## The rule

A meter measuring **progress toward a goal** — a weekly goal, a KPI, a quota — must not sit empty
just because the user has never set a target. Give it a sensible **default target** so that any
activity moves the bar immediately; the user can still override it through the Edit button. A meter
waiting on configuration reads as broken: *"if I studied, the progress should move, shouldn't it?"*

## Three parts, one effective target

`current` is real activity and rises as the feature is used. `target` is the custom value or the
default. `percent` is `current / target`. Use one **`effectiveTarget = custom ?? default`** for the
bar, for the `current/target` display and for the summary, so the three can never disagree.

## Where the default belongs

The back end is the right place, because the editor then shows the same number the meter used. A
front-end-only default is acceptable as a stopgap, but the editor will read blank until the user
sets a value — record that as a debt to reconcile.

## Render the bar as a plain div

`bg-default` for the track, `bg-accent` for the fill with `width` as a percentage. It always
renders. A compound component can lose its styling depending on the context it is dropped into, and
a progress bar is the wrong place to find that out.

## Two kinds of meter, one shared obligation

This one has a **target** and needs a number to aim at. The other kind measures a **quantity that
grows** — mastery, where the denominator is natural (total cards). Either way, no meter is left
meaningless or blank; there is always a denominator to fill against.

## First applied 2026-06-25

`WeeklyGoals` gained `DEFAULT_KPI_TARGETS` — lessons 5, studyDays 5, challenges 3, coding 3,
flashcards 20 — with the effective target feeding the bar, the display and the summary, so studying
moves the bar. The heatmap losing its colour in the same block was a token bug, not a reason to
redesign the block.

## Related

`progress-block-growing-quantity-headline-not-vanity-strip.md` — the growing-quantity meter and why
a stat strip is not progress.
