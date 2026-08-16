---
id: fe-principles-margin-index
title: INDEX.md
slug: /fe/principles/margin
sidebar_label: margin
sidebar_position: 0
description: Binding rules for the few placement jobs a margin className is allowed to perform.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `margin`

## Law

Margin moves ONE element relative to the space its parent left over. It never states how far apart
siblings are, and it never states how much air a box keeps inside itself.

Sibling rhythm belongs to the parent. Internal breathing room belongs to the boundary owner. What is
left for margin is a short, closed list of placement jobs, each of which needs a layout fact — a
width constraint, a free-space axis, a height-bearing column, or a real existing margin — before it
is allowed to be written at all.

**This is binding, not advisory.** Every element that is rendered sits in exactly one of the
situations below, and the overwhelmingly common one is the situation that emits nothing. There is no
element too small, too nested or too temporary to be exempt: a button in a two-item row is
`MARGIN-0` for the same reason a full page shell is `MARGIN-0`, and the moment one of them is not,
the layout fact that changed it must be nameable out loud. "It was only a few pixels off" is not an
exemption — it is the single place this rule is most often skipped.

## Situation Codes

Every situation this module governs carries a code, `MARGIN-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one of them
emits nothing.

| Code | Situation | className |
|---|---|---|
| `MARGIN-0` | Ordinary placement — the parent already owns every distance in play | *no margin class* |
| `MARGIN-1` | Reset — a known native or third-party margin exists and must be removed | `m-0` |
| `MARGIN-2` | Centre (`mx-auto`) — a width-constrained block is centred in the free inline space around it | `mx-auto` |
| `MARGIN-3` | Push inline-end (`ms-auto`) — one flex item takes the remaining inline space before itself and lands at the inline end | `ms-auto` |
| `MARGIN-4` | Push block-end (`mt-auto`) — one flex child takes the remaining block space before itself in a height-bearing column | `mt-auto` |

`MARGIN-0` IS A SITUATION, NOT A VALUE. It emits no class at all. It is not `m-0`, and writing `m-0`
to express it is a rule change rather than a shortcut: `m-0` is an assertion that a margin exists and
is being cancelled, and that assertion is false in ordinary placement. The two are separate codes
because they are separate claims about the world — `MARGIN-0` claims *nobody set a margin here*, and
`MARGIN-1` claims *somebody else did, and I know who*.

This module has no measurement scale, and that is the point. Margin is not a rhythm; a rhythm needs
rungs so that distances can be compared, whereas every code here is a distinct placement job that
either applies or does not. The index is therefore a position in reading order and nothing else —
`MARGIN-2` is not twice `MARGIN-1` and not one rung above it. What each index means is carried by the
Situation column, which is where reset, `mx-auto`, `ms-auto` and `mt-auto` are named, and a code is
never read without it.

The set is closed at five. A sixth placement job is a proposal to change this canon, argued in
`changelog.md`, not a decision made once inside a component.

## Inputs

| Input | Evidence required |
|---|---|
| element | The single direct child being placed |
| parent layout | `block`, `flex-row`, `flex-column`, `grid` — and whether it is a direct child of it |
| free space | The axis on which leftover space actually exists for auto margin to consume |
| width constraint | A stated `max-w-*` or `w-*` that leaves inline space free |
| height source | For a column, whether height comes from the parent (stretch, fixed, grid row) or from content |
| existing margin | For a reset, the concrete native or third-party margin being cancelled |
| job | ordinary, reset, centre, push inline-end or push block-end |

## Invariants

- The parent owns sibling distribution. A child never pushes its sibling.
- Margin does not encode content hierarchy. Distance-as-meaning is the parent's decision.
- Margin does not create internal breathing room. That is the boundary owner's padding.
- An auto margin is only an instruction to absorb free space, so it requires free space on that axis.
- `mx-auto` requires a width constraint; without one the block already fills the line and centres
  nothing.
- `mt-auto` requires a height-bearing flex column; in a content-sized column there is no leftover
  block space to absorb.
- `ms-auto` applies to exactly ONE direct flex child. Two of them is a distribution rule wearing a
  placement rule's clothes.
- `m-0` is only valid against a margin that is known to exist and can be named.
- Logical margin (`ms-`, `me-`) is preferred over physical (`ml-`, `mr-`) so placement survives a
  right-to-left locale.
- Measured margin (`mt-4`, `mb-6`, `ml-2`, …) is outside every code in this module.
- Negative margin (`-mt-4`, `-mx-6`, …) is outside every code in this module.
- Every rendered element resolves to exactly one code. No element is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Known native margin only.** `m-0` is legal against a real default — a browser's heading, a
  paragraph, a list, an embedded third-party widget. It is not legal as a way to tighten a seam a
  parent chose.
- **Reset layer first.** If a global reset can own the native margin, it should. `MARGIN-1` at the
  call site is for the case where the margin arrives from outside the reset's reach.
- **Constraint before centring.** `mx-auto` on an unconstrained block is not centring — it is a class
  with no effect. If the requester wants centring, the missing fact is the width, not the margin.
- **Full bleed is layout, not margin.** Escaping a container's inset is expressed by a layout
  structure that has no inset to escape. General negative margin is refused because it silently
  crosses a boundary the parent believed it owned.
- **Overlays are position, not margin.** Anything that must sit above the flow is a positioning
  problem; nudging it with margin makes the true owner unfindable.
- **Missing layout fact.** When the parent layout, the free-space axis, the width constraint or the
  height source is not stated, emit no margin class. Ask ONE concrete question, and only when the
  requester explicitly requires auto-margin placement.
- **State parity.** Placement does not change between loading, empty, error and loaded states. A
  skeleton in a height-bearing card keeps `mt-auto` on the element that stands in for the action, or
  the layout jumps the moment content arrives.

## Output

```text
element: <element being placed>
parent layout: <block | flex-row | flex-column | grid>
free space: <axis with leftover space, or none>
situation: <MARGIN-0 | MARGIN-1 | MARGIN-2 | MARGIN-3 | MARGIN-4>
className: <no class | m-0 | mx-auto | ms-auto | mt-auto>
reason: <layout fact that proves the job and excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup. Sibling
rhythm is decided by the gap module and internal inset by the padding module; this module only
refuses those jobs, it does not re-decide them.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
