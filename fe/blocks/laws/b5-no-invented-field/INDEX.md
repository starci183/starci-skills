---
id: fe-blocks-laws-b5-no-invented-field-index
title: INDEX.md
slug: /fe/blocks/laws/b5-no-invented-field
sidebar_label: b5-no-invented-field
sidebar_position: 0
description: Binding rules against drawing a fact the backend does not serve, including the constant that stands in for a missing count.
---

# INDEX.md

Version: `2.00` · Module: `b5-no-invented-field` · Law: `B5` · Refusals: **5 across 4 records**

## Law

A block draws only facts a producer serves. If the backend has no field, the block has no field —
not a constant, not a placeholder, not a plausible number.

An invented field is worse than a missing one. A missing field is visibly absent; an invented field
is confidently wrong, and the reader has no way to tell.

## Situation Codes

| Code | Situation | What the block does |
|---|---|---|
| `B5-1` | The design shows a fact with no producer | does not draw it, and reports the missing producer |
| `B5-2` | The producer serves presence but not quantity | draws presence — never a number standing in for one |
| `B5-3` | A display string is written in the source | allowed **only** for a proper noun |
| `B5-4` | A field is fetched but never displayed | it is surplus in the query, not an axis for a new state |
| `B5-5` | A figure is derived from fields that do exist | allowed, but it is still an addition and needs a stated reason |

`B5-2` IS THE ONE THAT KEEPS HAPPENING. A boolean says *there is something*; a badge saying `1` says
*there is exactly one*. Those are different claims, and only the first has evidence.

## Inputs

| Input | Evidence required |
|---|---|
| `producer` | The query, projection or resolver serving this field, `file:line` |
| `cardinality` | `boolean` · `count` · `value` — what the producer actually returns |
| `derivation` | The existing fields a derived figure is computed from |
| `unusedFetch` | Fields the query returns that no branch of the tree reads |

## Invariants

- Every drawn field names its producer in the plan.
- A boolean producer renders a presence mark, never a quantity.
- The only hard-coded display strings in the block tier are proper nouns. There are exactly three
  hard-coded strings measured across sixty-two blocks; two are `GitHub` and `LinkedIn`.
- A field fetched and never shown is removed from the query or explained; it never becomes the basis
  for a state the product does not have.
- A derived figure is not invention, but adding it is still adding content, and content is a product
  decision.

## Exceptions

- **Proper nouns.** `B5-3`. A brand name has no translation key because it has no translation.
- **A derived figure the requirement asked for.** `B5-5`. Deriving "three of five done" from a list
  breaks nothing, but it is a new sentence on the screen and is decided as one.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| No badge until the API serves a real count | neo TỪ CHỐI | `.workflows\designs\starci-academy\shell-account-language-menus.md:385` | "Current FE/backend evidence không có badge count." |
| Fabricated legacy badge refused alongside other invented chrome | neo TỪ CHỐI | `.workflows\designs\starci-academy\shell-account-language-menus.md:529` | "Binding legacy parity and data integrity." |
| A hard-coded course fact is refused when the backend does not serve it | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-detail-page-v4.md:333` | "Backend does not serve that fact for every course." |
| Production must not invent unsupported facts | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-detail-page-v4.md:548` | "Production must not invent unsupported course facts." |
| A fixture must not become a fake capability | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:147` | "Không biến fixture thành capability giả" |
| A per-item badge that overstates the contract is refused | neo TỪ CHỐI | `.workflows\feature\starci-academy\cv-evidence-contract.md:217` | "Compose/editor chưa lưu claim source refs; badge từng bullet sẽ nói quá contract." |
| The live violation: a constant `1` where the type carries only a boolean | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:47-49` | — |
| The type that proves it is invented | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:8-12` | — |

## Scope

This module decides whether a field may be drawn at all. How it is drawn once admitted is
[`b2`](../b2-chip-or-text/INDEX.md). Its output is the `inventedFields: false` constant of the gate
and the producer named in each field's reason.

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
