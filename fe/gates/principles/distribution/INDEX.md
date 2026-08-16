---
id: fe-principles-distribution-index
title: INDEX.md
slug: /gates/principles/distribution
sidebar_label: distribution
sidebar_position: 0
description: Binding rules for who grows, who shrinks and who holds still when one row divides its width.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `distribution`

## Law

A row has one width and more than one claim on it. Distribution is the decision of **who takes the
surplus, who gives way to the deficit, and who holds still through both**.

The space is divided among **participants**. A participant is a direct child of the distributing
parent, or a seam between two of them. Every participant answers the same two questions — what do
you do when there is space left over, and what do you do when there is not enough — and the pair of
answers is the code.

**When the two answers disagree, the deficit decides the code.** A child may take surplus and still
refuse the deficit; it is named by its refusal, because the refusal is the fact that breaks the row.
Surplus is a matter of appearance. Deficit is a matter of whether the row still holds its contents.

**This is binding, not advisory.** Any parent that lays its children along an axis — a flex row, a
flex column, a grid — gives every one of its participants a distribution situation, and that
situation has a code below. There is no row too small to have one: an icon beside a label is
`DIST-3` next to `DIST-1` for the same reason a fixed rail beside a result region is `DIST-5` next
to `DIST-1`. "It is only an icon and a label" is not an exemption — it is the row where the first
long name in production pushes the icon off the card.

## Situation Codes

The code names the SITUATION — one participant's role in dividing one axis of one parent. The
className column names what that situation emits, and one of the codes emits nothing.

| Code | Situation | className |
|---|---|---|
| `DIST-0` | The participant takes its natural size and nothing is declared about it | *no distribution class* |
| `DIST-1` | One child takes the whole surplus and absorbs the whole deficit | `min-w-0 flex-1` |
| `DIST-2` | Several children divide the axis between them in equal measure | `min-w-0 flex-1` on each · `grid-cols-<n>` |
| `DIST-3` | A child that must never shrink, whatever the row is asked to hold | `shrink-0` |
| `DIST-4` | A child that must be permitted to shrink, though it takes no surplus | `min-w-0` |
| `DIST-5` | A child that holds a measure decided by layout, not by its content | `w-64 shrink-0` · track `16rem` |
| `DIST-6` | No child takes the surplus; a chosen seam takes it | `ml-auto` · parent `justify-between` |

## The default is a behaviour, not an absence

`DIST-0` IS A SITUATION, NOT A BLANK. A flex child that declares nothing is not neutral: it already
refuses to grow, and it already agrees to shrink — but only down to the width of its own content,
and not one pixel further. That floor is invisible in every mockup and decisive in production.

The code exists because "nothing declared" is a case a reader must be able to recognise, cite and be
corrected against. A situation with no name is a situation nobody can be shown to have got wrong,
and this is the situation that is got wrong most often — not by choosing it, but by arriving at it.

## `min-w-0` is a permission, not a style

A flex child's minimum size is its content. Until that minimum is released, the child does not
shrink: it holds its full content width and pushes its sibling out of the row instead. Nothing
appears broken in the class list — the row simply stops being a row.

This is why `DIST-4` exists as a code of its own, and why `DIST-1` and `DIST-2` carry `min-w-0` in
their emission rather than leaving it to be remembered. **A truncation, a clamp or a scroll box
inside a row is inert until every link of the chain between the row and that element has been given
permission to shrink.** One `min-w-0` on the outer child does not release a nested child three
levels down.

On the block axis the same law reads `min-h-0`. A column that must scroll inside a bounded parent
grows past its ceiling until its minimum height is released, and then two scrollbars appear where
one was intended.

## A declared width does not hold

Writing a width on a flex child states a preference, not a rule. Flex shrinking is on by default, so
that child gives up its declared measure the moment the row is short — quietly, proportionally, and
without any sign that a number was ever written. `DIST-5` is therefore always two declarations: the
measure, and the refusal to give it up.

In a grid the same fact reads differently. A `1fr` track has an automatic minimum, so a track holding
long content refuses to shrink and stretches the grid past its container. `minmax(0,1fr)` is the
grid spelling of `min-w-0`, and it is required for the same reason.

## The seam is a participant

Free space that no child claims does not vanish; it collects somewhere. `DIST-6` is the decision to
put it in a chosen seam instead of inside a child — the difference between a title that stretches
and a title that stays its own width while the action moves to the far edge.

This module owns **who** receives the space. The sibling module `gap` owns the resting distance
between siblings. They meet only here: a seam given surplus by `DIST-6` is a gap that grew, not a
gap that was chosen larger.

## Inputs

| Input | Evidence required |
|---|---|
| parent | The immediate distributing parent: flex row, flex column, or grid |
| axis | Inline (width) or block (height); each axis is a separate situation |
| participants | Direct children, plus any seam that has been given a role |
| surplus rule | Which participant is entitled to space left over |
| deficit rule | Which participant gives way first, and which must never give way |
| measure source | Whether a size comes from content or from a layout decision |

## Invariants

- Every participant of a distributing parent resolves to exactly one code.
- Deficit behaviour decides the code; surplus behaviour never overrides it.
- Every row contains at least one participant able to absorb the deficit. A row of `DIST-3` and
  `DIST-5` only has declared, in advance, that it will overflow.
- At most one child is `DIST-1` per axis per parent. Two children claiming the whole surplus is
  `DIST-2` misspelled.
- `min-w-0` is required on every link of the chain from the row to the element that yields.
- A declared measure is always paired with a refusal to shrink.
- Empty elements are never used to push. Space is claimed by a seam, not by a spacer child.
- Percentage and fraction widths are not distribution declarations in a parent that also draws a
  seam: the seam is added on top of them and the row overruns.
- The code does not change with viewport. A narrower screen makes the deficit more likely, not
  different.
- Skeleton and loaded content carry the same code on the same participant.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **A grower that must never be cut.** A child that takes surplus but must keep its content intact
  is `DIST-3` carrying `grow`, not `DIST-1`. The deficit decides. Some other participant in that row
  must then be `DIST-1`, `DIST-2` or `DIST-4`, or the row has nobody to give way.
- **Equal share of the row versus equal share of the surplus.** `DIST-2` emits `flex-1` when the
  columns must end up equal to each other, and `grow` when each child keeps its content measure and
  only the leftover is split. Both are `DIST-2`; the discriminator is whether equality is between
  the columns or between the additions.
- **Numbers, prices, identifiers and controls are `DIST-3` even beside a `DIST-1` sibling.** A value
  the reader cannot verify once shortened is not allowed to be the participant that gives way.
- **A single child is not a distribution situation.** One child in a row divides nothing; give it a
  code only when a second participant exists.
- **Two codes both match.** Prefer the code that declares less: `DIST-0` over `DIST-3` when nothing
  in the row can push, `DIST-4` over `DIST-1` when the child must yield but was never meant to fill.
  Ask one discriminating question only when the requester states that the larger role is required.
- **Responsive.** A participant changes code only when the parent it belongs to changes — a rail
  that becomes a stacked block above the content is a different parent, not the same rail behaving
  differently.

## Output

```text
parent: <flex row | flex column | grid>
axis: <inline | block>
participant: <the child, or the seam>
surplus: <takes all | equal share | none | into the seam>
deficit: <absorbs | refuses | content floor>
situation: <DIST-0 | DIST-1 | DIST-2 | DIST-3 | DIST-4 | DIST-5 | DIST-6>
className: <no class | min-w-0 flex-1 | shrink-0 | min-w-0 | w-* shrink-0 | ml-auto>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module governs one axis of one distributing parent: flex or grid. A block parent whose children
already occupy the full measure divides nothing and has no situation here. What happens to the
content *inside* a participant once it has yielded — cut, wrapped, clamped or scrolled — belongs to
`overflow`; this module decides only whether yielding is permitted at all.

It states a rule true of any front end. It names no product, no component library, no registry key
and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
