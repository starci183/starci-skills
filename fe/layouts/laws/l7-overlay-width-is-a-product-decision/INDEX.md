---
id: fe-layouts-laws-l7-overlay-width-is-a-product-decision-index
title: INDEX.md
slug: /fe/layouts/laws/l7-overlay-width-is-a-product-decision
sidebar_label: l7-overlay-width-is-a-product-decision
sidebar_position: 0
description: Binding rules for declaring how wide an overlay opens, the reasons that count as evidence for that value, and the one covering surface whose width cannot be declared at all.
---

# INDEX.md

Version: `1.00` · Module: `l7-overlay-width-is-a-product-decision` · Law: `L7` · Refusals: **2 across 1 record**

## Law

How wide an overlay opens is a **product decision**, judged from what the reader has to do inside
it, and it is declared **with its reason standing beside the value**. There is no default called
"a modal is narrow". The refusal that removed it says so directly:

> Thầy ưu tiên dễ thao tác, không bắt modal hẹp

A default does exist, and it is not that one. `ModalShell` resolves an absent `size` to `md`, so a
plan that declares nothing has still chosen a width — it has only chosen it without judging it. In
this law an undeclared width is an **unjudged** width, never a safe one.

A reason counts as evidence when it describes **what the content does at that width**. A column of
paired values needs enough room that an amount stays on the row with its label. A workspace needs
enough room that the reader can change groups and read context without closing anything. The second
refusal is that judgement made against two whole directions at once:

> Chưa dùng đủ chiều rộng để đổi nhóm và xem ngữ cảnh đồng thời

A reason does **not** count when it describes the kind of object: that it is a modal, that the last
modal was this wide, that narrow looks tidier. Those sentences would produce the same value for a
sign-in form and for a search workspace, which is exactly the collapse the two refusals undid.

**This is binding, not advisory.** Every overlay a plan opens falls under exactly one code below,
including the code that emits nothing because the shell cannot carry the value.

This module decides **the width of the covering surface**. How many bounded surfaces live inside it
is [`l6-overlay-is-already-a-surface`](../l6-overlay-is-already-a-surface/INDEX.md), and how the
interior divides the width it was given is
[`l10-region-width-belongs-to-its-owner`](../l10-region-width-belongs-to-its-owner/INDEX.md).

## Situation Codes

| Code | Situation | What the plan declares |
|---|---|---|
| `L7-1` | The plan opens an overlay on `ModalShell` | one value of `xs · sm · md · lg · cover`, named, and a reason about the content beside it |
| `L7-2` | The reader answers one statement, read a control at a time | the narrowest value the single column survives — `xs` is the live measurement |
| `L7-3` | The reader reads paired values line by line, a label and an amount per row | wide enough that no amount wraps under its label — `sm`, with `xs` refused at the call site |
| `L7-4` | The reader has to work across several regions at once | `cover`, plus the regions named as simultaneously visible |
| `L7-5` | The plan offers a reason about the kind of object rather than about the content | **no value ships** — the reason is refused and the width goes back to the founder |
| `L7-6` | The plan declares nothing and lets the shell resolve | `md`, written out as a chosen value with its own reason; silence is not a declaration |
| `L7-7` | The request is about how wide a drawer or a dropdown opens | **nothing** — unrepresentable; it goes into `owed`, and the drawer declares only its open edge |

`L7-1` is the frame every other code sits in. `L7-2` to `L7-4` are the three reader tasks that have
been measured in the live tree, each with a running value behind it. `L7-5` to `L7-7` are the three
ways the answer is *not* a number today.

`L7-3` IS THE ONLY CODE WITH ITS REASON WRITTEN WHERE THE VALUE IS. `CoursePriceOverlay` records at
its own call site that `sm` was taken over `xs` because at `xs` the amounts wrap under their labels,
"which is the moment the column stops being a column". That sentence is the shape of a valid reason,
and it is the only one of the four running overlays that has one.

`L7-6` IS A SITUATION, NOT AN OMISSION. No live overlay is at `md`, so a plan choosing it is choosing
the value the shell would have produced anyway. That is legal and it still has to be written, because
a reader of the plan cannot otherwise tell a judged `md` from a forgotten one.

`L7-7` IS NOT A GAP IN THE PLAN. `DrawerShell` takes no `size`, so a drawer's width is entirely the
vendor's today and nothing in the live tree rules on it. `DropdownShell` is in the same position. The
honest output is a refusal with the reason recorded, not a width class painted onto a contract
inside.

## Inputs

| Input | Evidence required |
|---|---|
| `overlayShell` | `ModalShell` · `DrawerShell` · `DropdownShell` — only the first can carry a width at all |
| `readerTask` | `answer-one-statement` · `read-paired-rows` · `work-across-regions` · `unknown` |
| `width` | one of `xs` `sm` `md` `lg` `cover`, by name, never absent while `overlayShell` is `ModalShell` |
| `widthReason` | one sentence about how the content behaves at that width, and it goes into the source beside the value, not only into the plan |
| `narrowerBreak` | what wraps, stacks or disappears one step narrower — the thing that makes the value a measurement rather than a preference |
| `simultaneousRegions` | the regions that must be readable at the same time, by name, required whenever `width` is `cover` |

`readerTask` is the whole criterion, and it is answered by describing an action rather than by naming
the panel. "Sign in" is not a task description; "read one field, answer it, move to the next" is.

`narrowerBreak` is what stops a reason from being a preference. `CoursePriceOverlay` can name it —
amounts wrap under labels — so `sm` is a measurement. An overlay that cannot name what breaks one
step narrower has not judged its width; it has picked one.

`simultaneousRegions` is an input rather than a consequence, because `cover` is only earned by naming
the things that must stay on screen together. Once named, those regions carry their own widths under
[`l10-region-width-belongs-to-its-owner`](../l10-region-width-belongs-to-its-owner/INDEX.md), not
under this law.

## Invariants

- Every overlay drawn on `ModalShell` declares a width. Taking the shell's `md` is a declaration only
  when `md` is written down.
- The reason names content behaviour. A reason that would read the same for a sign-in form and for a
  search workspace is not a reason.
- The reason lives beside the value in source, not only in the plan record, because the next person
  to widen the overlay reads the call site and never the record.
- The width belongs to the covering surface. Which region inside gets which share of it is `L10`, and
  the two are declared separately even when one plan writes both.
- A drawer declares an open edge and nothing else. A dropdown declares neither.
- The scale is the shell's five values and no sixth exists. A width that is not one of them is a
  shell change, made in `ModalShell` first.
- The four bounded values are the ordinary Tailwind measures `max-w-xs`, `max-w-sm`, `max-w-md` and
  `max-w-lg`, which is `20rem`, `24rem`, `28rem` and `32rem`, and `cover` is full bleed. They are
  therefore directly comparable with any `max-w-*` an interior contract writes, and a plan that
  writes both says which of the two the reader meets.
- `lg` has no call site anywhere in the live tree. Reaching for it means naming what fails at `sm`
  and what is wasted at `cover`, in that plan, before it is used.
- An interior contract that caps its own measure is a second owner of the same narrowness, and the
  plan says which of the two the reader actually meets.
- `cover` brings a shell inset with it. That inset is `L6-3` and is declared there, not here.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A panel that is also a whole route.** `L7-2`. `SignInOverlay` opens at `xs`, and the contract
  inside it, `centred-page-column`, already carries `max-w-md` with the reason written in its `why`:
  a form running the width of a desktop screen makes the eye travel between a label and the box it
  names. That cap is correct for the route where the same panel stands alone. Inside the overlay the
  shell is the narrower of the two owners by two steps of the same scale — `xs` resolves to
  `max-w-xs` and the cap is `max-w-md` — so the cap never binds, and the value the reader meets is
  the undocumented `xs`.
- **A drawer that changes its open edge by viewport.** `L7-7`. `StarCiAiDrawer` reads
  `(max-width: 639px)` and opens from the bottom instead of the right. That is a placement decision
  and it is legal; reading it as a narrow-versus-wide switch is the mistake the code exists to stop.
- **A cover overlay whose inset comes from the shell.** `L7-4` hands this to `L6-3` rather than
  keeping it. `ModalShell` writes `p-4` on the dialog at `size="cover"` and nowhere else, which is why
  `global-search-workspace` carries no padding of its own.
- **A running width with no written reason.** `L7-1`. Three of the four live values are in this
  state. They are legal, because they were judged in a design record, and they are a measured debt,
  because the record is not where the next reader looks. This exception covers what already shipped
  and licenses nothing new.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| "A modal must be narrow" is a rejected assumption, not a default | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:259` | "Thầy ưu tiên dễ thao tác, không bắt modal hẹp" |
| Two narrow directions were refused by naming what the reader could not do in them | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:260` | "Chưa dùng đủ chiều rộng để đổi nhóm và xem ngữ cảnh đồng thời" |
| The scale is five values and it belongs to the shell | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:13` | — |
| The real default is `md`, resolved when the caller says nothing | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:36` | — |
| The `size` prop selects one vendor modifier class per value | neo CODE | `D:\Repositories\starci-academy-fe\node_modules\@heroui\styles\dist\components\modal\modal.styles.js:33-53` | — |
| Those modifiers resolve to four `max-w-*` steps and one full bleed | neo CODE | `D:\Repositories\starci-academy-fe\node_modules\@heroui\styles\dist\components\modal.css:220-250` | — |
| Which makes the scale `20rem` `24rem` `28rem` `32rem`, the repo overriding none of them | neo CODE | `D:\Repositories\starci-academy-fe\node_modules\tailwindcss\theme.css:335-338`, and `D:\Repositories\starci-academy-fe\src\app\globals.css:35-38` | — |
| `L7-2` live: the sign-in panel opens at `xs`, with no reason at the call site | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\auth\SignInOverlay\component.tsx:39` | — |
| The narrowness reason for that same panel, written one tier down on the contract | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1747,1758` | — |
| `L7-3` live: the price panel opens at `sm` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\courses\CoursePriceOverlay\component.tsx:41` | — |
| The one reason written beside its own value, and the shape every reason should take | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\courses\CoursePriceOverlay\component.tsx:20-22` | — |
| `L7-3` live a second time: checkout opens at `sm`, reason unwritten | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\commerce\CheckoutOverlay\component.tsx:121` | — |
| `L7-4` live: Global Search opens at `cover` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\search\GlobalSearchOverlay\component.tsx:193` | — |
| What `cover` buys, named as three regions that stay visible together | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2857-2864` | — |
| The root contract the cover overlay opens into, which declares no width of its own | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2849-2855` | — |
| The cover inset is the shell's, which is why the interior carries none | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:40` | — |
| `L7-7`: a drawer has a placement and no size | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\DrawerShell\index.tsx:33,40,62` | — |
| A drawer that declares nothing at all and takes the vendor's right edge | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\commerce\CartDrawer\component.tsx:116-120` | — |
| A drawer whose only responsive declaration is which edge it opens from | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\ai\StarCiAiDrawer\index.tsx:19` | — |
| `L7-7`: a dropdown declares a placement and never a measure | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\DropdownShell\index.tsx:6` | — |
| The gate field exists and its enum is smaller than the measured set | neo CODE | `D:\Repositories\starci-academy-backend\.claude\fe\layouts\gate.schema.json:382-385` | — |

## Scope

This module states `L7` for the whole [`layouts`](../../INDEX.md) shelf, and it decides one thing:
how wide the covering surface opens.

It does not decide how many bounded surfaces exist once that surface is open, which is
[`l6-overlay-is-already-a-surface`](../l6-overlay-is-already-a-surface/INDEX.md). It does not decide
how the interior divides the width it was handed, which is
[`l10-region-width-belongs-to-its-owner`](../l10-region-width-belongs-to-its-owner/INDEX.md), and the
three-column selector inside Global Search is L10's sentence rather than this one's. It does not
decide whether a control inside the overlay runs the full measure or stands compact beside a figure —
that is [`l11-full-width-run-versus-compact-control`](../l11-full-width-run-versus-compact-control/INDEX.md),
whose `L11-4` closes the compact case by handing the bounded surface back to `L6`. It does not decide
who mounts the overlay, which is
[`l1-persistent-owner-mounts-once`](../l1-persistent-owner-mounts-once/INDEX.md) together with
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) and
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-7`. What the regions
inside contain is [`blocks`](../../../blocks/INDEX.md).

Its output feeds one field of [`gate.schema.json`](../../gate.schema.json):
`LayoutPlan.overlays[].width`, plus the `reason` beside it. That field's enum currently admits two
values while four are running, which is recorded in [`audit.md`](./audit.md) and is a GATE change.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md). A new situation code is a minor bump. Changing the Law sentence is a
major bump for the shelf, because `L6` cites this module for width and the archetype modules cite it
through their overlay rows. Changing the `width` enum in the schema is a GATE change and is made
there first, because `blocks` reads that file and not this one.
