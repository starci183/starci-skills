---
id: fe-blocks-laws-b9-list-label-owner-index
title: INDEX.md
slug: /gates/blocks/laws/b9-list-label-owner
sidebar_label: b9-list-label-owner
sidebar_position: 0
description: Binding rules for who renders the name of a list, and the single condition under which that name may be hidden.
---

# INDEX.md

Version: `2.00` · Module: `b9-list-label-owner` · Law: `B9` · Refusals: **2**

## Law

The name of a list surface belongs to the **list branch**. A block does not draw a heading outside
the list and then hide the name inside it.

Hiding is legal in exactly one situation: an enclosing owner already renders **that exact resolved
label**. Not a similar label, not a label that exists only as an accessible name — the same one, on
screen.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B9-1` | A list surface has a name | the branch renders it; the block passes it as data |
| `B9-2` | A page-level heading is drawn and the list's own label is hidden | refused |
| `B9-3` | The list is nested inside a surface that already draws the same resolved label | `isLabelHidden: true` is legal, and the outer owner is named in the plan |
| `B9-4` | A non-list surface member wants label suppression | not available — the field is list-only |
| `B9-5` | The parent contract also declares a title slot | the **branch** emits the label; the parent contract declares shape only, and its title slot stays empty |

`B9-5` IS THE TWO-OWNER PROBLEM. A parent contract can declare a title row and a list branch can
print its own heading, and both look correct in isolation. The live resolution is that the branch
wins: one block's test asserts the parent contract's title node is absent, which is the proof that
the parent declared a shape it does not fill.

`isNested` NEVER IMPLIES `isLabelHidden`. They are two independent claims and the second is decided
here, not in [`b1`](../b1-one-surface-owner/INDEX.md).

## Inputs

| Input | Evidence required |
|---|---|
| `labelKey` | The i18n key that resolves to the label |
| `outerLabelDrawnBy` | The component that renders that resolved label **visibly**, `file:line` |
| `accessibleOnly` | Whether the label exists only as an accessible name |

`accessibleOnly: true` fails `B9-3`. An accessible name is not a rendered label, and hiding a label
nobody draws leaves the list unnamed on screen.

## Invariants

- The branch owns the label. The block supplies its text and never its heading element.
- `isLabelHidden` requires a named outer owner in the plan; the gate refuses it otherwise.
- Suppression covers the duplicate label only. The list keeps every other part of its contract.

## Exceptions

- **A nested list inside a card that already shows the name.** `B9-3`. The leaderboard inside the
  league card is the one clean live instance.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| An external heading plus a hidden list label is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:928` | "BRANCH-9 cấm page-level list ẩn label và xác định branch là owner của label." |
| A page surface must not be forced into nested mode to justify label handling | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1085` | "`isNested` chỉ đúng khi list nằm trong raised catalog card; row/label owner vẫn giống hệt." |
| The branch renders the label and hides it only on the flag | neo CODE | `D:\Repositories\starci-academy-fe\src\components\branches\SurfaceListCard\index.tsx:86-88` | — |
| The field is documented as list-only duplicate suppression | neo CODE | `D:\Repositories\starci-academy-fe\src\components\branches\SurfaceListCard\index.tsx:24-25` | — |
| A clean `B9-3`: outer card draws the same label the inner list hides | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:93-108` | — |
| A live `B9-2`: a label hidden that nobody draws | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\search\GlobalSearchResults\component.tsx:66` | — |

## Scope

This module decides who renders a list's name. What the name says is `copy`; whether the list has a
boundary at all is [`b1`](../b1-one-surface-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
