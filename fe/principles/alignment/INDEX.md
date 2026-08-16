---
id: fe-principles-alignment-index
title: INDEX.md
slug: /fe/principles/alignment
sidebar_label: alignment
sidebar_position: 0
description: Binding rules for choosing an alignment className from what the children hang from and where the run sits.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `alignment`

## Law

Children of unequal measure must hang from something. Alignment states WHAT — a shared cross
measure, a middle, a leading edge, a trailing edge, or a writing line — and it is chosen from the
nature of the children, never from where they should appear to sit.

A container answers two independent questions. Across the direction the run flows, the **cross
axis** decides what the children hang from. Along the direction the run flows, the **main axis**
decides where the run sits and who receives the space nobody claimed. Neither answer implies the
other, and neither is optional: a container that declares nothing has answered both with the
defaults, and the defaults are decisions with consequences — stretch makes a bordered child grow a
boundary it did not earn, and start-packing hands every surplus pixel to the trailing edge.

**This is binding, not advisory.** Every flex and grid container falls under exactly one cross-axis
code and exactly one main-axis code below, including the containers that emit nothing. There is no
row too small to have both: an icon beside a label is `ALIGN-1` for the same reason a page shell
beside a rail is `ALIGN-0`. "It already looks right" is not an exemption — it is the most common
place this rule gets skipped, because alignment is the one decision whose breach is invisible until
the data changes. Two children of equal height align identically under every code in this module.
They stop doing so the day one of them wraps to a second line.

## Situation Codes

Every situation this module governs carries a code, `ALIGN-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two of them
emit nothing.

The codes are numbered in the order a reader meets them: the cross axis first, because it is the
question this module takes over; the per-child departure immediately after the rule it departs
from; the main axis next; and the wrapped-line case last, because it only exists once a container
has been given a cross size it must justify.

**Cross axis — what the children hang from.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-0` | The children share one cross measure; each fills the line | *no alignment class* |
| `ALIGN-1` | Children of unequal cross measure must read as one line | `items-center` |
| `ALIGN-2` | Each child owns its own cross length and they must begin together | `items-start` |
| `ALIGN-3` | Each child owns its own cross length and they must end together | `items-end` |
| `ALIGN-4` | Text of different sizes must sit on one writing line | `items-baseline` |
| `ALIGN-5` | One child departs from the rule its parent declared | `self-*` |

**Main axis — where the run sits and who receives the leftover space.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-6` | The run begins at the content edge; surplus falls after it | *no alignment class* |
| `ALIGN-7` | The whole run belongs at the far end of its own direction | `justify-end` |
| `ALIGN-8` | The run belongs to no edge and sits in the middle of the surplus | `justify-center` |
| `ALIGN-9` | The surplus belongs BETWEEN the children, by opposed or equal claim | `justify-between` · `justify-around` · `justify-evenly` |

**Wrapped lines — what the lines hang from, once there are several.**

| Code | Situation | className |
|---|---|---|
| `ALIGN-10` | The container wraps into several lines and owns cross space they do not fill | `content-*` |

`ALIGN-0` AND `ALIGN-6` ARE SITUATIONS, NOT ABSENCES. There is no `items-stretch` or `justify-start`
to write in ordinary work, and adding one states nothing the default did not already state. The
codes exist because a default that nobody named is a default nobody can be shown to have chosen
wrongly — and stretching is the single most consequential default in this module, because it silently
resizes children that own a background, a border or a fill.

`ALIGN-5` is the only code carried by a child rather than by the container. It exists so that a
departure is legible as a departure: the container keeps its declared rule, and exactly one child
says out loud that it is not bound by it.

## Inputs

| Input | Evidence required |
|---|---|
| container | Whether the element declares `flex`, `inline-flex` or `grid` at all |
| axis | Which direction the run flows, hence which axis is cross |
| children | Direct children only, and the cross measure each of them owns |
| nature | Whether each child is text, a box with a boundary, or a fixed-size control |
| growth | Whether any child's cross measure can change with real data |
| surplus | Whether the container can be longer on the main axis than its content |
| roles | Whether the children at the two ends have opposed claims on those ends |

## Invariants

- An alignment class is legal only on an element that declares `flex`, `inline-flex` or `grid`. On
  anything else it renders nothing and states nothing.
- Each container answers the cross axis once and the main axis once. The two answers are independent
  and may both be declared on the same node.
- Alignment spends space that already exists. It never creates distance between children; that is
  the parent's gap.
- Alignment moves boxes. It never aligns glyphs inside a box.
- Alignment never changes what a child measures. A child that must match a sibling's measure is a
  sizing decision, not an alignment one.
- `start` and `end` are logical. No rule in this module refers to left or right.
- One child moving alone to the far end is not the container's main-axis answer.
- A code is chosen from what the children ARE, not from what the current data happens to render.
- Every rendered flex or grid container resolves to exactly one code per axis. No container is out
  of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Icon beside text.** `ALIGN-1`, never `ALIGN-4`. An icon's baseline is an accident of its box, not
  a writing line, and hanging a drawing from a writing line puts it below where a reader expects it.
- **Text that can wrap.** A row whose text may reach a second line is `ALIGN-2`, not `ALIGN-1`, even
  while today's data is one line. Centring against a growing block moves the fixed child every time
  the sentence changes length.
- **Equal-measure children.** `ALIGN-0` and `ALIGN-2` render identically until a child owns a
  boundary or grows. Choose from boundary ownership, not from the render.
- **Two children with an optional third.** `ALIGN-9` holds only when the two ends are opposed by
  role. If a third child would belong in the middle of neither end, the trailing child is departing
  alone and the main axis stays `ALIGN-6`.
- **Not a flex or grid container.** This module emits nothing. Centring one width-constrained block
  inside its parent's free inline space is a margin decision, not an alignment one.
- **No surplus on the main axis.** `ALIGN-7`, `ALIGN-8` and `ALIGN-9` do nothing when the content
  already fills the container. Declaring one is still correct; relying on it to produce distance is
  not.
- **State parity.** Keep the same codes across viewport, axis direction and loading state unless the
  container itself changes. A skeleton and its loaded content hang from the same thing.

## Output

```text
container: <flex | inline-flex | grid | none>
axis:      <row | column>
children:  <direct children and the cross measure each owns>
cross:     <ALIGN-0 | ALIGN-1 | ALIGN-2 | ALIGN-3 | ALIGN-4>
departure: <ALIGN-5 on the named child, or none>
main:      <ALIGN-6 | ALIGN-7 | ALIGN-8 | ALIGN-9>
lines:     <ALIGN-10 when the container wraps and owns surplus cross space, or none>
className: <no alignment class | items-* | self-* | justify-* | content-*>
reason:    <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
