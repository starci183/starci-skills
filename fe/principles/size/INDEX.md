---
id: fe-principles-size-index
title: INDEX.md
slug: /fe/principles/size
sidebar_label: size
sidebar_position: 0
description: Binding rules for choosing a size className from who owns the measurement of one axis.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `size`

## Law

Every extent on a screen was decided by somebody. The class you write names WHO decided it: the
content inside the box, the parent that offers the space, or a bound somebody set on purpose.
Choose from that ownership, never from what the box happens to look like at the one width you have
open.

Ownership is per AXIS. A box has an inline extent and a block extent, and they are two decisions
with two different answers far more often than they are one. A comment field takes its width from
the parent and its height from a floor somebody reserved; calling that box "sized" as a single fact
is how one of the two axes ends up never having been decided at all.

**This is binding, not advisory.** Anything rendered occupies space on two axes, and each axis has a
code below. There is no element small enough to be exempt: a `16px` glyph is `SIZE-4` for exactly
the reason a page shell is `SIZE-2`, and "it is just an icon" is the sentence under which most
unexplainable extents enter a codebase. An axis whose owner nobody can name is not a small omission;
it is the axis that will break first at a width nobody tested.

## Situation Codes

Every situation this module governs carries a code, `SIZE-<index>`. The code names the SITUATION on
ONE AXIS; the className column names what that situation emits on that axis. They are not the same
thing, and one of them emits nothing.

| Code | Situation | className |
|---|---|---|
| `SIZE-0` | Content measures itself; the box is exactly what it holds | *no size class* |
| `SIZE-1` | The box takes everything the parent offers | `w-full` · `h-full` · `flex-1` |
| `SIZE-2` | A ceiling caps growth: reading measure, shell, overlay | `max-w-[65ch]` · `max-w-5xl` · `max-h-[80vh]` |
| `SIZE-3` | A floor reserves extent so nothing collapses or jumps | `min-h-32` · `min-w-24` · `min-h-screen` |
| `SIZE-4` | A token fixes the extent outright | `size-4` · `size-10` · `h-10` · `w-64` |
| `SIZE-5` | A stated share of the parent | `w-1/2` · `basis-1/3` |
| `SIZE-6` | The content's intrinsic floor is released so the parent wins | `min-w-0` · `min-h-0` |
| `SIZE-7` | The other axis derives it | `aspect-video` · `aspect-square` |

`SIZE-0` IS A SITUATION, NOT A CLASS. There is no "auto width" class to write, and reaching for
`w-auto` to say it is a rule change rather than a shortcut: `w-auto` overrides an inherited decision,
while `SIZE-0` is the absence of any decision but the content's. The code exists because a box that
measures itself is a claim a reader must be able to recognise, cite and be corrected against — an
unnamed situation is one nobody can be shown to have got wrong.

The indices are not a scale, and a larger index is not a larger box. They are eight distinct
answers to one question, and when more than one appears on the same axis the axis resolves in this
fixed order:

`SIZE-7` → `SIZE-4` → `SIZE-2` → `SIZE-3` → `SIZE-6` → `SIZE-5` → `SIZE-1` → `SIZE-0`

Read it as: a derived axis is not measured at all; a fixed token answers before any negotiation
starts; a bound outranks the negotiation it constrains; a released floor outranks the fill it makes
possible; and content only measures itself once nobody else has claimed the axis. `w-full max-w-5xl`
is one axis with one owner — the ceiling — and `w-full` is merely how the box reaches it.

## Inputs

| Input | Evidence required |
|---|---|
| box | The element being measured, not its wrapper |
| axis | Inline or block, stated separately; never "size" as one word |
| parent layout | Normal flow, flex, grid, or a positioning containing block |
| content dependency | Whether the extent must survive when the content is removed |
| bound | Any ceiling or floor the request states, and the standard it comes from |
| state set | Every content state the axis must hold without moving |

## Invariants

- One axis resolves to exactly one code. A box carries two codes, not one.
- The code names WHO measures. `ch`, `rem`, `%`, `vh` and `px` are units, and a unit never changes
  the code.
- A block-level child in normal flow is already `SIZE-1` on the inline axis. Do not restate it with
  `w-full`; write the class where the default is otherwise — flex and grid children, inline-block,
  form controls, and absolutely positioned boxes.
- Running text carries a ceiling. Prose allowed to span an unbounded measure is not `SIZE-0`; it is
  an axis nobody decided.
- A flex or grid child that must truncate, ellipsise or scroll carries `SIZE-6` on that axis.
  Without it the content's own minimum silently outranks the parent.
- Fixed extents come from the token scale, never from a pixel measured off a picture.
- A parent and its only child do not both state the same extent. One of the two is a decision and
  the other is a copy of it.
- Skeleton, empty, error and loaded states share one code per axis.
- No className serves two codes, and no code is chosen because it made the current screenshot look
  right.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **A floor and a ceiling on the same axis.** The axis is a stated range. Cite the bound the request
  is actually about — the ceiling when the concern is unbounded growth, the floor when the concern
  is collapse — and record the other as the guard it is.
- **Positioned boxes.** For an absolutely or fixed box, the parent in `SIZE-1` and `SIZE-5` is the
  positioning containing block, not the DOM parent. Resolve against the box it is actually measured
  from, or the code is being read off the wrong element.
- **Media of unknown intrinsic size.** Remote images and embeds arrive with a size nobody in this
  codebase chose. Reserving the box with `SIZE-7` is required, not optional, wherever a late arrival
  would otherwise move content that is already on screen.
- **Responsive.** A breakpoint may change the code only when the layout role changes. A rail that
  becomes a stacked band genuinely changes owner; the same rail merely getting narrower does not.
- **Replaced and form elements.** These carry an intrinsic extent the platform chose. Stating
  `SIZE-1` on them is a real decision even in normal flow, because their default is `SIZE-0`.
- **Viewport-measured bounds.** `min-h-screen` and `max-h-[80vh]` remain `SIZE-3` and `SIZE-2`. The
  viewport is where the number came from, not who owns the axis.

## Output

```text
box: <element>
axis: <inline | block>
situation: <SIZE-0 | SIZE-1 | SIZE-2 | SIZE-3 | SIZE-4 | SIZE-5 | SIZE-6 | SIZE-7>
className: <no class | w-full | max-w-[65ch] | min-h-32 | size-10 | basis-1/3 | min-w-0 | aspect-video>
reason: <who owns this axis, and what excludes the code next to it in the resolution order>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
