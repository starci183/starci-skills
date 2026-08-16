---
id: fe-principles-elevation-index
title: INDEX.md
slug: /gates/principles/elevation
sidebar_label: elevation
sidebar_position: 0
description: Binding rules for choosing an elevation className from what an element sits above and by which means it says so.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `elevation`

## Law

Elevation is a claim about **what an element sits above**. It is answered from two facts and nothing
else: **which ground the element rests on**, and **what it covers or outranks while it is there**.
Choose from those two facts, never from how deep a shadow looks.

Elevation is **relative to the local ground, not to the page**. The ground is whatever surface an
element was placed onto: the page itself, an existing surface, or a layer that was already raised. A
card resting on the page and a card resting inside a raised layer are not at the same height in the
viewer's eye, and they must not make the same claim — the second one has already been carried up by
its host and has nothing left to announce.

Height and order are **two different statements**. A shadow says *how far above my ground I am*; a
declared stacking order says *which of two things that overlap is in front*. Neither implies the
other, and neither substitutes for the other. Two elements can sit on the same rung and still need an
order; two elements can need no order at all and still sit on different rungs.

**This is binding, not advisory.** Every element that renders falls under exactly one code below,
including the overwhelming majority that fall under `ELEVATION-0` and emit nothing. There is no
composition too small to have an elevation situation: a two-line hint block inside a card is
`ELEVATION-0` for the same reason a blocking dialog is `ELEVATION-3`, and both facts must be
decidable by the same reader. "It is just a shadow, it looks nicer" is not an exemption — it is the
single most common breach of this law, and it is how a page ends up with four shadows all claiming
the same height and none of them meaning anything.

## Situation Codes

Every situation this module governs carries a code, `ELEVATION-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and
one of them emits nothing.

| Code | Situation | className |
|---|---|---|
| `ELEVATION-0` | The element lies in the plane of its ground and covers nothing | *no elevation class* |
| `ELEVATION-1` | An independent object comes to rest on its ground | `shadow-surface` |
| `ELEVATION-2` | A layer is summoned by a user act, covers content, stays dismissible | `z-30 shadow-popover` |
| `ELEVATION-3` | A layer takes the page away until it is answered | `z-[60] shadow-dialog` + backdrop |
| `ELEVATION-4` | Two things in one stacking context overlap, so the order must be written | `z-<rung>` from the ladder, no shadow |
| `ELEVATION-5` | The rung is real but the host forbids a shadow, so a border carries it | `border border-border shadow-none` |
| `ELEVATION-6` | The ground is cut into rather than built upon | `inset-shadow-sm bg-muted` |

Codes `0`–`3` are a **true ladder**: each rung sits above the one before it, and that ordering is the
subject of the module rather than an accident of numbering. Codes `4`–`6` are not rungs. They name
the **means** by which a height or an order is expressed when the plain ladder cannot express it: by
a written number, by a border, or by cutting downward. This is why the module's question has two
halves — *what sits above what*, answered by `0`–`3`, and *by which means*, answered by `4`–`6`.

`ELEVATION-0` IS A SITUATION, NOT A RUNG. There is no `shadow-none` to write for it and no
`z-0` to declare. The absence of an elevation claim is a different fact from a claim of zero height:
writing `shadow-none` on an element that never had a shadow claims a decision was reversed when in
truth none was ever made, and `z-0` pins an element into a comparison it does not participate in. The
code exists because "sits on the plane" is the answer for most of a page, and an answer that has no
name is an answer nobody can be shown to have got wrong.

`ELEVATION-2` AND `ELEVATION-3` EMIT TWO CLASSES, NOT ONE. A raised layer that declares a height but
no order is unfinished: it will read as raised and still lose to the next thing that overlaps it. The
rungs those two codes cite are defined once, under `ELEVATION-4`, and are never chosen freshly.

**The declared ladder.** `ELEVATION-4` owns one closed set of rungs. Every `z` in the product comes
from this table and from nowhere else.

| Rung | className | What sits there |
|---|---|---|
| behind | `-z-10` | Decoration that must fall behind the content of its own context |
| 1 | `z-10` | Chrome that floats inside one component only |
| 2 | `z-20` | A control that floats over a region which is already sticky |
| 3 | `z-30` | An in-page sticky sub-header, or a summoned layer (`ELEVATION-2`) |
| 4 | `z-40` | Page-level floating chrome that outranks page content |
| 5 | `z-50` | The top app chrome — the highest thing in ordinary page flow |
| 6 | `z-[60]` | What must clear the top app chrome: navigation progress, a cold-load cover, a blocking layer (`ELEVATION-3`) |

There is no rung between two rungs and no rung above `6`. **A bigger number is not a stronger claim.**
Two utilities in the same cascade layer are decided by source order, not by magnitude, so an element
that loses a stacking fight can lose it again at any number. A fight at the top of the ladder is
therefore a report about architecture — two things were rendered as siblings that should have been
rendered one inside the other — and raising the number answers a question nobody asked.

## Inputs

| Input | Evidence required |
|---|---|
| ground | Page ground, an existing surface, or an already-raised layer |
| origin | Present at render, or summoned by a named user act |
| coverage | What the element covers, and whether that content is still readable |
| blocking | Whether the covered content can still be acted on |
| collision | Whether a sibling in the same stacking context overlaps it |
| context roots | Which ancestor already creates a stacking context: `transform`, `filter`, `opacity` below 1, `will-change`, `isolate`, or a fixed position |

## Invariants

- The rung is measured from the local ground, never from the page.
- A raised layer declares both a rung and an order; a resting surface declares neither an order nor a
  number.
- One element makes at most one elevation claim. A shadow and a border do not both say "I am above
  you".
- Order is comparable only inside one stacking context. A number cannot lift a child out of the
  context its ancestor created.
- Every `z` comes from the declared ladder. An arbitrary value is a rule change, not a local choice.
- Elevation does not change because the pointer moved over the element.
- Skeleton and loaded content sit on the same rung.
- Elevation is never the only carrier of a boundary that the content depends on.
- Every rendered element resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Scroll rise.** A sticky header may gain `shadow-surface` once content has scrolled underneath it,
  moving from `ELEVATION-4` to `ELEVATION-4` plus a true `ELEVATION-1` claim. This is permitted
  because the claim became true: before the scroll it covered nothing, after it covers content.
- **Drag lift.** An element being dragged may rise for the duration of the drag. Permitted for the
  same reason: while it is held, it genuinely sits above what it will be dropped onto. It returns to
  its resting code the moment it is released.
- **Dark ground.** Where the ground is dark enough that a shadow reads as nothing, the resting rung
  is carried by `ELEVATION-5` instead. The rung did not change; only the medium did.
- **A layer summoned from inside a layer.** Do not escalate the number. Render the second layer
  inside the first, so that the first becomes its ground. Two body-level layers fighting for the top
  rung is the architecture report described above, not a case for a seventh rung.
- **Forced colours and print.** A shadow may not render at all. Any boundary the content depends on
  must also exist as a border or a background, which is a `SURFACE` decision, not a licence to raise
  the rung.
- **Two adjacent codes both match.** Choose the lower rung. Ask one discriminating question only when
  the requester explicitly requires the higher claim.

## Output

```text
ground: <page ground | existing surface | raised layer>
element: <what is being placed>
covers: <what it sits above, or nothing>
situation: <ELEVATION-0 | ELEVATION-1 | ELEVATION-2 | ELEVATION-3 | ELEVATION-4 | ELEVATION-5 | ELEVATION-6>
className: <no class | shadow-surface | z-30 shadow-popover | z-[60] shadow-dialog | z-<rung> | border border-border shadow-none | inset-shadow-sm bg-muted>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

This module decides **height and order**. It does not decide whether a container is entitled to draw
a boundary at all — that is a membership question and belongs to the surface module. Where the two
agree on a class, they agree for different reasons: the surface module writes a shadow because a
container is an independent page object, and this module reads that same shadow as the resting rung.
They may never disagree about the same element. Flow participation and coordinate ownership belong to
the position module; this module emits no `relative`, `absolute`, `fixed` or `sticky`, even though
its raised codes are always attached to one of them.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
