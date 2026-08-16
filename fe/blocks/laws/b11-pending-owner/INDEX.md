---
id: fe-blocks-laws-b11-pending-owner-index
title: INDEX.md
slug: /fe/blocks/laws/b11-pending-owner
sidebar_label: b11-pending-owner
sidebar_position: 0
description: Binding rules that every action owns its own waiting flag, and that one block is one settling unit.
---

# INDEX.md

Version: `2.00` · Module: `b11-pending-owner` · Law: `B11` · Refusals: **1**

## Law

Every action owns **its own** pending flag. One shared loading flag across several actions is wrong.

> Spinner sai nút làm người dùng hiểu sai request đang chạy.

The corollary runs the other way too: one block is **one settling unit**. Three requests settle at
three moments, so they are three blocks.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B11-1` | A block has several actions | each carries its own flag, named for what it is doing |
| `B11-2` | A repeated block has one action per row | the block holds the pending **row id** and compares per row |
| `B11-3` | One component reads several requests | split it — one block per settling unit |
| `B11-4` | An item's own mutation is running | the mutation flag **overrides** the state the caller gave; it does not become a new state |
| `B11-5` | The request key is unresolved | the block renders loading, and specifically **not** empty |
| `B11-6` | A control is about to be drawn | its mutation must be **proved to exist** first; without one the branch is dead and the plan reports missing backend |
| `B11-7` | The block renders its resting tree | **every** leaf in it receives `isLoading` — buttons and links included |

`B11-6` HAS A LIVE CASE. One card carries a `claimable` branch that cannot be reached from the
running app, because no claim mutation exists anywhere in the repository. A control with no mutation
is a promise the product cannot keep, and it is cheaper to report the gap than to draw the button.

`B11-7` IS WHY A RESTING TREE MUST BE ONE TREE. A real button carrying an empty label is not a
resting state — it is a button the reader can press into nothing.

`B11-3` HAS A MEASURED COST. A component once read three requests and gave them one flag between
them, so a wallet answering in 80ms waited on an AI quota taking 600ms. The split was not tidiness;
it was 520ms of a figure the reader already had.

## Inputs

| Input | Evidence required |
|---|---|
| `actions` | Every action the block emits |
| `pendingOwner` | Per action: `rieng-cua-hanh-dong` · `rieng-tung-dong-theo-id` · `co-chung-ca-khoi` |
| `settlingUnits` | How many independent requests this block reads — more than one is a finding |
| `rowId` | For repeated blocks, the id the pending comparison is keyed on |

## Invariants

- A block's own action flag lives beside the action, not inside `state`.
- A per-row flag is a comparison against a held id, never a boolean for the whole list.
- One block reads one request. Two requests in one block is a split, not a merged flag.
- A mutation running on a caller-parameterised item overrides the given state for the duration.
- Loading and empty are never the same render.

## Exceptions

- **A step panel.** Each button reads its own `isPending` from props; the panel's step machine is
  separate from any of them.
- **The mobile twin of a rail.** It borrows the rail's state so both quote the same figure. This is
  one settling unit rendered twice, not two units sharing a flag.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Three separate pending owners, not one shared state | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1623` | "Spinner sai nút làm người dùng hiểu sai request đang chạy." |
| One request, one settling unit — with the measured cost of merging | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:11-13` | — |
| A per-row pending id compared row by row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\MyCoursesProgress\index.tsx:55-60` | — |
| An action flag held beside the action, outside `state` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\index.tsx:24` | — |
| Loading is proven distinct from empty by test | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\pending-gate.test.tsx:92-97` | — |

## Scope

This module decides who waits. Whether the wait is a state at all is
[`b10`](../b10-state-enumeration/INDEX.md); what renders while waiting is the archetype module.
Its output is the `actions[].pendingOwner` array of [`gate.schema.json`](../../gate.schema.json).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
