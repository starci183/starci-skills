---
id: fe-principles-responsive-index
title: INDEX.md
slug: /gates/principles/responsive
sidebar_label: responsive
sidebar_position: 0
description: Binding rules for choosing a responsive className from the observed content failure.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `responsive`

## Law

A layout changes geometry at the first point its content fails, and it changes by the smallest
transformation that repairs that failure. Choose the transformation from the observed failure, never
from a screen name, a device photograph or a wish for the layout to "look more mobile".

The component that owns the geometry owns the responsive classes. Callers do not reach in and patch
a child's breakpoints, because a breakpoint written from outside is a breakpoint written without the
measurement that justifies it.

Across every width the render keeps **one** source order, **one** reading order, **one** focus order
and **one** set of reachable tasks. Responsive changes where things sit. It does not change what the
screen is for, what it says, or what a person can do on it.

**This is binding, not advisory.** Every rendered region falls under exactly one code below,
including the regions that need no class at all — those are `RESPONSIVE-1`, and `RESPONSIVE-1` is a
decision that must be defensible, not a place where the rule was skipped. There is no composition too
small to have a responsive situation: a two-button action row has one for the same reason a page
shell with a filter rail has one. "It is only a couple of buttons" is the most common place this law
gets dropped.

## Situation Codes

Every situation this module governs carries a code, `RESPONSIVE-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and one
of them emits nothing.

The codes are ordered by how invasive the repair is, which is also the order a reader meets them: a
reader first asks whether anything is broken, then reaches for the cheapest repair and stops at the
first one that works.

| Code | Situation | className |
|---|---|---|
| `RESPONSIVE-1` | Nothing fails at any supported width; the base layout already holds | *no responsive class* |
| `RESPONSIVE-2` | Inline peers still belong on one run but need more than one line | `flex flex-wrap` |
| `RESPONSIVE-3` | A row stops being usable, and the same participants in the same order work as a vertical sequence | `flex flex-col sm:flex-row` at the tested threshold |
| `RESPONSIVE-4` | Repeated peer items need fewer tracks as width falls | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` at tested thresholds |
| `RESPONSIVE-5` | Content whose meaning IS its horizontal arrangement cannot reflow at all | owner `max-w-full overflow-x-auto`; child `min-w-max` |
| `RESPONSIVE-6` | A persistent region becomes an equivalent, reachable compact control | paired `hidden md:block` and `md:hidden`, one state, one focus path |

`RESPONSIVE-1` IS A SITUATION, NOT A TRANSFORMATION. It emits no class, and it must not be expressed
by writing a breakpoint that restates the base — `sm:flex-row` on something that is already a row,
`lg:grid-cols-3` on a grid already at three, `md:block` on a visible block. Those claim a width
mattered when no width mattered. The code exists because "nothing fails here" is a case a reader must
be able to recognise, cite and be corrected against; a situation with no name is a situation nobody
can be shown to have got wrong.

The breakpoint prefixes in the table (`sm:`, `md:`, `lg:`) are placeholders for a MEASURED threshold,
not part of the answer. The prefix that ships is the one at which the content was observed to stop
working. A prefix chosen because a device is called a tablet is a fabricated number wearing a
utility class.

## Inputs

| Input | Evidence required |
|---|---|
| owner | The single component that owns the changing geometry |
| participants | The direct children whose arrangement changes |
| failure | `none`, `wrap-needed`, `row-unusable`, `tracks-too-narrow`, `horizontal-meaning`, `region-to-control` |
| minimum usable width | A measured or tested threshold per participant, not a device width |
| essential | Whether the content or task is required for the page's purpose |
| alternate path | `none`, or one named control that reaches the same task with the same state |
| states | That loading, empty, error and ready are the same owner |

Anything absent from this list is not admissible as a reason. Aesthetic density, a screenshot of a
phone, and the sentence "it feels cramped" select nothing.

## Invariants

1. Base classes describe the narrowest supported state; every breakpoint is a min-width override
   added on top. There is no max-width thinking in this module.
2. A breakpoint marks a content failure. It never marks a device.
3. One DOM order, one reading order, one focus order, at every width. Responsive `order-*` is
   forbidden: it tells a second story the DOM does not tell, and screen readers and keyboards only
   ever get the first one.
4. Changing axis does not change gap, padding, hierarchy or meaning. A stack and a row of the same
   participants carry the same relationship, so they carry the same seam.
5. The geometry owner writes the responsive classes. Callers do not patch a child's internals.
6. Essential content is never hidden. Paired visibility is admissible only with an equivalent
   reachable path, shared state and a defined focus return.
7. Wrap or stack before shrinking anything. Text, hit targets and controls are never reduced below
   their usable size in order to preserve a line.
8. Loading, empty, error and ready use the same owner, the same tracks and the same anchors. A
   network state is not a layout.
9. A situation code maps to exactly one transformation, and no transformation serves two codes.
10. Every rendered region resolves to exactly one code. No region is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies to.

- **No observed failure.** Without a collision, a clip or a demonstrated usability failure, the answer
  is `RESPONSIVE-1`: keep the base layout and add nothing. "Make it responsive" is not evidence.
- **No declared minimum item width.** Do not invent a grid threshold. `RESPONSIVE-4` without a tested
  minimum falls back to one column, which is the only track count that cannot be wrong.
- **Reflow not proven destructive.** `RESPONSIVE-5` requires proof that a new axis destroys the
  relationship. Where wrap or stack preserves meaning, `RESPONSIVE-2` or `RESPONSIVE-3` wins; bounded
  overflow is the last resort, not the convenient one.
- **No equivalent path.** Without one named control that reaches the same task with the same state,
  `RESPONSIVE-6` is refused and the content stays visible.
- **Overflowing text before overflowing layout.** A long title is repaired inside its own box first —
  `min-w-0`, wrapping, or truncation that keeps the full accessible value — before any code above
  `RESPONSIVE-1` is considered. Flex children default to a content-based minimum size, so a layout
  that "breaks at narrow widths" is very often one missing `min-w-0`, not one missing a breakpoint.
- **Two adjacent codes both match.** Choose the smaller index — the cheaper repair. Ask one
  discriminating question only when the requester explicitly demands the more invasive one without
  naming the failure that requires it.
- **State parity.** Skeleton, empty and error render inside the same owner with the same code as the
  loaded state. Changing the code while loading is a lie about the geometry.

## Output

```text
owner: <component that owns the geometry>
participants: <direct children whose arrangement changes>
situation: <RESPONSIVE-1 | RESPONSIVE-2 | RESPONSIVE-3 | RESPONSIVE-4 | RESPONSIVE-5 | RESPONSIVE-6>
className: <no responsive class | exact base-first class string>
threshold: <measured failure width, or "none">
reason: <observed content failure that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions, request mapping and boundary discrimination of every code, and `audit.md` only
while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
