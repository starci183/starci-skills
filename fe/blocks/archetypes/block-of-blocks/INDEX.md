---
id: fe-blocks-archetypes-block-of-blocks-index
title: INDEX.md
slug: /fe/blocks/archetypes/block-of-blocks
sidebar_label: block-of-blocks
sidebar_position: 0
description: The anatomy of a region assembled from child blocks that each settle on their own.
---

# INDEX.md

Version: `2.00` · Module: `block-of-blocks` · Archetype: `A5` · Live instances: **4, plus one tab host**

## Law

**A composer owns the seam between its children and the name over them. Nothing else.**

It has no state, no request and no presentational twin, because there is nothing here to resolve.
Each child settles alone, so the region appears piece by piece rather than at the speed of its
slowest member.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A5-1` | The composer's files | `index.tsx` only — no `component.tsx`, no `_X` twin |
| `A5-2` | The body | exactly one `Tree` with the region contract, each slot a projection wrapping a child block mounted with no props |
| `A5-3` | State and requests | none |
| `A5-4` | An overlay outliving one child | the composer may hold it, and that is the only local state it may hold |
| `A5-5` | Declaring the tier | `meta`, and its `world` must match what the file actually does |

`A5-1` IS THE ARCHETYPE'S MOST USEFUL FACT. The absence of the twin is not an omission — the block
tier's underscore convention promises a half with nothing to resolve, and here everything is already
resolved by the children. One composer says exactly this in its own docstring.

## Inputs

| Input | Evidence required |
|---|---|
| `regionContract` | The contract key of the region |
| `children` | The child blocks, in reading order |
| `overlayOwner` | Which component holds an overlay that outlives a child, if any |

## Invariants

- Children mount with no props. If a child needs a prop, that prop is an outcome callback, not data.
- The composer never reads a request.
- The composer never draws a surface; the region contract decides that.
- `meta.world` must be honest. Two composers of the same shape currently declare different worlds.

## Exceptions

- **A composer holding an overlay.** One does: the tab that opens a price overlay keeps the selected
  id, because the overlay outlives the row that asked for it. It is still `A5`, and it is the reason
  `A5-4` exists.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| No twin, because there is nothing to resolve | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\IdentityRail\index.tsx:20-21` | — |
| Children mount with no props, each settling alone | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\IdentityRail\index.tsx:25-38` | — |
| The stated trade: out of step beats held hostage | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\IdentityRail\index.tsx:14-18` | — |
| The overlay exception, held by the composer | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\CoursesTab\index.tsx:20-43` | — |
| The honest-`meta` problem, live | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\CoursesTab\index.tsx:47` | — |
| Every mounted region stays mounted while requests are unresolved | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\pending-gate.test.tsx:99-100` | — |

## Scope

This module decides the shape of a region composer. Which regions exist at all is
[`layouts`](../../../layouts/gate.schema.json); what each child renders is that child's archetype.

## Version Rule

Increment all five records by `0.01` for an accepted change.
