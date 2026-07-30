---
name: judgement
description: The rules left standing after every rule a type, an API shape, or a gate could absorb was deleted from canon. Seventeen rules, each needing a view wider than one prop.
---

# Judgement

These are the rules no machine catches — not because they are subtle, but because each needs a
view wider than one prop's type can see. A discriminated union can forbid two props combining
wrongly on one element. Nothing in a type system can forbid a card where four individually correct
choices add up to a flood; only a person looking at the whole card can.

Grouped by **what you must look at**. Axis in brackets — full history in
[`references/axis-notes/`](../references/axis-notes/INDEX.md).

## Region — look at every element in the region at once

**One focal point per region.** Every colour and emphasis choice can pass its own decision tree in
isolation while the region still floods. Per-spot correctness proves nothing about the whole.
*CourseCard 2026-07-22: three green checks, a green −55% chip and a pink CTA — four to five
highlights in one card, every one individually correct.* [color · prominence — one rule, was
written twice]

**Centre only the region's single hero.** Whether a block is the one true focal point, or merely
the block you happen to be styling, is visible only from the whole region. [reading-flow]

**A near-uniform run of seams is a smell, not tidiness.** `24/12/24/24` fails to name any group,
and no single gap value shows it — only the sequence read together. [seam]

**A child's seam does not have to be smaller than its parent's.** Nothing requires seams to taper.
Each is an independent statement about a real relationship. [seam]

**Two composites side by side are not automatically a section.** One may be the caption of the
other, which makes them `grouped`. Relationship decides, not tier. [seam]

**Under skeleton, only content nodes shimmer.** The frame stays real — radius, background, shadow,
separator, gap. Telling frame from content requires reading this specific component's shape.
[skeleton]

## Row — compare every element on the row side by side

**Compare rendered silhouettes, not just size and weight.** Matching numbers can both be correct
while the shapes clash. *KeepGoingPath: a bare `PlayIcon` triangle beside two round icons broke the
row, with size and weight both right; fixed with `PlayCircleIcon`.* [icon]

**A pair with real hierarchy must differ by a step**, even when matching them would look more
symmetric. Peers may match; a hierarchy may not. Neither side's own prop reveals the other's role.
[prominence]

**Do not change a whole track's `justify` when one element needs pushing.** `justify-end`,
`justify-between` and `ml-auto` are indistinguishable at two elements and clearly different at
three — the wrong choice shows no symptom until a third arrives. [reading-flow]

## Content — read what will actually render

**Do not centre main content that will run to two lines or more.** Whether it wraps depends on the
real string, the real translation, the real viewport. The align prop's type knows none of them.
[reading-flow]

**Read what the children actually are before picking a frame.** `Stack` accepts free-form children,
so anything compiles regardless of whether the semantics call for `Cluster`, `Split` or `Grid`.
*21 call sites used `StackH` + `justify-between` instead of `Split`, then hand-wrote
`min-w-0`/`shrink-0` to recreate the shrink behaviour `Split` gives for free.* [frame]

**A button is what is drawn, not what has a handler.** A chip wrapped in `Popover.Trigger` is
clickable and is still a chip. *`PriceTag`'s −X% chip.* [prominence]

**An icon's colour comes from its meaning, not from a blanket "secondary icons are muted".**
*`SurfaceCard.leadingIcon` was locked to the label's colour, so a status checkmark rendered black
instead of green; fixed with a separate `leadingIconColor`.* [prominence]

**`wrap` is not a breakpoint.** It has no threshold, so whether it ever wraps depends on real
content widths at runtime. *Two screens shipped with two columns glued together at every width,
mobile included, and neither showed a defect until someone measured.* [frame · responsive — one
rule, was written twice]

**Keep a shimmer co-located with its component.** A centrally gathered skeleton drifts silently.
*A shared `Skeleton.*` compound drew a caret cell the real component had already dropped; nobody
noticed until someone looked.* [skeleton]

## Data — judged by the real shape or volume at runtime

**One info-type keeps one mechanism across every state; only the tone escalates.** *ContinueCard
2026-07-22: `timeLeft` was muted text normally and became a Chip when urgent. Correct is Chip
throughout, tone `neutral` to `warning`.* Seeing this requires comparing the same information
across states, which no single render shows. [prominence]

**Crowding is a record count, not a viewport width.** Count the real records before reaching for a
breakpoint — the fix is usually a different arrangement. [responsive]

## Red flags

| The sentence | Axis |
|---|---|
| "every individual value is correct" — and the region still floods | color · prominence |
| "an even vertical rhythm looks tidy" | seam |
| "the parent is `gap-3` so the child must be smaller" | seam |
| "two composites means a section" | seam |
| "draw a fake card shape for the skeleton" | skeleton |
| "size and weight are both correct" — and the row still breaks | icon |
| "give both sides accent for symmetry" | prominence |
| "it is clickable, so it is a button" | prominence |
| "a secondary icon is always muted" | prominence |
| "`StackH` + `justify-between` is enough, no need for `Split`" | frame |
| "it has `wrap`, mobile is handled" | frame · responsive |
| "two elements — `between` or `center` look the same" | reading-flow |
| "gather the skeletons in one place, easier to manage" | skeleton |
| "normal state is text, urgent state becomes a chip" | prominence |
| "it feels crowded, add a breakpoint" | responsive |

## What was here and moved

Five rules that read like judgement were **verification discipline** — do not treat a frame's
popularity as evidence, verify a pairing hypothesis against real usage, confirm nesting from the
real DOM, measure the longest real label before choosing a breakpoint, do not sweep a newly settled
rule without a concrete collision. They live in
[`references/house-rules.md`](../references/house-rules.md) §2.

Two more were **packageable**: `@container` sharing an element with padding, and a `title` field
whose tier depends on where it renders. Both are in
[`docs/API-BACKLOG.md`](../docs/API-BACKLOG.md).
