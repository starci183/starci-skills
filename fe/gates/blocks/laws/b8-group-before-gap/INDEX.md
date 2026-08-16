---
id: fe-blocks-laws-b8-group-before-gap-index
title: INDEX.md
slug: /gates/blocks/laws/b8-group-before-gap
sidebar_label: b8-group-before-gap
sidebar_position: 0
description: Binding rules that a semantic group is named before any spacing is chosen, and that spacing never substitutes for structure.
---

# INDEX.md

Version: `2.00` · Module: `b8-group-before-gap` · Law: `B8` · Refusals: **5 across 3 records**

## Law

Name the group first; choose the spacing second. Spacing cannot substitute for structure.

Two things sit close because they belong together, not because the screen felt crowded. A layout
tuned by adjusting distances until it looks right has no stated relationships, so the next change
breaks it and nobody can say why.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B8-1` | Several children under one parent | name the group in the contract, with a `why`, before any spacing is set |
| `B8-2` | One flat spacing applied across all descendants | refused — nest the groups that actually exist |
| `B8-3` | The screen feels crowded | the answer is composition and reading order, not a smaller gap |
| `B8-4` | Two ideas need separating | two named groups inside one surface, not two nested cards |
| `B8-5` | The contract already states a spacing that feedback contradicts | the contract is a stale belief; update the class **and** the `why` |
| `B8-6` | Two named groups must be ordered | in anything the reader buys from, the **payable figure precedes the promise** |

`B8-5` EXISTS BECAUSE THE CONTRACT IS NOT AN ORACLE. It records the last accepted belief. Binding
feedback outranks it, and updating the class without updating the `why` leaves a lie in the registry.

`B8-6` EXISTS BECAUSE NAMING GROUPS IS NOT ENOUGH. Two correctly named groups can still be read in
the wrong order, and this shelf had no rule about order between groups until a blind build had to
invent one. The rule is narrow on purpose: it covers the commerce case, where the reader is deciding,
and it says nothing about ordering elsewhere.

## Inputs

| Input | Evidence required |
|---|---|
| `parent` | The contract key that owns these children |
| `relationships` | For each adjacent pair, what the relationship is, in words |
| `why` | The sentence the contract entry will carry explaining why these children sit together |

## Invariants

- Every contract entry carries `children`, `classes` and a `why`. The `why` is mandatory: it explains
  why these children are neighbours.
- One parent expresses one relationship. A parent mixing several must nest, never average.
- Spacing is a member of a closed vocabulary, so it is chosen from a scale, not invented.
- Structure changes are structural: they change the tree, not only the numbers.

## Exceptions

- **A group that already has dividers and row padding.** The rhythm lives inside the row, so the
  parent declares no spacing at all. This is a spacing decision that emits nothing.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Spacing follows the semantic relationship, not container convenience | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:777` | "Spacing follows semantic relationship, not container convenience." |
| A flat spacing over unlike children is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:501` | "Scarcity không thuộc cùng thought group với phép tính giá." |
| Crowding is answered by composition, not by a smaller gap | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-pricing-rail-density-r1.md:116` | "User nói nội dung ổn nhưng muốn `thay cách render cho gọn`, không chỉ ép spacing." |
| Two ideas become two named groups in one surface | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-pricing-rail-rebrainstorm.md:386` | "Group card/radius owner đã bị feedback trước bác; intent separation đến từ hierarchy, không từ card lồng card." |
| A contract spacing is a belief that can be stale | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:631` | "Contract là belief có thể stale khi binding feedback chứng minh ngược lại." |
| Every contract entry carries a mandatory `why` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1551-1555` | — |

## Scope

This module decides that the group is named and where the boundary between structure and spacing
lies. **Which** spacing value is [`gates/principles/gap`](../../../principles/gap/INDEX.md), and this
module never states one.

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
