---
id: fe-blocks-laws-b13-closed-data-index
title: INDEX.md
slug: /gates/blocks/laws/b13-closed-data
sidebar_label: b13-closed-data
sidebar_position: 0
description: Binding rules that a block accepts closed data and never an arbitrary node, and never receives a loading flag it should be writing.
---

# INDEX.md

Version: `2.00` · Module: `b13-closed-data` · Law: `B13` · Refusals: **3**

## Law

A block accepts **closed data**. It never accepts `ReactNode`, never accepts `children`, and never
lets the caller decide what appears inside it.

> Arbitrary content makes it a branch and violates the closed data fence.

The second half of the same contract: a block **writes** the loading flag when it hands a tree down.
It never receives one.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B13-1` | The caller wants to supply content | refused — the block takes data and renders it itself |
| `B13-2` | A slot needs arbitrary end content | it becomes a closed fact field, typed as data |
| `B13-3` | Something genuinely must pass an interior through | only a shell may, and only two shells do |
| `B13-4` | Two arrangements are needed | a closed discriminant in `props` — see [`b6`](../b6-one-owner-two-hosts/INDEX.md) |
| `B13-5` | The block needs to know it is loading | it computes that itself and writes it downward; receiving it is refused |

`B13-5` IS THE HALF THAT IS STILL BROKEN. Five blocks accept `isLoading` in their public props, and
no lint rule catches it.

## Inputs

| Input | Evidence required |
|---|---|
| `publicProps` | Every field of the block's public data type |
| `nodeFields` | Any field typed `ReactNode`, `ReactElement`, `children`, or a render function |
| `loadingDirection` | `khoi-tu-viet-xuong` · `nhan-tu-noi-goi` |

## Invariants

- Zero `ReactNode` and zero React `children` props in the block tier. The only `children`
  occurrences are the contract registry's own field.
- A closed fact replaces arbitrary content: text in, rendering owned by the contract.
- Only `ModalShell` and `DrawerShell` are shells and may expose React `children`; they pass the
  interior through without arranging it.
- A block computes `isLoading` and passes it down.

## Exceptions

- **Shells.** Named, closed, and two of them.
- **A block that renders another block's outcome.** It receives the outcome as data — an id, a
  label, a state — never as a rendered node.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Arbitrary content turns a component into a branch | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:329` | "Arbitrary content makes it a branch and violates the closed data fence." |
| The same, at the composite tier | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:200` | "Giữ composite data fence và typography ownership." |
| And once more at approval | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:508` | "Giữ composite data fence." |
| A block writes the loading flag and never receives one | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\props.ts:211-217` | — |
| The closed two-slot shape of a block's presentational half | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\props.ts:219-222` | — |
| A live `B13-5` violation | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\search\GlobalSearchResults\component.tsx:32` | — |

## Scope

This module decides the shape of what crosses into a block. What the data says is `copy` and
`fields`; who may draw a surface around it is [`b1`](../b1-one-surface-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
