---
id: fe-blocks-laws-b4-empty-is-a-state-index
title: INDEX.md
slug: /gates/blocks/laws/b4-empty-is-a-state
sidebar_label: b4-empty-is-a-state
sidebar_position: 0
description: Binding rules for what renders when there is nothing to render, and when a block is allowed to disappear entirely.
---

# INDEX.md

Version: `2.00` · Module: `b4-empty-is-a-state` · Law: `B4` · Refusals: **5 across 4 records**

## Law

Empty is a **state of the block**, not the absence of the block. Zero results is an answer the
product gives, and it is given in the block's own shell, under the block's own name.

> Zero is product state, not an absent page.

A control never points at content that does not exist.

## Situation Codes

| Code | Situation | What renders |
|---|---|---|
| `B4-1` | The request settled and the set is empty | the block's shell, its label unchanged, an `EmptyNotice` inside |
| `B4-2` | The request failed | the same shell and notice, **plus** a retry — a different branch from `B4-1` |
| `B4-3` | The request has not answered yet | the ready tree with `isLoading`, **not** an empty notice |
| `B4-4` | The whole block is meaningless for this viewer | the block renders `null`, and the reason is written in its docstring |
| `B4-5` | A region is hidden because its list came back empty | refused — see `B4-1` |
| `B4-6` | The empty sentence is injected into the list as a row | refused — a sentence is not a datum |
| `B4-7` | A tab, link or control leads to a set that cannot exist | refused — remove the control, not the state |
| `B4-8` | The page is still loading and the block takes its data from the page | the page's pending maps to the block's **resting** render; handing down empty strings with a `ready` state is refused |

`B4-8` IS A HOLLOW-READY RENDER, AND IT IS WORSE THAN A SKELETON. A block told it is `ready` while
its strings are empty draws real controls with no labels, and every leaf inside it believes the data
has arrived. The page's wait must arrive as the block's resting state, not as empty content —
see [`b11`](../b11-pending-owner/INDEX.md) `B11-7`.

`B4-3` IS THE MOST OFTEN CONFUSED. `undefined` means *has not answered*; `null` means *answered, and
the answer is nothing*. The first is pending, the second is empty. A block that treats them alike
shows an empty notice during a normal load, which is the one moment it is certainly wrong.

`B4-4` IS THE ONLY LEGAL DISAPPEARANCE, and it is legal only with a named viewer condition. "There
is nothing to show" is `B4-1`. "This reader is signed out, so this figure has no meaning at all" is
`B4-4`.

## Inputs

| Input | Evidence required |
|---|---|
| `envelope` | `undefined` · `null` · `empty-array` · `populated` — the exact shape the request returns |
| `viewerCondition` | the named condition that makes the block meaningless, or `none` |
| `retry` | whether the failure is retryable by the reader |
| `emptyCopy` | the resolved translation key of the sentence shown |

`viewerCondition` is what separates `B4-4` from `B4-5`. Without a named condition, a `null` return
is a hidden region and is refused.

## Invariants

- The empty branch keeps the block's label. The reader must still know what is empty.
- The empty branch **replaces** the surface; it does not nest a second one — see
  [`b1`](../b1-one-surface-owner/INDEX.md).
- Empty carries no retry; failed does. They are two branches, not one message with two texts.
- A pending render never shows an empty notice, and there is a test that enforces exactly this on
  thirteen dashboard blocks.
- An empty sentence is never inserted into a list as a row with a fabricated id.
- A control that points at a set which cannot exist is deleted, not disabled.

## Exceptions

- **The signed-out identity rows.** Four rail blocks fold failure into `empty` and render `null`,
  and each states in its docstring that this is what a signed-out reader is supposed to see. That
  written reason is what makes them `B4-4` rather than violations.
- **`hidden` as a state name.** Five blocks use it. It is a synonym for `empty` and the gate demands
  a reason for choosing it — see [`b10`](../b10-state-enumeration/INDEX.md).

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Zero is a product state, rendered inside the retained shell | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-assets-and-empty-state.md:134` | "Zero is product state, not an absent page." |
| Hiding the result region at zero is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-assets-and-empty-state.md:61` | "Thầy yêu cầu trạng thái rỗng phải hiện rõ." |
| A control must point at content that exists | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-detail-page-v4.md:681` | "Every tab must point to content that exists." |
| An empty state still needs a real anchor and a real section | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-detail-page-v4.md:679` | "User supplied the real Fullstack render and live backend disproves the old assumption." |
| An idle/empty list gets a real destination, not an invented set | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:440` | "Không có producer public chứng minh popularity order" |
| The shape of a live empty branch | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:62-66` | — |
| Pending must not render an empty notice — enforced by test | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\pending-gate.test.tsx:92-97` | — |
| A named viewer condition written into the block | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:22-28` | — |
| The refused shape: an empty sentence pushed in as a fake row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\overview\OverviewCourses.tsx:18-21` | — |

## Scope

This module decides what renders at zero. Which sentence it says is `copy`; which icon the notice
carries is the notice's own contract; whether the failure is visible at all is
[`b12`](../b12-error-owner/INDEX.md).

Its output is the `emptyOwner` field of [`gate.schema.json`](../../gate.schema.json), whose three
values are exactly the three shapes measured in the live tier.

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
