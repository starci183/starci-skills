---
id: fe-principles-position-index
title: INDEX.md
slug: /fe/principles/position
sidebar_label: position
sidebar_position: 0
description: Binding rules for choosing a position className from flow participation and coordinate ownership.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `position`

## Law

An element's position states two facts and nothing else: whether it still **reserves space in normal
flow**, and **which coordinate system owns it**. Choose from those two facts, never from where the
element should appear to sit.

Normal flow is the default and costs nothing to declare. A position class is added only when the
element must become a coordinate owner, must leave flow for a named anchor, must attach to the
viewport, or must follow a named scroll ancestor to a threshold.

**This is binding, not advisory.** Every rendered element falls under exactly one code below,
including the overwhelming majority that fall under `POSITION-1` and emit nothing. There is no
composition too small to have a position situation: a badge sitting on a thumbnail is `POSITION-3`
for the same reason a blocking backdrop is `POSITION-4`. "It is just a wrapper" is not an
exemption — a wrapper that carries `relative` without a positioned descendant is the single most
common breach of this law, and it is invisible precisely because it renders identically.

## Situation Codes

Every situation this module governs carries a code, `POSITION-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and
two of them emit nothing.

| Code | Situation | className |
|---|---|---|
| `POSITION-1` | The element reads in document order and must push what follows | *no position class* |
| `POSITION-2` | An in-flow element must become the coordinate owner of a positioned descendant | `relative` |
| `POSITION-3` | The element leaves flow and is anchored to a named positioned ancestor | `absolute` + declared inset |
| `POSITION-4` | The element leaves flow and is anchored to the viewport | `fixed` + declared inset |
| `POSITION-5` | The element keeps its flow space and follows a named scroll ancestor to a threshold | `sticky` + threshold + opaque surface |
| `POSITION-6` | Placement is inseparable from collision, focus return and dismissal | *no position class from this module* |

The codes are numbered in the order a reader meets them, not by any magnitude. There is no scale
here: `POSITION-5` is not "more" than `POSITION-3`, and no situation sits between two codes. Each
code names one closed, checkable situation, and a request that matches none of them is a request
missing a fact, not a request needing a sixth mode.

`POSITION-1` AND `POSITION-6` BOTH EMIT NOTHING, FOR OPPOSITE REASONS. `POSITION-1` emits nothing
because normal flow is already the right answer and adding a class would be a lie about ownership.
`POSITION-6` emits nothing because the answer is not a class at all: an anchored menu, tooltip or
dialog needs collision handling, focus return and dismissal, and hand-writing `absolute` reproduces
only the coordinates while silently dropping everything else. Both are situations a reader must be
able to recognise, cite, and be corrected against — which is why "no class" is not left nameless.

`static` is never written. The absence of a position class is a different fact from a declared
`static`, exactly as an unowned seam differs from a seam of size zero.

## Inputs

| Input | Evidence required |
|---|---|
| `must_reserve_space` | Whether later content must move when this element appears or grows |
| `reference` | `normal-flow` · `positioned-ancestor` · `viewport` · `scroll-ancestor` |
| `anchor_owner` | The named element that owns the coordinate system, when the reference is an ancestor |
| `threshold` | The `top-*` / `bottom-*` boundary a scroll-anchored element stops at |
| `overlap` | Whether content can pass underneath, which decides whether a surface must be opaque |
| `lifecycle` | Whether the placement also owns collision, focus return and dismissal |

A request that names none of these has not described a position situation. It has described a
picture, and a picture is compatible with all six codes.

## Invariants

- Normal flow is the default. `relative` is never added without a positioned descendant that needs it.
- `absolute` requires a named anchor owner. If no nearer positioned ancestor is intended, the owner
  is made `POSITION-2` deliberately — never discovered by accident further up the tree.
- `fixed` means the viewport owns the element, not "keep it visible somewhere".
- `sticky` requires all three of: a named scroll ancestor, a threshold, and an opaque surface
  wherever content can pass beneath.
- `absolute` and `fixed` reserve no layout space. The owner must already reserve any room required.
- Position never repairs source order, sibling spacing, alignment or responsive order. Those belong
  to flow, to the seam between siblings, and to the owner's distribution.
- Position never changes reading order or focus order. Visual order and DOM order stay together.
- Every rendered element resolves to exactly one code. No element is out of scope.
- A situation code maps to exactly one className outcome, and no className serves two codes.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **No declared anchor.** Keep normal flow and emit nothing. An absent owner resolves to
  `POSITION-1`, never to a guessed `POSITION-3`.
- **No declared viewport ownership.** Do not emit `fixed`. "Always visible" is not viewport
  ownership; it is an unanswered question between `POSITION-4` and `POSITION-5`.
- **No declared threshold.** Do not emit `sticky`. A scroll-anchored element without a boundary has
  no defined resting place.
- **Interaction lifecycle present.** A menu, tooltip, popover or dialog is `POSITION-6`. This module
  does not reconstruct collision, focus return or dismissal from raw classes, and an example that
  does so is wrong even when the coordinates are right.
- **Decoration only.** An element that carries no content and no interaction may be `POSITION-3`
  purely for presentation, provided the information it decorates also exists in flow.
- **State parity.** Loading, empty, error and ready states of one region share one code. A skeleton
  that changes flow participation moves the page while it loads.
- **Two codes both match.** Choose the one that keeps flow. Ask exactly one concrete question only
  when the request explicitly requires the non-flow behavior.

## Output

```text
element: <the element being placed>
reserves_space: <yes | no>
reference: <normal-flow | positioned-ancestor | viewport | scroll-ancestor | interaction-layer>
anchor_owner: <none | named element>
situation: <POSITION-1 | POSITION-2 | POSITION-3 | POSITION-4 | POSITION-5 | POSITION-6>
className: <no class | relative | absolute + inset | fixed + inset | sticky + threshold | no class>
reason: <flow and coordinate-owner fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
