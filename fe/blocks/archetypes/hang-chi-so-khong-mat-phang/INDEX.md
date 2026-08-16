---
id: fe-blocks-archetypes-hang-chi-so-khong-mat-phang-index
title: INDEX.md
slug: /fe/blocks/archetypes/hang-chi-so-khong-mat-phang
sidebar_label: hang-chi-so-khong-mat-phang
sidebar_position: 0
description: The anatomy of a single standing figure on a bare rail — the archetype that deliberately draws no surface.
---

# INDEX.md

Version: `2.00` · Module: `hang-chi-so-khong-mat-phang` · Archetype: `A2` · Live instances: **4**

## Law

**One figure, one request, one row — and no surface, because the region already declared itself
bare.**

This archetype exists to be the smallest settling unit in the product. Its whole purpose is that it
answers alone: the wallet does not wait for the AI quota, and the streak does not wait for either.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A2-1` | The block draws its body | exactly one `IconLabelFactRow`, `recipe: "peer"` — and zero imports from `components/branches/` |
| `A2-2` | Declaring props | a discriminated union where each branch carries only its own data |
| `A2-3` | The connected half settles | compute `hasFailed` first, then `isLoading`, then fold failure into the invisible branch |
| `A2-4` | Nothing to show | return `null`, with the viewer condition written in the docstring |
| `A2-5` | Two figures are wanted | two blocks — never one block reading two requests |

`A2-4` IS ONLY LEGAL HERE BECAUSE THE REASON IS WRITTEN. Four blocks fold failure into an invisible
render, and each states that a signed-out reader is meant to see exactly that. Remove the sentence
and the block becomes a `b4` violation.

## Inputs

| Input | Evidence required |
|---|---|
| `figure` | The one value the row states |
| `request` | The single hook this block reads |
| `icon` | The closed icon name |
| `viewerCondition` | What makes the invisible branch correct |

## Invariants

- Zero branch imports. The rail's bareness is declared by the region contract, not by each block.
- One request. Two requests means two blocks.
- The union is discriminated so the data of a branch the block is not in cannot be passed.
- `isLoading` is written by the block, never received.

## Exceptions

- **A rail row with an action.** None exists today. If one appears, the action carries its own
  pending flag under [`b11`](../../laws/b11-pending-owner/INDEX.md), and the row is still `A2`.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| One row, one recipe, no branch import | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\component.tsx:12-23` | — |
| A discriminated union carrying per-branch data | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\component.tsx:3-10` | — |
| Failure read first, then folded into the invisible branch | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:22-28` | — |
| One request, one settling unit, with the measured cost of merging | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:11-13` | — |
| The rail is declared bare by the region contract | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1056-1061` | — |

## Scope

This module decides the shape of a surface-less figure row. Whether the figure is a chip or text is
[`b2`](../../laws/b2-chip-or-text/INDEX.md); whether the invisible branch is legal is
[`b4`](../../laws/b4-empty-is-a-state/INDEX.md) and
[`b12`](../../laws/b12-error-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change.
