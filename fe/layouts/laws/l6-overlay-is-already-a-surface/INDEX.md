---
id: fe-layouts-laws-l6-overlay-is-already-a-surface-index
title: INDEX.md
slug: /fe/layouts/laws/l6-overlay-is-already-a-surface
sidebar_label: l6-overlay-is-already-a-surface
sidebar_position: 0
description: Binding rules for what a layout plan may declare inside an overlay, and the one condition under which a second bounded object is allowed to sit in there.
---

# INDEX.md

Version: `1.00` · Module: `l6-overlay-is-already-a-surface` · Law: `L6` · Refusals: **3 across 2 records**

## Law

An overlay **is** the bounded surface. The layout mounts it once for a whole route cluster, the
vendor shell draws its edge, its backdrop and its title, and the plan therefore declares the
interior as **flat contract regions** — never as a region that owns a card.

One bounded object may sit inside, and only under a closed condition: the inner set is a
**separate, nameable joined set**, the claim is made **one tier down by a block** rather than by the
overlay file, and it declares `isNested: true` with a named outer owner.

The refusal that settles it is not about how a second border looks:

> Overlay là bounded surface, nested card tạo hai surface owners

**This is binding, not advisory.** Every region a plan puts inside an overlay falls under exactly
one code below, including the two that declare nothing at all. The place this law gets skipped is
never the obvious one — nobody writes `SurfaceCard` at the top of a dialog on purpose. It gets
skipped when a region is named `…-card`, when an interior grows a title the shell already renders,
or when the padding is written twice because two owners each thought the inset was theirs.

This module decides **boundary ownership inside an overlay**. How wide the overlay opens is
[`l7-overlay-width-is-a-product-decision`](../l7-overlay-width-is-a-product-decision/INDEX.md) and is
decided nowhere in here.

## Situation Codes

| Code | Situation | What the plan declares |
|---|---|---|
| `L6-1` | The plan adds an overlay to a route cluster | `buildsCardInside: false`, and an interior of flat contract regions |
| `L6-2` | The shell already renders the panel's title | **no heading region** inside the interior; a shell that renders none leaves the heading to the interior |
| `L6-3` | The interior needs an inset | exactly one inset owner, named: the shell or the root contract, never both |
| `L6-4` | A real joined set of comparable rows lives inside | one nested surface, owned by a **block**, `isNested: true`, outer owner named |
| `L6-5` | A region inside reads like a panel | a flat `Tree` contract with its own padding — **no surface branch** |
| `L6-6` | The inner bounded object is not a joined list | **refuse** and write it into `owed` |

Codes `L6-1` to `L6-3` answer *what the overlay already owns, so the interior must not*. Codes
`L6-4` to `L6-6` answer *what may still appear once the overlay owns the boundary around you*.

`L6-2` IS A SITUATION, NOT AN OMISSION, AND IT IS DECIDED BY THE SHELL. `DrawerShell` takes `title`
as a required prop and renders it in the vendor header, so a drawer interior with no heading has
been classified rather than forgotten, and an interior that adds one names the thing the reader has
just opened, by name, twice. `ModalShell` renders no title at all — only a close trigger — so a
modal interior **owns** its heading, and `course-price-detail-stack` opens with one. Read the shell
before deleting a heading.

`L6-5` IS THE ONE THAT MISLEADS. `global-search-context-card` ends in `-card`, carries `p-4`, and
draws no surface at all: it is a `Tree` contract with five leaf slots. The name is a label for a
region, and a name is not evidence of a boundary.

## Inputs

| Input | Evidence required |
|---|---|
| `overlayShell` | `ModalShell` · `DrawerShell` — which shell draws the bounded surface |
| `interiorKind` | `flat-regions` · `joined-rows` · `unlike-parts` · `single-statement` |
| `innerMembership` | `same-as-overlay` · `distinct-and-nameable` · `unknown` |
| `insetOwner` | `shell` · `root-contract` — exactly one, named |
| `namesItself` | `yes` · `no` — whether the shell renders the panel's title already |
| `nestedOwner` | the **block** carrying the nested claim, by name, required whenever `L6-4` is used |

A membership is **nameable** when you can state its name, its members, its own state and its own
outcome. The middle column of Global Search passes: it is the result list, its members are hits, it
has a settled-empty state of its own, and its outcome is a chosen hit. A context pane holding a
title, a kind, a snippet, a status and a button does not pass — those are five unlike parts of one
statement, not a membership.

`nestedOwner` is an input, and it is a **block name**, because a nested claim made by the overlay
file is unrepresentable: `no-surface-branch-in-overlay` reports on any import of the four surface
branches from a file under `overlays/`.

## Invariants

- One overlay, one bounded surface. Nothing inside claims that ground again.
- The overlay file imports no named surface branch. Not for a boundary, not for anything.
- A nested surface inside an overlay is declared by a block one tier down, never by the overlay
  file, and it declares `isNested: true` with its outer owner named.
- The vendor body is zeroed by the shell, so exactly one owner writes the inset and the plan says
  which one.
- Where the shell renders the panel's name, the interior never repeats it; where the shell renders
  none, the interior owns it. `namesItself` is read from the shell, not assumed from the word
  "overlay".
- The interior of an overlay is `Tree` contracts, leaves and composites. A region that needs its own
  padding gets padding, not a boundary.
- Pending, empty and failed keep the same ownership inside an overlay as outside it: settled absence
  **replaces** the list surface with the shared notice, it never sits inside a second one.
- A `-card` suffix in a contract key is a name. Read the `classes` array before believing it.
- The overlay's width is not decided here.
  [`l7-overlay-width-is-a-product-decision`](../l7-overlay-width-is-a-product-decision/INDEX.md)
  decides it, and "modals are narrow" is a rejected assumption rather than a default.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A genuine joined inner object.** `L6-4`, and it exists once in the live tree: the middle results
  list of Global Search keeps a `SurfaceListCard` at `isNested: true`, mounted by
  `GlobalSearchResults`, which is a block. The user asked for it in those words. Literal nested mode
  is the **necessary** condition and never the sufficient one.
- **A region named like a card.** `L6-5`. The key may end in `-card` while the contract draws a flat
  column. The name does not license a surface, and the surface does not require a rename.
- **A cover-size overlay whose inset comes from the shell.** `L6-3`. `ModalShell` writes `p-4` on the
  dialog at `size="cover"` and nowhere else, so the cover interior's root contract carries no padding
  of its own. That is one inset owner, correctly, and not an exemption from the invariant.
- **An inner bounded object that is not a joined list.** `L6-6`. Refuse and escalate. Only
  `SurfaceListCard` implements `isNested`, so the claim cannot be expressed, and a hand-written
  border on a contract inside an overlay is precisely the second owner this law exists to prevent.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| An overlay is bounded, so a card inside creates two surface owners | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:738` | "Overlay là bounded surface, nested card tạo hai surface owners" |
| The interior is direct regions, because the modal already draws the surface | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:926` | "The modal is already the bounded surface" |
| The one admitted inner object was asked for by name | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:289` | "User: “trò render SurfaceListCard ở giữa chứ”." |
| The shell keeps the boundary and passes the interior through untouched | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:43` | — |
| Cover size is the single place the shell writes an inset | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:40` | — |
| A drawer names itself in the vendor header | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\DrawerShell\index.tsx:64-66` | — |
| The drawer body is zeroed so the interior insets once | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\DrawerShell\index.tsx:73` | — |
| `L6-1` recorded at the decision: no surface branch, and why | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\courses\CoursePriceOverlay\component.tsx:13-15` | — |
| The second overlay records the same rule beside the same decision | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\commerce\CartDrawer\component.tsx:20-22` | — |
| `L6-2` live: a titled panel holds no heading of its own | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\commerce\CartDrawer\component.tsx:24-25` | — |
| `L6-2` the other way: the modal names nothing, so the interior opens with a heading | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2164-2167` | — |
| The cover overlay opens straight into a flat contract tree | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\search\GlobalSearchOverlay\component.tsx:193-195` | — |
| `L6-3` live: the interior writes its own inset, once | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2554` | — |
| `L6-4` live: the nested claim is made by a block, not by the overlay file | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\search\GlobalSearchResults\component.tsx:63-66` | — |
| The joined contract that carries the one nested surface | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2874-2879` | — |
| `L6-5` live: a `-card` key over a flat `Tree` region | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2881-2890` | — |
| Settled absence replaces the list surface instead of nesting inside one | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\search\GlobalSearchResults\component.tsx:71-78` | — |
| The overlay-file half is enforced, with its own message | neo CODE | `D:\Repositories\starci-academy-fe\plugins\eslint-canon\vendor-boundary.mjs:234-255` | — |
| The rule's path scope, which is also the seam the exception lives in | neo CODE | `D:\Repositories\starci-academy-fe\plugins\eslint-canon\vendor-boundary.mjs:246` | — |
| The exception is pinned by a test rather than by prose | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\search\GlobalSearchOverlay\component.test.tsx:57-58` | — |

## Scope

This module decides how many bounded surfaces exist once an overlay is open, and which tier is
allowed to declare a second one. It does not decide **which owner mounts the overlay** — that is
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) and
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-7`. It does not decide **how wide
it opens** — that is
[`l7-overlay-width-is-a-product-decision`](../l7-overlay-width-is-a-product-decision/INDEX.md). It
does not decide **what the interior regions contain** — that is
[`blocks`](../../../blocks/INDEX.md), where a block mounted inside an overlay resolves to
[`b1-one-surface-owner`](../../../blocks/laws/b1-one-surface-owner/INDEX.md) `B1-7`. The import ban
itself is stated as [`vendor-boundary`](../../../patterns/vendor-boundary/INDEX.md) `VENDOR-8` and
enforced by [`no-surface-branch-in-overlay`](../../../lints/vendor-boundary/INDEX.md).

Its output feeds one field of [`gate.schema.json`](../../gate.schema.json):
`LayoutPlan.overlays[].buildsCardInside`, plus the `reason` beside it.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump; changing the Law sentence is a major bump for the shelf,
because `sticky-chrome-band` `CHROME-7` and the `blocks` code `B1-7` both resolve into it. Changing
`buildsCardInside` in the schema is a GATE change and is made there first.
