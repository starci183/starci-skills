---
id: fe-principles-surface-in-surface-index
title: INDEX.md
slug: /gates/principles/surface-in-surface
sidebar_label: surface-in-surface
sidebar_position: 0
description: Binding rules for deciding which boundary a container may claim when it sits on the page or inside another surface.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `surface-in-surface`

## Law

A boundary is a **membership claim**: it says "these things are one nameable group, and that group is
not the group around it". Draw a boundary only when such a claim is true, and draw it in the form the
host allows.

An independent page object may **elevate**. A distinct, nameable nested group may **outline**. A
duplicate, ordinary or unnameable nested claim stays **flat**.

A surface class states boundary ownership only. Spacing, inset and offset belong to other modules and
never appear in this module's output.

**This is binding, not advisory.** Every container that renders falls under exactly one code below —
including the ones that emit nothing. There is no composition too small to be exempt: a two-line
description inside a card is `SURFACE-IN-SURFACE-4` for the same reason a page-wide row set is
`SURFACE-IN-SURFACE-2`. "It is just a wrapper div" is not an exemption; it is the most common place
this rule gets skipped, and it is exactly how a page ends up with three boundaries saying the same
thing.

## Situation Codes

Every situation this module governs carries a code, `SURFACE-IN-SURFACE-<index>`. The code names the
SITUATION; the className column names what that situation emits. They are not the same thing, and two
of them emit no visible boundary at all.

| Code | Situation | className |
|---|---|---|
| `SURFACE-IN-SURFACE-1` | An independent object sits directly on page ground | `rounded-2xl bg-card shadow-surface` |
| `SURFACE-IN-SURFACE-2` | One page-level set of comparable rows | `overflow-hidden rounded-2xl bg-card shadow-surface divide-y divide-border` |
| `SURFACE-IN-SURFACE-3` | A section only names peers that already own boundaries | `bg-background shadow-none` |
| `SURFACE-IN-SURFACE-4` | Nested membership is the same as the host's, ordinary, or unnameable | `bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-5` | A distinct, nameable joined set lives inside an existing surface | `overflow-hidden rounded-xl border border-border bg-transparent shadow-none` |
| `SURFACE-IN-SURFACE-6` | An ordinary local action lives inside an existing surface | `border border-border bg-transparent text-foreground` |

The codes are ordered the way a reader meets them: from the page ground inward. Codes `1`–`3` decide
what the page itself may draw; codes `4`–`6` decide what may be drawn once a surface already exists
around you.

`SURFACE-IN-SURFACE-4` IS A SITUATION, NOT A DECORATION. `bg-transparent shadow-none` is the written
proof that the container was classified and found to own nothing — it is not a leftover, and it is
not the same fact as "no class was considered". A flat container that also carries a border has not
followed this code; it has silently switched to `SURFACE-IN-SURFACE-5` without proving the
membership that code requires.

There is no code for "a nested non-list group". That absence is deliberate, not an oversight: the
only nested membership this vocabulary admits is a **joined set of comparable members**. A nested
group of unlike parts is `SURFACE-IN-SURFACE-4` until repeated real cases justify a rule change.

## Inputs

| Input | Evidence required |
|---|---|
| `host` | `page` · `card` · `outlined-group` · `overlay` — what already owns a boundary around this container |
| `child` | `ordinary-content` · `independent-group` · `peer-surfaces` · `joined-rows` · `single-control` |
| `membership` | `same-as-host` · `distinct-and-nameable` · `unknown` |
| `action-priority` | `ordinary-local` · `separately-proven-primary` · `unknown` |

`host`, `child` and `membership` decide the boundary. `action-priority` is consulted only for
`SURFACE-IN-SURFACE-6`, and only the [action sense](../../../senses/call-to-action/INDEX.md) may raise
it. No gap, padding, margin or inset value is an input or an output of this module.

A membership is **nameable** when you can state its name, its members, its own state and its own
outcome. DOM nesting is not evidence of membership; a `div` that exists to hold a flex direction has
no members and no outcome.

## Invariants

- A boundary exists only for a nameable membership claim.
- Page elevation and nested outline are mutually exclusive. Elevation never carries a border, and an
  outline never carries a shadow.
- A page surface uses `bg-card`; page ground uses `bg-background`.
- A nested boundary uses one `border-border`, transparent ground and no shadow.
- Duplicate membership and unknown membership both resolve to `SURFACE-IN-SURFACE-4`.
- A section whose children already own boundaries claims none of its own.
- An overlay already owns its task boundary; its ordinary content is flat.
- A single control is never wrapped in a surface. A control is not a group.
- An ordinary nested action stays secondary; only the action sense may promote it.
- Ready, loading, empty, error and responsive states preserve boundary ownership. The object count a
  skeleton draws equals the object count the settled content draws.
- One container makes at most one boundary claim; two claims about one membership need nesting, not
  a longer className.
- Spacing, inset and external offset are outside this module.
- Every rendered container resolves to exactly one code. No composition is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **The host already names the nested set.** Still `SURFACE-IN-SURFACE-5`; the duplicate visible
  label inside the outline may be suppressed. The boundary stays because the membership is still
  distinct — only the second label is redundant.
- **Membership cannot be named.** `SURFACE-IN-SURFACE-4`, always. If a boundary is still wanted, ask
  exactly one question — *which group does this boundary own that the host does not?* — and stop.
- **An ordinary action inside a surface.** `SURFACE-IN-SURFACE-6`, even when it is the only control
  present and even when it sits bottom-right.
- **Primary promotion requested.** Keep `SURFACE-IN-SURFACE-6` until the
  [action sense](../../../senses/call-to-action/INDEX.md) proves one host-level primary outcome.
- **Two bordered objects touch.** Keep the boundaries separate. Adjacency is not membership; only row
  comparability turns them into `SURFACE-IN-SURFACE-2`.
- **State change.** Loading, empty and error renders keep the code the settled render has. A skeleton
  that flattens a card, or an error state that promotes a flat block into a card, is lying about
  ownership while the user is least able to check.

## Output

```text
host: <page | card | outlined-group | overlay>
child: <ordinary-content | independent-group | peer-surfaces | joined-rows | single-control>
membership: <same-as-host | distinct-and-nameable | unknown>
situation: <SURFACE-IN-SURFACE-1 … SURFACE-IN-SURFACE-6>
className: <exact className from the Situation Codes table>
reason: <host and membership fact that excludes the adjacent code>
removed: <the duplicate boundary this decision deletes, or none>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions, request mapping and boundary discrimination of every code, and `audit.md` only
while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup. The
colour words `bg-card`, `bg-background`, `border-border` and `text-foreground`, and the elevation
word `shadow-surface`, are semantic tokens each front end defines for itself: a card ground, a page
ground, one boundary colour, one foreground colour and one surface elevation.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
