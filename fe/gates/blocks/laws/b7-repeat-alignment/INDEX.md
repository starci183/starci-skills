---
id: fe-blocks-laws-b7-repeat-alignment-index
title: INDEX.md
slug: /gates/blocks/laws/b7-repeat-alignment
sidebar_label: b7-repeat-alignment
sidebar_position: 0
description: Binding rules for repeated rows — one grid template, resting counts from the registry, and content that opens flush with its trigger.
---

# INDEX.md

Version: `2.00` · Module: `b7-repeat-alignment` · Law: `B7` · Refusals: **5 across 2 records**

## Law

In a repeated block, **columns line up across every row**, and content that opens sits flush with
the trigger that opened it.

Alignment is not neatness. A column that does not line up destroys the only thing a repeated list is
for — comparison across rows.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B7-1` | Rows must line up | one grid template, held by the row contract; the block never touches it |
| `B7-2` | Content expands under a trigger | it opens flush with the trigger; no inherited panel offset |
| `B7-3` | The list must render before data arrives | the resting row count is read from the registry, never chosen by the block |
| `B7-4` | An element at the row end has variable width | it is fixed-width, or it moves out of the aligned column |
| `B7-5` | Each row has its own actions | actions are keyed by row id, not by named callbacks |
| `B7-6` | The set is short, fixed, and has no state of its own | it is **one leaf taking an array**, not a repeating slot — and therefore has no `restingCount` at all |
| `B7-7` | The registry must state a `restingCount` | the number is the **typical** row count of one real response, not a guess and not a maximum |

`B7-6` IS WHERE INVENTED NUMBERS COME FROM. A slot that does not repeat has no resting count, and a
blind build asked to supply one will produce a plausible number for a list that never varies. Ask
first whether the set is fetched at all; a fixed set of three is a leaf's argument.

`B7-7` MATTERS BECAUSE THE NUMBER IS VISIBLE. Three scored blind builds guessed three resting counts
and missed all three. The count is what a reader sees while waiting, so a count far from the typical
response makes the page jump when the data lands.

## Inputs

| Input | Evidence required |
|---|---|
| `rowContract` | The contract key holding the grid template |
| `restingCount` | `CONTRACTS[key].children.<slot>.restingCount` — read, not chosen |
| `endElement` | What sits in the last column, and whether its width varies with content |
| `rowId` | The stable id every action key is built from |

## Invariants

- The grid template lives in exactly one place, and it is the row contract.
- A block never writes a column width, a column count, or a resting row count.
- Resting rows are **correctly typed fake data**, not a second skeleton component.
- An expanded panel inherits no default indent from its vendor container.
- A variable-width element never sits in a column that other rows must align to.

## Exceptions

- **A localized sentence at the row end.** Refused as a badge, because its width differs on every
  row. It becomes a fixed-width caret, and the sentence survives as the accessible label.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Expanded content is flush with the trigger | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:71` | "Thầy xác nhận phần xanh không được có offset." |
| Rows sit tight and take their inset from the group, not the vendor | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:359` | "Nội dung expand dễ quét và đúng feedback về density." |
| One grid template per repeated row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1557` | — |
| The contract states why the columns exist | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1559` | — |
| Resting count is read from the registry | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:46` | — |
| A variable-width badge broke the column and was replaced by a fixed caret | neo CODE | `D:\Repositories\starci-academy-fe\src\components\composites\RankedUserRow\index.tsx:58-61` | — |
| Row actions keyed by row id | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:53` | — |

## Scope

This module decides alignment mechanics for repeated rows. It does not decide the gap between rows,
which is [`gates/principles/gap`](../../../principles/gap/INDEX.md), nor what each cell renders, which
is [`b2`](../b2-chip-or-text/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
