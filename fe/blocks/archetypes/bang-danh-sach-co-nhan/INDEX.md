---
id: fe-blocks-archetypes-bang-danh-sach-co-nhan-index
title: INDEX.md
slug: /fe/blocks/archetypes/bang-danh-sach-co-nhan
sidebar_label: bang-danh-sach-co-nhan
sidebar_position: 0
description: The anatomy of the most common block shape — a set of comparable rows under one name, assembled in a fixed order.
---

# INDEX.md

Version: `2.00` · Module: `bang-danh-sach-co-nhan` · Archetype: `A1` · Live instances: **11 and more**

## Law

**A set of comparable peers under one name is one joined list, and the list — not the block — holds
the shape of a row.**

The block decides which rows exist and what each cell says. Everything that makes the rows a *set* —
the column template, the resting count, the dividers, the corner treatment — belongs to the contract,
so it cannot drift row by row or block by block.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A1-1` | Assembling the presentational half | imports (branches → composites → leaves → contracts) → `XData` → `XActions` → `XProps` → sub-view → `_X` → `meta`, in that order |
| `A1-2` | The list body | a private sub-view wrapped in `defineContractComponent("<list-contract>")` |
| `A1-3` | Rendering before data arrives | resting rows generated from `CONTRACTS[key].children.<slot>.restingCount` |
| `A1-4` | Empty or failed | return early with `SurfaceCard contract="empty-notice-card"` wrapping `EmptyNotice`, label unchanged |
| `A1-5` | The list lives inside the block's own card | inner `SurfaceListCard` with `isNested: true`, outer owner named |
| `A1-6` | Rows carry actions | an index signature keyed `action:${row.id}` |

`A1-1` IS NOT A STYLE PREFERENCE. It is the order every instance already uses, and it is what makes
one block readable to someone who has read another: the unrenderable states return first, and the
ready tree is last.

## Inputs

| Input | Evidence required |
|---|---|
| `listContract` | The contract key of the joined list |
| `rowContract` | The contract key of one row |
| `restingCount` | Read from the registry, never chosen |
| `rowId` | The stable id every action key is built from |
| `states` | At minimum `pending`, `empty`, `failed`, `ready` |

## Invariants

- Rows are comparable peers. A list of unlike things is not this archetype.
- The block never writes a column width or a row count.
- Resting rows are correctly typed fake data, so the pending tree and the ready tree are one tree.
- The empty branch replaces the surface; it never nests one — [`b1`](../../laws/b1-one-surface-owner/INDEX.md).
- If the label is hidden, an enclosing owner draws that exact resolved label —
  [`b9`](../../laws/b9-list-label-owner/INDEX.md).

## Exceptions

- **A list that hides its label.** Legal only under `b9`; two live instances, one of them wrong.
- **A list whose rows are not fetched but supplied.** That is `A4`, not this archetype: the data
  belongs to the caller.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The fixed assembly order of the presentational half | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:26-60` | — |
| Resting count read from the registry | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:46` | — |
| The early return for empty and failed | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:62-66` | — |
| The nested list inside the block's own card | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:93-108` | — |
| Row actions keyed by row id | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:53` | — |
| The list contract holds the column template and states why | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1551-1559` | — |
| Comparable peers are joined, not separated into cards | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-review-identity-cards.md:305` | "User yêu cầu \"dính lại vào nhau kiểu surface list card\"." |

## Scope

This module decides the shape of a labelled list block. Which element renders each cell is
[`b2`](../../laws/b2-chip-or-text/INDEX.md); how the columns align is
[`b7`](../../laws/b7-repeat-alignment/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change. A new anatomy step is a minor bump and
must arrive with a shipped instance.
