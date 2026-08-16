---
id: fe-layouts-cot-dich-den-dung-canh-than-trang-index
title: INDEX.md
slug: /fe/layouts/cot-dich-den-dung-canh-than-trang
sidebar_label: cot-dich-den-dung-canh-than-trang
sidebar_position: 0
description: Binding rules for the destination column that stands beside a routed body — its scroll, its narrow form, its identity, its width owner, and which route is a door.
template: layouts-v1
---

# INDEX.md

Version: `1.00` · Module: `cot-dich-den-dung-canh-than-trang` · Shelf: [`layouts`](../INDEX.md)

## Law

When ONE entitlement opens MANY modes, the list of places the reader can go stands as a column
BESIDE the routed body. Changing mode repaints the body and leaves the column standing.

The column is a sibling of the routed main, never its parent. It is furniture, not content: it stays
under the band, takes the height the band leaves, and scrolls on its own, so a reader deep inside a
long lesson still sees where they are.

**A column is a column only if the frame has a slot for it.** A run of repeated links flattened
straight into the frame is a row of links, whatever the frame's `why` claims about it.

**The column has an identity, and that identity is how it is targeted.** Positional targeting picks
whatever child happens to be first, which on an optional column is the body.

**Every route under this frame has a real page owner. Which route is the DOOR is a separate,
product-level decision.** Those are two different sentences and the founder ruled them separately.

## Situation Codes

| Code | Situation | Emits |
|---|---|---|
| `SPINE-1` | The column must stay legible while the body scrolls | pinned at the band's own token, capped by that band's max-height token, `overflow-y-auto` on itself |
| `SPINE-2` | Below the column's breakpoint the modes are unreachable | column `hidden … md:flex`; a `sticky bottom-0 … md:hidden` NAV of destinations replaces it |
| `SPINE-3` | The route is an active evaluated experience | the column is removed entirely; the predicate is SHARED with whoever else hides for the same routes |
| `SPINE-4` | The column is optional | the column is its own contract, targeted by `data-node` identity |
| `SPINE-5` | The column has a width | that width belongs to the frame that owns this column, and a correction to it does not travel to a sibling frame |
| `SPINE-6` | A route in this family carries no content of its own | it may redirect — but only if it is a door, never to make a missing owner look green |
| `SPINE-7` | The frame claims a column but has no slot for one | not a column; the plan must either add the slot or stop claiming it |

`SPINE-6` is a criterion, not a value, and is stated in full below.

### `SPINE-2` — what replaces it, and what that replacement IS

The narrow form is not "the column, smaller". The column disappears and a different thing appears at
the bottom edge, where a thumb already is. That thing is a **nav of peer destinations**, and it
shares a shape with an action bar without being one: what distinguishes them is what sits inside —
one holds a price and the thing that buys it, this holds destinations.

Two different bottom-edge bars with the same silhouette and different contents is exactly the case a
contract key exists to keep apart. No reader should have to tell them apart by guessing.

### `SPINE-6` — route entry as a criterion, not a default

The founder ruled twice, in two directions, and both rulings stand.

| Ruling | Rejected | Chosen | Why (verbatim) |
|---|---|---|---|
| A | Tạo stub/redirect cho các route `/learn` còn thiếu | Tách A1–A6 và port từng legacy owner thật | "Stub làm route 'xanh' nhưng sai product behavior và vi phạm parity." |
| B | Current A+B Today default | Legacy `/learn` entry to `/learn/content` | User: "sửa learn để follow legacy" |

They do not contradict each other, and reading either one alone produces the wrong rule.

**The classification:**

| The route… | Then | Test |
|---|---|---|
| CARRIES content — it is a mode a reader is meant to land on and read | needs a real page owner. A stub or redirect here is a lie that turns the route green | Is there content that exists nowhere else once this route is gone? |
| Is a DOOR — an address that exists so an older link, a bare index or a legacy habit still lands somewhere | may redirect, and the target is a product decision | Does anything become unreachable if this route sends the reader onward immediately? |

Neither answer is the default. Ruling A forbids using a redirect to fake an owner; ruling B settles
that `/learn` itself is a door, and that WHICH door it opens follows the legacy product, not the
plan's convenience.

Live: three redirects, all three doors — `[lang]\page.tsx` → `/dashboard`, `learn\page.tsx` →
`/learn/content`, `learn\flashcards\page.tsx` → `/flashcards/review`. No breach.

**The cost of the flip is real and must be carried in the plan.** When a route stops carrying
content, its page owner and every branch that tested for it become dead. See `audit.md`.

## Inputs

| Input | Evidence required |
|---|---|
| entitlement | What one purchase or enrolment opens, and how many modes hang off it |
| mode list | The modes, and whether their grouping is fixed or data-driven |
| optionality | Whether the column can be absent on some routes under the same frame |
| band above | Which band this frame sits under, so the pin and the cap use THAT band's tokens |
| full-bleed routes | Which routes take the whole viewport, and who else must agree with that list |
| route roles | For each route in the family: carries content, or is a door |
| narrow | What the reader needs within thumb reach when the column is gone |

## Invariants

- The column is a sibling of the routed main. It never wraps it.
- The frame does not open `main`; the routed page does.
- The column owns its own scroll, its own pin and its own cap; the body scrolls with the page.
- The pin token and the cap token move together. Changing one alone leaves the column either clipped
  at the top or unreachable at the bottom.
- The column is targeted by identity. `*:first-child` is forbidden on any frame whose column is
  optional.
- The column's width belongs to this frame. A width correction in one frame is not applied to a
  sibling frame that happens to look similar.
- Below the breakpoint, the column is replaced by a nav of destinations, not by an action bar.
- A route that carries content has a page owner. A door may redirect.
- A frame that claims a persistent column in its `why` has a slot for one.

## Exceptions

- **`SPINE-3` removes the column entirely.** On an active evaluated route the whole viewport belongs
  to the assessment. The predicate must be the SAME function the global assistant uses to hide, or
  the shell will show navigation while the assistant hides over the same exam.
- **`SPINE-1` does not apply to a column with nothing under the fold.** Pinning and capping exist so a
  long column stays reachable; a short column that never overflows still declares `ownsScroll: false`
  honestly rather than borrowing the pattern.
- **`SPINE-5` allows two frames to hold different widths for the same visual role.** `main-then-rail`
  holds `w-80` while `content-reader-frame` holds `w-72`. That is two owners, not an inconsistency,
  and reconciling them without a ruling is how a correction leaks into a page nobody asked about.
- **`SPINE-6` ruling B is about `/learn` specifically.** It settles which door `/learn` opens; it does
  not license redirecting any route that is inconvenient to build.

## Anchor

Rejection anchors — path, line, verbatim `Why`:

| Code | Anchor | Rejected → Chosen | Why (verbatim) |
|---|---|---|---|
| `SPINE-6` A | `D:\Repositories\starci-academy-backend\.workflows\designs\starci-academy\learn-branch.md:495` | Tạo stub/redirect cho các route `/learn` còn thiếu → Tách A1–A6 và port từng legacy owner thật | "Stub làm route “xanh” nhưng sai product behavior và vi phạm parity." |
| `SPINE-6` B | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\learn-legacy-ai-policy.md:79` | Current A+B Today default → Legacy `/learn` entry to `/learn/content` | User: "sửa learn để follow legacy". |
| `SPINE-4` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:143` | Positional `first-child`/`last-child` width selectors → Stable region identity selectors | "Live DOM shows React Aria inserts hidden FocusScope siblings around ListBox, so child position is not component identity." |
| `SPINE-5` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:444` | Rail course detail `w-72` → `w-80` | "Buy-vs-try copy và disclosure bị dồn ở zoom 150%." |
| `SPINE-5` | `…\courses-runtime-projection-i18n-20260815-01.md:445` | Nới nhầm `content-reader-frame` sibling trong patch trung gian → Hoàn nguyên sibling `w-72`, chỉ nới `main-then-rail` | "Live proof phát hiện wrong owner; không để correction lan sang trang học." |
| `SPINE-2` | `D:\Repositories\starci-academy-backend\.workflows\designs\starci-academy\learn-branch.md:757` | Use simple route links as mobile tabs → `LearnMobileTabBar` view owner | "Legacy mobile tabs switch contents, lesson and outline views without changing route." |

Code anchors in the live repository `D:\Repositories\starci-academy-fe` (branch `main`):

| Claim | Anchor |
|---|---|
| The column is a sibling, and that is the reason | `src\components\layouts\LearnShellLayout\component.tsx:20` |
| The frame does not open `main` | `src\components\layouts\LearnShellLayout\component.tsx:13-15` |
| Frame with a real column slot | `src\components\contracts\index.ts:330-350` (`spine` optional, `body` leaf, `bar` optional) |
| Column pinned, capped, own scroll | `src\components\contracts\index.ts:339` (`top-rail`), `:341` (`max-h-rail`), `:342` (`overflow-y-auto`) |
| Column targeted by identity | `src\components\contracts\index.ts:335` (`md:[&>[data-node=learn-spine-column]]:w-72`), contract at `:351` |
| Column is optional | `src\components\layouts\LearnShellLayout\component.tsx:87-89` |
| Column vanishes at narrow width | `src\components\contracts\index.ts:353` (`hidden … md:flex`) |
| Thumb bar replaces it, and is a NAV | `src\components\contracts\index.ts:324` (`sticky bottom-0 … md:hidden`), reason at `:328` |
| Full-bleed predicate, shared | `src\modules\learn\is-live-assessment-route.ts:8-13`, docstring `:4-6`; called at `LearnShellLayout\index.tsx:141` and `content-ai-route-context.ts:67` |
| Mobile view is local state, not routing | `src\components\layouts\LearnShellLayout\index.tsx:192-195` |
| Widths at two different owners | `contracts\index.ts:2234` (`w-80`), `contracts\index.ts:1951,1956` (`w-72`) |
| Doors, live | `app\[lang]\courses\[displayId]\learn\page.tsx` redirects to `/learn/content` |
| BREACH — frame claims a column and has no slot | `contracts\index.ts:392` (`milestone` repeats as a direct child), `:388` (`md:[&>*:first-child]:w-72`), claim at `:395` |
| BREACH — dead branch left by the flip | `LearnShellLayout\index.tsx:128` (`isToday`), `:95-99` and `:158` (`TODAY_TABS`) |

## Scope

This module owns frames whose defining feature is a persistent list of destinations standing beside
a routed body: `learn-shell-frame` over 30 learn pages, and
`personal-project-workspace-frame` over 3 personal-project pages.

The two members are NOT of equal quality. One wraps its column in its own contract and targets it by
identity; the other has no column at all. That difference is the subject of `SPINE-4` and `SPINE-7`.

A column that holds a PERSON rather than destinations is not this module — see
[`khung-danh-tinh-bao-quanh-bang-chung`](../khung-danh-tinh-bao-quanh-bang-chung/INDEX.md). The band
above this frame is [`bang-chrome-tren-than-trang`](../bang-chrome-tren-than-trang/INDEX.md), and its
row count is what this module's pin token subtracts.

## Version Rule

An accepted rule change increments all five records of this module by `0.01` and is recorded in
[`changelog.md`](./changelog.md). Adding or removing a `SPINE-` code is a rule change. A third member
frame joining the archetype is a rule change, because it tests whether `SPINE-7` is a defect or a
second legitimate shape.
