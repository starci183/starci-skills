---
id: fe-blocks-laws-b6-one-owner-two-hosts-index
title: INDEX.md
slug: /fe/blocks/laws/b6-one-owner-two-hosts
sidebar_label: b6-one-owner-two-hosts
sidebar_position: 0
description: Binding rules for when two places that look alike must share an owner, and when identical markup must still stay apart.
---

# INDEX.md

Version: `2.00` · Module: `b6-one-owner-two-hosts` · Law: `B6` · Refusals: **8, in two halves**

## Law

Two places that show the same thing share **one real owner**. But looking alike is not enough to
merge: the shared **visual row** is merged, the differing **interaction host** stays apart.

Both halves are one law, and quoting only one half is how this rule keeps getting broken. Half one
alone produces six private copies of the same row. Half two alone produces a generic component with
nine flags.

## Situation Codes

| Code | Situation | Verdict |
|---|---|---|
| `B6-1` | Two places show the same shape, and one already has a proven owner with several consumers | generalize the **proven** owner; do not build a new one from a dead component |
| `B6-2` | A second place renders the same thing with its own private implementation | not reuse — replace it with the shared owner |
| `B6-3` | Two places share markup but differ in selection, focus or result behaviour | keep apart; merge only the inner visual row |
| `B6-4` | One owner must render two arrangements | a `props.recipe` discriminant inside the data, never a new top-level prop |
| `B6-5` | The shared owner needs a name | name it by **shape**, never by its first caller |
| `B6-6` | A merge is proposed | every existing consumer enters the parity matrix, or the merge is not trustworthy |

## Inputs

| Input | Evidence required |
|---|---|
| `candidates` | Every component rendering this shape, `file:line`, including the dead ones |
| `consumerCount` | How many call sites each candidate already has |
| `interactionAnatomy` | `read-only` · `selection` · `roving-focus` · `result-navigation` per candidate |
| `variantAxis` | What actually differs — arrangement, or behaviour |

`consumerCount` decides `B6-1`: a component with six live consumers is proven and a component with
none is dead, and generalizing the dead one throws away the proof.

`interactionAnatomy` decides `B6-3`. If two candidates differ here, the answer is never "one
component with a flag".

## Invariants

- A shared owner is the one with real consumers, renamed to its shape if its old name was a caller's
  name.
- A variant lives in `props`, as a closed discriminant. Composite props admit only `props`, `on` and
  `isLoading`, so a top-level variant prop is not merely discouraged — it does not typecheck.
- A merge that omits an existing consumer is refused, because parity was never proven for it.
- Identical markup plus different interaction is **two** owners, and the tree records why.
- A private implementation that happens to look the same is a defect, not an implementation choice.

## Exceptions

- **Search result rows.** Explicitly kept apart from the generic row: result rows own title, kind
  and indicator, and a different reading behaviour. This is the canonical `B6-3`.
- **The list wrapper.** Only the visual row was merged; the surrounding list, which owns selection
  and focus, stayed separate.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Generalize the proven owner, not the dead one | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:434` | "User chỉ ra \"Chuỗi ngày học\"; source xác nhận StatRow đã sở hữu đúng glyph–label–fact shape với nhiều consumers." |
| Every existing consumer enters the parity matrix | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:435` | "Generic owner chỉ đáng tin khi mọi consumer hiện hữu được chứng minh parity." |
| Different interaction anatomy stays apart | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:331` | "Result rows own title/kind/indicator and different reading behavior." |
| Merge only the visual row, not the whole list | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:108` | "Interaction/selection/result anatomy khác purpose và merge toàn list sẽ cần nhiều flags." |
| A variant is a data discriminant, not a top-level prop | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:330` | "CompositeProps permits only props/on/isLoading." |
| Name by shape, not by first caller | neo TỪ CHỐI | `.workflows\consolidation\starci-academy\generic-action-row.md:109` | "Tên theo caller đầu tiên trở thành sai khi consumer thứ hai dùng cùng shape." |
| A same-looking private implementation is not reuse | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1084` | "User yêu cầu render y chang \"điểm nổi bật\"; same-looking duplicate không phải reuse." |
| Fixing label ownership while keeping a private checklist is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:999` | "User yêu cầu render y chang catalog; same-looking private implementation không phải reuse parity." |
| The merged owner, distinguished by `recipe` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\composites\IconLabelFactRow\index.tsx:1` | — |
| The kept-apart branch, in one leaf, two anatomies | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\SelectionList\index.tsx:73-102` | — |

## Scope

This module decides ownership across places. It does not decide what the row renders, which is
[`b2`](../b2-chip-or-text/INDEX.md), nor how its columns line up, which is
[`b7`](../b7-repeat-alignment/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
