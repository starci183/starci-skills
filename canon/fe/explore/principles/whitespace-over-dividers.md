# Separate sections with whitespace, not dividers; cut the redundant count — STRICT

## The rules

**Sections in a vertical rail or stack are separated by WHITESPACE (`gap-6`), not by a divider.**
Several blocks stacked in a column are already separated by the gap — Gestalt proximity does the
grouping before any line is drawn — so adding a rule between each pair is noise and weight, and turns
a calm column into a set of boxes. Refactoring UI's phrasing is the shortest version: not every
border needs to be a line. Drop the divider that opens each block.

**A divider is only used when** (a) it is INSIDE one bounded block, dividing sub-rows — the inset
separator between the rows of a list card or an accordion, which is part of that block's own skin; or
(b) two regions are flush against each other and genuinely cannot be separated by a gap, which is
rare and usually means the layout wanted a gap and was not given room for one. A divider is never
used to separate two sections that a gap already separates.

**Cut the total-count line when the list already shows its items.** A count under a list that has
just enumerated everything is vanity and repetition — the eye has already counted, and the number is
one more thing that can go stale. Keep a count only where the list does NOT show its items: a
collapsed group showing "3 of 12", a filter chip, a tab label.

## The principle behind both

Before adding a rule or a meta line, ask whether the whitespace has already separated it and whether
the list has already stated the number. If it has, do not add it. Minimum visual weight: separate
with a gap, count with the list itself.

An example worth copying is the "on this page" rail of a documentation reader: outline, actions and
related links sit on one `gap-6` column with no lines between them and no counts under them, and it
reads as three quiet groups rather than three framed widgets. The spacing scale that makes this work
is one decision, applied consistently — `gap-6` between large clusters, `gap-3` inside a block,
`gap-2` between items. Whitespace can only carry the separation if the steps are far enough apart to
be read as different.
