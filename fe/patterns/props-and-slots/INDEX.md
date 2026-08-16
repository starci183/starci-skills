---
id: fe-patterns-props-and-slots-index
title: INDEX.md
slug: /fe/patterns/props-and-slots
sidebar_label: props-and-slots
sidebar_position: 0
description: Binding rules for what a component may accept — a closed set of named slots, written as one alias per tier.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `props-and-slots`

## Law

A component's props are a CLOSED set of named slots, and that set is written as a type alias per
tier rather than assembled per component. What a caller may hand a component is therefore not a
convention anybody has to remember — it is the only thing that compiles.

The distinction that decides everything below: **a rule is correct today; a fence is correct next
month.** An interface spelling out `props` and `isLoading` is a rule — correct when written, one
`extends` away from carrying a caller's own styling. An alias that IS the whole shape is a fence:
there is nowhere to put a fourth slot, so an author who wanted one has to decide which tier they are
actually writing.

Five slots exist across the whole system and no component has all five. `props` is what it draws.
`on` is what it does. `contract` is the key it renders and `render` is one named component per slot
that key declares — having those two is what makes a container a container. `isLoading` is handed
down, never decided locally.

**This is binding, not advisory.** Every component that accepts anything at all has a slot
situation, and that situation has a code below. "It only takes one prop" is not an exemption; it is
where the fence is most often replaced by a hand-written shape that looks the same on the day it is
written.

## Situation Codes

Every situation this module governs carries a code, `SLOTS-<n>`. The code names the SITUATION; the
tier alias names what that situation emits. The numbers are stable and cited from outside this
module, so they are never renumbered when the list changes.

| Code | What it requires | What it forbids |
|---|---|---|
| `SLOTS-1` | The data slot carries data — whatever a JSON document could hold | A function, a component or any value carrying behaviour inside `props` |
| `SLOTS-2` | A component's data is declared with a type alias | `interface` for a data shape |
| `SLOTS-3` | A parameter takes one named type, `XProps` for component `X` | An inline object type, or an intersection assembled at the parameter |
| `SLOTS-4` | A container declares `contract` and `render`; a closed shape declares neither | A markup hole outside the closed shells; `render` on a closed shape |
| `SLOTS-5` | A component below the request owner receives `isLoading` | A component deciding its own waiting state |
| `SLOTS-6` | Appearance is a named variant decided inside | `className`, `style`, spacing props, per-part styling hooks |
| `SLOTS-7` | A shared list surface receives collections under their domain name inside `props` | A generic top-level `items` lane on that surface |

There is no `SLOTS-8`. The list runs `SLOTS-1` through `SLOTS-7`, and a gap in the numbering would
mean a code was retired, not that one is missing — see `audit.md`.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or an alias that is the
whole shape makes the wrong value impossible to write; `enforced` means a named rule in
[`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs) reports it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by | What still escapes |
|---|---|---|---|
| `SLOTS-1` | `unrepresentable` | `DataValue` in [`sources/fe/props.ts`](../../../sources/fe/props.ts) — a closed union with no function member | Nothing, wherever the tier alias is used |
| `SLOTS-2` | `unrepresentable` | The `D extends ComponentData` constraint on every tier alias | The error lands at the slot, not at the `interface`; a data type never passed through a slot compiles |
| `SLOTS-3` | `enforced` | `no-inline-parameter-type` | A named type that is not `XProps` for component `X` — the name is read, not checked |
| `SLOTS-4` | `enforced` | `no-children-slot`, plus `BranchProps` for the positive half | The rule sees the markup hole; nothing sees a closed shape that grows `render` |
| `SLOTS-5` | `documented` | Nothing. `BlockProps` proves a block never RECEIVES the flag; nothing proves a leaf never DECIDES it | Any local waiting state a component computes for itself |
| `SLOTS-6` | `unrepresentable` | The three closed tier aliases carry no appearance member, and JSX refuses an unknown attribute | A hand-written props type that never used a tier alias |
| `SLOTS-7` | `enforced` | `no-surface-list-items-slot` | Any other shared surface — the rule is bound to one import path |

Four codes are held by a type and three by a rule, which is the arrangement this law wants and not a
coincidence: a shape that refuses is stronger than a rule that reports, and the rules exist exactly
where a type has nothing to look at. `SLOTS-3` is the clearest case — every constraint the alias
imposes is satisfied by an inline shape, and it is still wrong, because the wrongness is not which
fields exist but that nothing else can refer to them.

## Anchor

Each code, and real code it can be checked against.

| Code | Path | What to look for |
|---|---|---|
| `SLOTS-1` | [`sources/fe/props.ts`](../../../sources/fe/props.ts) | The `DataValue` union and `ComponentData`; confirm no member is a function type, then try to assign a handler to `props` |
| `SLOTS-2` | [`sources/fe/props.ts`](../../../sources/fe/props.ts) | `LeafProps<D extends ComponentData>`; declare a data shape with `interface` and pass it in — the constraint fails |
| `SLOTS-3` | [`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs) | `isInlineObjectType`, which walks intersections and parentheses, and the invalid fixtures in [`props-and-slots.test.mjs`](../../../sources/fe/props-and-slots.test.mjs) |
| `SLOTS-4` | [`sources/fe/props.ts`](../../../sources/fe/props.ts) · [`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs) | `BranchProps` carrying `contract` + `render` and no markup hole; then `CHILDREN_SHELLS` and `isGoverned` for the exempt shells and the tiers the rule governs |
| `SLOTS-5` | [`sources/fe/props.ts`](../../../sources/fe/props.ts) | `BlockProps` — two slots, no `isLoading`, which anchors the RECEIVED half only. The DECIDED half is `chưa neo được` |
| `SLOTS-6` | [`sources/fe/props.ts`](../../../sources/fe/props.ts) | `LeafProps`, `CompositeProps`, `BranchProps`; confirm there is no appearance member and no index signature that would admit one |
| `SLOTS-7` | [`sources/fe/props-and-slots.mjs`](../../../sources/fe/props-and-slots.mjs) · [`sources/fe/props.ts`](../../../sources/fe/props.ts) | `noSurfaceListItemsSlot` — the import-source test that binds it, and the `items` attribute check; then `ContractRenderBranchProps`, where runtime data stays in `props` |

An anchor is not decoration. A law that cannot be pointed at in real code is a proposal, and the one
half-anchored row above is the honest cost of keeping `SLOTS-5`.

## Inputs

| Input | Evidence required |
|---|---|
| tier | leaf, composite, branch or block — decided before the props type is written |
| data | The values the component draws, and proof each one is JSON-shaped |
| behaviour | The handlers the component calls, kept out of the data |
| fill | Whether a caller may supply what goes inside, and under which contract key |
| request ownership | Which layer owns the fetch, and therefore which layer writes `isLoading` |
| appearance intent | Any styling the caller wanted, restated as a named variant |

## Invariants

- The alias is the whole shape; there is no fourth slot to add.
- Data and behaviour travel in different slots.
- Every parameter shape has a name in the module that declares it.
- `contract` and `render` appear together or not at all.
- The layer that owns a request writes `isLoading` and never receives one.
- Appearance is decided inside the component, under a name.
- A shared surface learns no caller's collection model.
- One tier alias per component; a component that needs a different one has chosen the wrong tier.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The closed shells.** `SLOTS-4` exempts the shells that hand an interior straight to vendor
  mechanics — modal, drawer and dropdown — because they arrange nothing and cannot refuse a shape
  the vendor declares. The enforcing rule also exempts the route seam that converts what a framework
  layout is handed. No folder-wide exemption exists; the list is four files, by name.
- **The registry table.** `SLOTS-4` does not apply to the contract table itself, where a named child
  grammar describes what a key admits. Reporting it would ask the file that abolished the anonymous
  hole to stop describing what replaced it.
- **Outside the component tiers.** A routed page is not governed by `SLOTS-4`; taking what a
  framework hands it is the one thing a page legitimately does.
- **Two lanes for `render`.** `SLOTS-4` is satisfied by bound slots and by a stable branded component
  type. Which lane applies is decided by whether the runtime data repeats, not by preference.
- **A scalar parameter.** `SLOTS-3` governs shapes. A parameter typed `string` is not a shape with
  nowhere to be read from and needs no alias.

## Output

```text
component: <name>
tier: <leaf | composite | branch | block>
data: <XData, declared with type>
props: <XProps = LeafProps<XData> | CompositeProps<XData> | BranchProps<XData, K> | BlockProps<S, XData>>
slots: <props | props + on | props + on + contract + render | state + props>
situation: <SLOTS-1 … SLOTS-7>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end written in typed components. It names no product, no
component library, no registry key and no repository. Every example is ordinary TSX.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
