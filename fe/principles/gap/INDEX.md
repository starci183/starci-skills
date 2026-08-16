---
id: fe-principles-gap-index
title: INDEX.md
slug: /fe/principles/gap
sidebar_label: gap
sidebar_position: 0
description: Binding rules for choosing a gap className from the relationship between direct siblings.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `gap`

## Law

The seam between two things states how strongly they belong together. Choose it from that
relationship, never from how the spacing looks.

The immediate parent owns the seam. One parent expresses one relationship; mixed relationships need
nested parents.

**This is binding, not advisory.** Anything rendered with two or more siblings has a gap situation,
and that situation has a code below. There is no size at which a composition is too small to have
one: a label above a field is `GAP-3` for the same reason a rail beside a result region is `GAP-8`.
"It is only two elements" is not an exemption — it is the most common place the rule gets skipped.

## Situation Codes

Every situation this module governs carries a code, `GAP-<rung>`. The code names the SITUATION; the
className column names what that situation emits. They are not the same thing, and one of them
emits nothing.

| Code | Situation | className |
|---|---|---|
| `GAP-0` | A divided or joined list already owns its rhythm | *no gap class* |
| `GAP-1` | One identity or value; one child qualifies the other | `gap-1` |
| `GAP-2` | One compact action, record, sentence or ordered run | `gap-2` |
| `GAP-3` | A label, heading or toolbar owns the local block that follows | `gap-3` |
| `GAP-4` | Peer groups; each group owns internal structure | `gap-4` |
| `GAP-6` | Peer page sections in one content flow | `gap-6` |
| `GAP-8` | Peer layout regions with independent geometry | `gap-8` |

`GAP-0` IS A SITUATION, NOT A RUNG. There is no `gap-0` class, and adding one is a rule change rather
than a shortcut: the absence of a seam is a different fact from a seam of size zero. Writing `gap-0`
claims the parent decided a distance when it decided not to own one. The code exists because "no
gap" is a case a reader must be able to recognise, cite and be corrected against — a situation with
no name is a situation nobody can be shown to have got wrong.

The scale skips `5` and `7` deliberately. A closed scale with holes in it forces a relationship
decision; a continuous one invites splitting the difference, which is taste re-entering through
arithmetic.

## Inputs

| Input | Evidence required |
|---|---|
| parent | Immediate common parent |
| siblings | Direct children only |
| relationship | identity, compact cluster, owned block, peer groups, sections, regions or joined list |
| behavior | Whether action, state and boundary are shared or independent |

## Invariants

- The parent owns the sibling gap.
- Children do not create sibling seams with `margin`.
- One container expresses one relationship.
- Direction, component size and the amount of empty space do not select a gap.
- A divider and a gap do not express the same boundary twice.
- A situation code maps to exactly one className, and no className serves two codes.
- Every rendered sibling set resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **State parity.** Keep the same class across axis, viewport and content-state changes unless the
  parent itself changes. Skeleton and loaded content share one code.
- **Chronology.** A timestamp beside its event is `GAP-2` only when the two form one ordered record.
  A timestamp that merely dates a separate block is not part of that record.
- **Flat parent with mixed relationships.** Nest before choosing. One container holding an identity,
  a metric and a section heading has no correct single answer, and averaging them is how the wrong
  one gets chosen.
- **Two adjacent codes both match.** Choose the smaller rung. Ask one discriminator question only
  when the requester explicitly requires the larger relationship.
- **Divider present.** A list that draws separators and pads its own rows is `GAP-0` even when the
  rows would otherwise read as peers.

## Output

```text
parent: <immediate parent>
siblings: <direct children>
situation: <GAP-0 | GAP-1 | GAP-2 | GAP-3 | GAP-4 | GAP-6 | GAP-8>
className: <no class | gap-1 | gap-2 | gap-3 | gap-4 | gap-6 | gap-8>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
