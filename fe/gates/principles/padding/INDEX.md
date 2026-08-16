---
id: fe-principles-padding-index
title: INDEX.md
slug: /gates/principles/padding
sidebar_label: padding
sidebar_position: 0
description: Binding rules for choosing a padding className from the boundary that owns the inset.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `padding`

## Law

Padding is the inset a **boundary** owns around its own direct content. A boundary is an element that
draws one — background, border, elevation, ruled cell — or owns one semantically, such as the plane a
route dedicates to its single task.

Choose the inset from what that boundary is responsible for, never from how much room the result
appears to have. Size, screenshots and the words "roomy", "cramped", "big" are not evidence.

Padding never pushes a sibling. Distance between siblings belongs to the parent's gap; an element
that grows its own inset to move a neighbour has answered a question that was not asked.

**This is binding, not advisory.** Every rendered element is either a boundary or not, and both
answers have a code below. There is no size at which a composition is too small to have one: a
two-line cell in a divided strip is `PADDING-2` for the same reason a document plane is `PADDING-6`.
"It is just a wrapper" is not an exemption — it is the most common place the rule gets skipped, and
it has its own code precisely so that skipping it can be named.

## Situation Codes

Every situation this module governs carries a code, `PADDING-<rung>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and one code emits
two different things for one reason stated below.

| Code | Situation | className |
|---|---|---|
| `PADDING-0` | The element owns no inset of its own | *no padding class*, or `p-0` when a real boundary delegates |
| `PADDING-2` | Compact repeated cell holding one short datum or one action | `p-2` |
| `PADDING-3` | Regular repeated or ruled cell holding a small content group | `p-3` |
| `PADDING-4` | Ordinary surface, composed row or nested callout | `p-4` |
| `PADDING-6` | Primary focused reading or task plane | `p-6` |

`PADDING-0` IS A SITUATION, NOT A RUNG, and it is the one code with two emissions. The situation is
"this element owns no inset". The two emissions answer a second, closed question — *is there a real
boundary here at all?*

- **No boundary.** A transparent arranger only establishes a stack, a grid or a row. It owns nothing
  to inset, so it emits **no padding class**. Writing `p-0` on it claims a boundary made a decision
  where no boundary exists.
- **A boundary that delegates.** A real boundary hands its whole inset to its direct rows, cells or
  to one content child — so that dividers reach the edge, or so that media bleeds to the border. It
  emits **`p-0`**, out loud, because the delegation is a decision and a reader must be able to see
  that it was taken rather than forgotten.

Absence of a class and `p-0` are therefore not interchangeable, and this distinction is the oldest
decision in the module. Both remain under one code because both describe the same inset — zero — and
splitting them into two codes would suggest the scale has two zero rungs, which it does not.

The scale skips `1`, `5` and every value above `6`. A closed scale with holes forces a boundary-role
decision; a continuous one invites splitting the difference, which is taste re-entering through
arithmetic. Adding a rung is a rule change recorded in `changelog.md`, never a local choice.

## Inputs

| Input | Evidence required |
|---|---|
| boundary owner | The element drawing or semantically owning the boundary |
| direct content | One datum, one small group, a composed surface, or a route's primary task |
| delegation | Whether direct rows, cells or one content child own the inset instead |
| nesting | Whether an inner element is a transparent wrapper or a second real boundary |
| role | Ordinary reusable surface, or the plane the route exists for |

## Invariants

- The boundary owner owns the inset. Nothing else may add one on its behalf.
- One boundary receives exactly one inset decision.
- A transparent arranger receives no padding class at all.
- Padding is not used to separate siblings; that distance belongs to the parent's gap.
- Loading, empty, error and ready render the same padding tree.
- Axis and viewport changes do not change the inset unless the boundary's role itself changes.
- An interactive control owns its internal inset where the control is defined; callers do not patch
  it with `px-*` or `py-*` from outside.
- An element positioned at another element's edge needs an explicit slot or geometry rule, not
  guessed extra inset on the neighbour.
- A situation code maps to exactly one inset value. `PADDING-0` maps to zero, expressed two ways for
  the boundary-existence reason above.
- Every rendered element resolves to exactly one code. No wrapper, cell or plane is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Explicit delegation.** `p-0` is a decision by a real boundary. It is never a tidier way of
  writing "no padding here" on a wrapper — that case is the no-class emission of `PADDING-0`.
- **Nested surface.** An inner element earns its own inset only when it introduces a real boundary of
  its own. Two backgrounds, two insets. One background and one stack, one inset.
- **Interactive control inset.** Established control padding is left alone. A caller who believes it
  is wrong proposes a change where the control is defined; patching it at one call site makes the
  same control two shapes.
- **Unknown ownership.** When the request does not establish who owns the boundary or what role it
  plays, emit no caller padding. Ask one concrete question only when the requester explicitly
  requires a non-default inset.
- **Two adjacent rungs both match.** Choose the smaller rung. Ask one discriminating question only
  when the requester explicitly requires the larger role.
- **Edge participant.** Reserving inset for a control placed over another element's edge is allowed
  only once the slot and its geometry are stated. Until then, no inset is invented.

## Output

```text
boundary owner: <element, or "none — transparent arranger">
direct content role: pass-through | delegated | compact-cell | regular-cell |
                     ordinary-surface | primary-plane
situation: <PADDING-0 | PADDING-2 | PADDING-3 | PADDING-4 | PADDING-6>
className: <no class | p-0 | p-2 | p-3 | p-4 | p-6>
nested boundaries: <none | owner tree with one code each>
reason: <business fact that excludes the adjacent code>
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
