---
id: fe-layouts-khung-danh-tinh-bao-quanh-bang-chung-index
title: INDEX.md
slug: /fe/layouts/khung-danh-tinh-bao-quanh-bang-chung
sidebar_label: khung-danh-tinh-bao-quanh-bang-chung
sidebar_position: 0
description: Binding rules for a frame that holds one subject steady while the evidence about that subject changes — its rail, its container-measured narrow form, its field ownership and its whole-screen states.
template: layouts-v1
---

# INDEX.md

Version: `1.00` · Module: `khung-danh-tinh-bao-quanh-bang-chung` · Shelf: [`layouts`](../INDEX.md)

## Law

When a page is ABOUT one subject and the body shows changing evidence about that same subject, the
subject holds a stable rail and the evidence holds the main region.

**The rail is not navigation.** It is the person. It holds identity, and it is the reason the reader
never loses the answer to "whose evidence am I looking at" while moving between faces.

**Each field belongs to exactly one region.** Identity facts live in the rail, the list keeps
identity, and the panel keeps description. A field rendered in two regions is not redundancy — it is
two owners for one fact.

**This is the only archetype that owns whole-screen states.** When the subject cannot be shown at
all, the frame does not render a broken version of itself: it replaces itself, and it declares
exactly how much chrome each state keeps.

**Narrow is measured by the region itself, not by the viewport.** The split is about whether the rail
and the evidence still fit side by side, which is a fact about this region's width and nothing else.

## Situation Codes

| Code | Situation | Emits |
|---|---|---|
| `IDENT-1` | One subject, changing evidence about it | rail-then-main split; rail at a stable reading width, main flexible |
| `IDENT-2` | The two no longer fit side by side | rail moves ABOVE main; measured by the region's own container query |
| `IDENT-3` | A fact could plausibly be shown in more than one region | it belongs to exactly one; the list keeps identity, the panel keeps description |
| `IDENT-4` | Each evidence face has its own address | the tab strip is routing, and it pushes; the breadcrumb keeps route ancestry |
| `IDENT-5` | The subject cannot be shown | a branch per state, each declaring which chrome survives |
| `IDENT-6` | The split needs a measure, an inset and a container | four wrappers, each owning exactly one decision, none collapsible into another |

### `IDENT-2` — why the region measures itself

The rail does not disappear at a narrow width and it does not shrink into an icon strip. It moves
ABOVE the evidence, because the subject must still be identifiable when the evidence is the only
thing on screen.

The measurement is a container query on this region, not a viewport breakpoint, because the question
is whether THIS region has room — the same page inside a narrower shell must fold the same way as
the same page in a narrow window.

### `IDENT-5` — the state matrix is part of the layout, not of the blocks

Five states, and each one answers one question: *what chrome survives?*

| State | Branch | Chrome kept | Reading |
|---|---|---|---|
| `ready` | own branch | tab strip + rail + main | the normal frame |
| `locked` | own branch | rail, no tab strip | the subject exists and is identifiable, but the faces are not offered |
| `not-found` | own branch | none — one centred notice | there is no subject, so there is nothing to identify |
| `failed` | own branch | none — one centred notice | the subject may exist; we could not fetch it |
| `loading` | **missing in live source** | falls through to the ready tree | draws tabs and rail over data that has not arrived |

A state without its own branch is not a state that "degrades gracefully". It is a state that renders
another state's tree with absent data.

## Inputs

| Input | Evidence required |
|---|---|
| subject | Who or what the page is about, and what identifies them |
| evidence faces | The faces the main region cycles through, and whether each has its own address |
| field list | Every fact to be shown, and which single region owns it |
| states | The full union the connected half can compute — including the ones nobody wants to draw |
| chrome per state | For each state, exactly which regions survive |
| narrow | Whether the fold is decided by this region's width or by the viewport |

## Invariants

- The rail holds the subject; it is never a navigation column. A column of destinations is
  [`cot-dich-den-dung-canh-than-trang`](../cot-dich-den-dung-canh-than-trang/INDEX.md).
- Every field has exactly one owning region. No field is drawn twice.
- The rail moves above the main at a narrow width; it never vanishes.
- The fold is measured by this region's container query.
- Every member of the state union has an explicit branch.
- Every state declares which chrome it keeps.
- The tab strip runs full width, because it changes which evidence region is on screen.
- Tabs that are real routes push; the breadcrumb still owns route ancestry.
- Each wrapper in the measure/inset/container/split chain owns exactly one decision.

## Exceptions

- **`IDENT-4` is the one place tabs ARE routing.** Elsewhere a tab changes a panel; here each face has
  a real URL, so the strip calls `router.push`. This does not license tabs that rewrite the
  breadcrumb — see `CHROME-5` in
  [`bang-chrome-tren-than-trang`](../bang-chrome-tren-than-trang/INDEX.md).
- **`IDENT-5` `locked` keeps the rail and drops the tab strip.** Offering faces that refuse to open
  is a control pointing at content that is not there.
- **`IDENT-6` may not be flattened.** The measure caps the reading width, the inset pads inside that
  cap, the container establishes the query, and the split arranges. Merging inset into measure moves
  the padding outside the cap and the container query then observes the wrong width.
- **`IDENT-3` allows the same VALUE in two regions when the two regions answer different questions** —
  a count in a tab label and the same count in a heading are one fact serving two purposes. What is
  forbidden is one region borrowing another's job: the list carrying the description the panel
  exists to carry.

## Anchor

Rejection anchors — path, line, verbatim `Why`:

| Code | Anchor | Rejected → Chosen | Why (verbatim) |
|---|---|---|---|
| `IDENT-3` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:466` | Render autocomplete brief trong middle list → Middle chỉ title + kind/status; detail description nằm ở panel phải | User: "không render briefs ở list nhưng ở bên phải phải có details". |
| `IDENT-3` | `…\global-search-modal-spacing-listbox-20260815-01.md:384` | Panel phải lấy title/snippet ngay từ autocomplete → Click gọi canonical detail API; panel render loading/error/ready từ detail response | User: "click vào thì call api details rồi render sang bên phải". |
| `IDENT-3` | `…\global-search-modal-spacing-listbox-20260815-01.md:467` | Click row mở route ngay → Click fetch/render detail; CTA phải mở route | "Nếu điều hướng ngay thì người dùng không thể đọc detail panel." |
| `IDENT-6` | `…\global-search-modal-spacing-listbox-20260815-01.md:143` | Positional `first-child`/`last-child` width selectors → Stable region identity selectors | "Live DOM shows React Aria inserts hidden FocusScope siblings around ListBox, so child position is not component identity." |
| `IDENT-4` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:440` | Tabs thay thế breadcrumb → Tabs và breadcrumb cùng tồn tại, mỗi loại đúng vai trò | "User hỏi trực tiếp vì sao bên trái không có breadcrumbs. Trò nhận sai vì đã loại nó khỏi concept." |

Code anchors in the live repository `D:\Repositories\starci-academy-fe` (branch `main`):

| Claim | Anchor |
|---|---|
| Rail-then-main, and the reason it is not two card columns | `src\components\contracts\index.ts:804-810`, `why` at `:810` |
| Rail width, stable reading measure | `src\components\contracts\index.ts:813` (`@app-md:w-72`) |
| Narrow fold measured by the region's own container query | `src\components\contracts\index.ts:805` (`flex-col … @app-md:flex-row`), container established at `:800-802` |
| Tab strip above the body belongs to the layout, not the navbar | `src\components\contracts\index.ts:781-788`, `why` at `:788` |
| Full-width strip | `src\components\contracts\index.ts:1740`, used at `PublicProfileLayout\component.tsx:103` |
| Tabs here are real routes | `src\components\layouts\PublicProfileLayout\index.tsx:75` (`router.push`) |
| Four-wrapper chain, one decision each | `contracts\index.ts:789-793` (measure), `:794-798` (inset), `:799-803` (container), `:804-810` (split) |
| State union of five | `src\components\layouts\PublicProfileLayout\component.tsx:15` |
| Branches present | `component.tsx:38` (failed), `:54` (not-found), `:70` (locked), `:101` (ready) |
| BREACH — `loading` has no branch and the connected half still computes it | `component.tsx:15` versus `component.tsx:101`; `PublicProfileLayout\index.tsx:43-44` |
| BREACH — no `shape: "layout"` marker | `PublicProfileLayout\component.tsx:123` |

## Scope

This module owns the 10 pages under `/profile/[username]`, and any future frame whose defining
feature is one steady subject beside changing evidence about that subject.

It does not own the band above it, nor the interior of the rail's hero, nor the evidence blocks
themselves. It DOES own the state matrix, because the states replace the frame rather than the
contents.

The measured member is a public profile, so every sentence here is written about a PERSON. A future
member whose subject is not a person will test whether "identity" was the right abstraction or just
the only instance.

## Version Rule

An accepted rule change increments all five records of this module by `0.01` and is recorded in
[`changelog.md`](./changelog.md). Adding a state to the union is a rule change, because `IDENT-5`
enumerates the full matrix and a sixth state changes what "complete" means.
