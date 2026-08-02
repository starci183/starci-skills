# Separate sections with whitespace, not dividers; cut the redundant count — STRICT

Read from feedback on the "Trên trang này" rail (2026-06-24): the `Separator` between blocks came
out and `gap-6` did the separating.

## The rules

**Sections in a vertical rail or stack are separated by WHITESPACE (`gap-6`), not by a `Separator` or
divider.** Several blocks stacked vertically — in the rail: outline, actions, review, practice — are
already separated by the gap; adding a rule between each pair is noise and weight, and turns the
column into a set of boxes. Drop the `<Separator/>` that opens each block.

**A divider is only used when** (a) it is INSIDE one bounded block, dividing sub-rows — the inset
separator of a List Card or an accordion, which is part of the block's own skin; or (b) two regions
are flush against each other and genuinely cannot be separated by a gap, which is rare. A divider is
never used to separate two sections that a gap already separates.

**Cut the total-count line when the list already shows its items.** A count under a list that has
just enumerated everything ("N thử thách", "N bộ · M thẻ") is vanity and repetition — the eye has
already counted. Keep a count only where the list does NOT show its items, such as a collapsed group
showing "n/m".

## The principle behind both

Before adding a rule or a meta line, ask whether the whitespace has already separated it and whether
the list has already stated the number. If it has, do not add it. Minimum visual weight: separate
with gap, count with the list itself.

## First applied 2026-06-24

The `OnThisPage` rail: its sections were already on `gap-6`, so the `Separator` opening
`LessonChallenges` and `LessonFlashcards` was removed, along with their count lines ("2 thử thách",
"N bộ thẻ"). Both moved to the `LabeledList` block. The surrounding spacing scale is `gap-6` between
large clusters, `gap-3` inside a block, `gap-2` between items.
