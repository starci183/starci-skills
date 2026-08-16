---
id: fe-blocks-archetypes-o-bang-chung-ho-so-index
title: INDEX.md
slug: /fe/blocks/archetypes/o-bang-chung-ho-so
sidebar_label: o-bang-chung-ho-so
sidebar_position: 0
description: The anatomy of the six public-profile evidence tiles — the branch that follows none of the tier's file rules, and what that costs.
---

# INDEX.md

Version: `2.00` · Module: `o-bang-chung-ho-so` · Archetype: `A9` · Live instances: **6**

## Law

**By role these are labelled lists; by shape they follow none of the tier's rules — and this module
exists to say so, not to bless it.**

An archetype is admitted with an anchor to what already runs. These six run. Recording them as they
are is the only honest option; recording them as if they were `A1` would hide six real files from
anyone reading this shelf.

## Situation Codes

| Code | Situation | What is actually there | Verdict |
|---|---|---|---|
| `A9-1` | File shape | one flat `.tsx`, no folder, no `component.tsx`/`index.tsx` pair, no `_X` twin | outside the tier's convention |
| `A9-2` | Tier marker | no `meta` export | outside; nine of the ten missing-`meta` files are here |
| `A9-3` | Hooks | two shared hooks live inside the component tree | outside; the file-layout lint does not reach `blocks/` |
| `A9-4` | Resting rows | a locally built array with `resting-<i>` ids | acceptable, but the count is chosen, not read |
| `A9-5` | Empty and failed | folded into one `message` and pushed into the list as a fake row with `globalId: "state"` | **refused** — [`b4`](../../laws/b4-empty-is-a-state/INDEX.md) |
| `A9-6` | Surface | one `SurfaceCard` per tile | correct |

`A9-5` IS THE ONE THAT MATTERS. The sentence "there is nothing yet" is rendered with the exact
grammar of a real data row: same inset, same divider, same scanning rhythm. A reader has no way to
tell it is not a course named "there is nothing yet".

## Inputs

| Input | Evidence required |
|---|---|
| `evidenceKind` | The evidence family this tile requests |
| `sharedHook` | The hook resolving the public profile id |
| `restingCount` | The count this file chose, and the registry value it should have read |
| `emptyOwner` | Currently `hang-gia-trong-danh-sach`; the target is `empty-notice-card` |

## Invariants

- Six tiles, one evidence family each, each independently cached.
- One surface per tile.
- Every departure from the tier convention is **written down** here rather than normalized.
- A new tile does not copy this shape. It uses `A1`.

## Exceptions

None. This archetype is a record of an existing branch, not a licence to extend it.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Flat file, no pair, no twin, no `meta` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\overview\OverviewCourses.tsx:13-24` | — |
| The empty sentence pushed in as a fake row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\overview\OverviewCourses.tsx:18-20` | — |
| A shared hook living inside the component tree | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\overview\useOverviewEvidence.ts:8-13` | — |
| Zero renders inside the retained shell, not a fake row | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-assets-and-empty-state.md:134` | "Zero is product state, not an absent page." |
| Every overview region stays mounted while requests are unresolved | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\pending-gate.test.tsx:99-100` | — |

## Scope

This module records an existing branch and its debts. The correct target shape for any new tile is
[`A1`](../bang-danh-sach-co-nhan/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change. This module is **retired**, not
extended, once the six tiles are brought back to `A1`.
