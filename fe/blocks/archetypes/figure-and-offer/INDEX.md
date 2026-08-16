---
id: fe-blocks-archetypes-figure-and-offer-index
title: INDEX.md
slug: /fe/blocks/archetypes/figure-and-offer
sidebar_label: figure-and-offer
sidebar_position: 0
description: The anatomy of a card that tells one story about one figure and offers one action that changes it.
---

# INDEX.md

Version: `2.00` · Module: `figure-and-offer` · Archetype: `A3` · Live instances: **6**

## Law

**One card, one figure, one story, and one action whose outcome changes that figure.**

What separates this from a list is dominance: there is a hero the eye lands on, and everything else
qualifies it. What separates it from a plain card is that the action's outcome is the point.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A3-1` | The card frame | one `SurfaceCard` holding the label and any see-more |
| `A3-2` | The body | one hero composite — a standing row, a podium, a calendar |
| `A3-3` | Supporting rows | optionally a nested `SurfaceListCard` with `isNested: true` and `isLabelHidden: true`, reusing the outer label |
| `A3-4` | The action | its own pending flag, held outside `state` |
| `A3-5` | Settling | the four-rung ladder `failed → pending → empty → ready` |
| `A3-6` | The action has already been taken | a different tree — a claimed badge in place of the button, not a disabled button |

`A3-6` IS THE ARCHETYPE'S SIGNATURE. The control is **absent**, not disabled, once its outcome has
been taken. Absence says "there is nothing here for you"; a disabled button says "there is something
here you may not have", which is a different and usually false sentence.

## Inputs

| Input | Evidence required |
|---|---|
| `figure` | The one number or standing the card is about |
| `heroComposite` | The composite that draws it |
| `action` | The mutation, and proof it exists |
| `actionPending` | The flag name, held outside `state` |
| `outcomeStates` | The business states around the action: available, taken, not yet earned |

`action` requires **proof the mutation exists**. A card offering an outcome with no mutation behind
it has a dead branch, and the plan says so rather than drawing a button.

## Invariants

- One hero. Two figures of equal weight is `A1`, not `A3`.
- The nested list, when present, reuses the outer label rather than naming itself again.
- The action's flag never enters `state`; `state` stays the business situation.
- The empty and failed branches replace the card body, keeping the label.

## Exceptions

- **A card whose action is navigation.** Still `A3`; a see-more is not a mutation and carries no
  pending flag.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The four-rung settle ladder | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\index.tsx:31-37` | — |
| The action's own flag, outside `state` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\index.tsx:24` | — |
| Claimed draws a badge where the button was | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\component.tsx:127` | — |
| The nested supporting list | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\component.tsx:143` | — |
| Three pending owners rather than one shared state | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1623` | "Spinner sai nút làm người dùng hiểu sai request đang chạy." |

## Scope

This module decides the shape of a summary card. Whether the nested list may exist is
[`b1`](../../laws/b1-one-surface-owner/INDEX.md); whether its label may be hidden is
[`b9`](../../laws/b9-list-label-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change.
