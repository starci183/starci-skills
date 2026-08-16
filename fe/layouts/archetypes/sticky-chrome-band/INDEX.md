---
id: fe-layouts-archetypes-sticky-chrome-band-index
title: INDEX.md
slug: /fe/layouts/archetypes/sticky-chrome-band
sidebar_label: sticky-chrome-band
sidebar_position: 0
description: Binding rules for the sticky chrome band a route cluster wears above its body, its second row, its controls, its narrow form and the overlays it owns.
template: layouts-v1
---

# INDEX.md

Version: `1.00` · Module: `sticky-chrome-band` · Shelf: [`layouts`](../../INDEX.md)

## Law

A route cluster that a reader must be able to LEAVE wears one sticky band above its body. The band
carries the brand, the destinations out of this page, and the account tools. The body is the band's
SIBLING, never its child.

The band is ONE landmark even when it has two rows. A page's own section tabs are the band's second
row — joined to the first, sticky with it, sharing its single bottom border. They are not a block
that floats at the top of the body.

**Two rows means two heights.** Whatever pins itself under the band subtracts the height of THAT
band, through that band's own token. One offset token shared between a one-row page and a two-row
page is a bug with a plausible name.

**The band never says twice what its second row already says.** When a page owns contextual tabs,
the destinations above them come down.

## Situation Codes

| Code | Situation | Emits |
|---|---|---|
| `CHROME-1` | Cluster with no page-owned sections: one row | `double-navbar` with `bottom` absent; offset token `top-rail` |
| `CHROME-2` | The page owns a finite set of sections inside one document: two rows | `double-navbar` with `bottom`; second row `sticky top-16 -mt-px border-b`; offset token `top-course-rail` |
| `CHROME-3` | A control changes WHICH content region is on screen | full-width line, `underlined-tab-strip` `w-full` |
| `CHROME-4` | A control changes ONE PARAMETER of one figure | intrinsic control beside that figure, inside the body |
| `CHROME-5` | A choice between faces of one page versus a move to another page | tab state, or `router.push` / `router.replace` |
| `CHROME-6` | The band at a narrow width | route links and the desktop tool subgroup disappear as clusters; nothing replaces them |
| `CHROME-7` | A control in the band opens a panel | the LAYOUT mounts the overlay once; no card inside it; width is chosen, not defaulted |
| `CHROME-8` | The second row already carries this page's destinations | the first row drops the repeated destinations |

`CHROME-3` and `CHROME-4` are the two arms of one classification and are stated in full below,
because the founder ruled both ways.

### `CHROME-1` versus `CHROME-2`

A cluster is two-row only when the PAGE owns a closed set of sections of one document — course
detail owns explore/course/community/review; dashboard owns its tab run. A page whose "sections" are
separate routes is not two-row; that is `CHROME-5` and the destinations belong to routing.

`CHROME-2` joins the rows physically, not visually: one sticky landmark, one `border-b`, the second
row overlapping the first row's stroke by exactly one pixel.

| Rows | Offset token | Value | Used by |
|---|---|---|---|
| one | `top-rail` | `--spacing-rail: 5.5rem` | `learn-shell-frame`, `content-reader-frame` |
| two | `top-course-rail` | `--spacing-course-rail: 6.1rem` | `main-then-rail` |

A rail that pins under a two-row band with the one-row token slides under the second row. That is the
rejection recorded for L9, not a hypothetical.

### `CHROME-5` — the test for tab versus route

Parallel modes inside one page owner travel by query parameter on ONE route. A child route is
correct only when each mode owns its own breadcrumb, its own metadata or its own landmark — that is,
when the mode is a document rather than a face.

Where the requirement is silent about whether a mode must be shareable by link, that is a question to
ASK, not a gap to fill. The blind rebuild of the catalog page pushed `q` and `page` onto the URL
while the real source keeps them in memory, purely because nothing in the requirement said either
way.

*Anchor: `D:\Repositories\starci-academy-backend\.claude\fe\layouts\proofs\INDEX.md:31` and `:30`.*

### `CHROME-3` versus `CHROME-4` — a criterion, not a default

The founder ruled this twice in each direction inside one record. Both rulings bind, and neither is
the fallback.

| Round | Rejected | Chosen | Why (verbatim) |
|---|---|---|---|
| r1 | Intrinsic secondary year control at the row end | Full-width primary underline run | User: "nó phải là 1 line dài như shellnav" |
| r2 | Keep year selector intrinsic at the summary row edge | Full-width primary line | User requires "1 line dài như shellnav" |
| r3 | Treat year parameter as ShellNav-level navigation | Compact control beside the plot summary | It changes one visualization parameter, not the page's content region |
| r4 | Full-width underline years | Intrinsic segmented years | The former is secondary region navigation, not a local calendar parameter |

**The question that separates them:** *after this control is used, has the page's content REGION
changed, or has one figure been redrawn with a different parameter?*

- Region changed → `CHROME-3`. Full width, in the band's second row, as one line like the shell's.
- One figure redrawn → `CHROME-4`. Compact, beside that figure, inside the body.

Neither the control's vendor skin nor its shape decides this. A vendor calling its underline
`secondary` does not make the control secondary in the product, and a segmented control does not
become navigation by being wide.

## Inputs

| Input | Evidence required |
|---|---|
| route cluster | Which `layout.tsx` mounts the band, and how many pages sit under it |
| page sections | Whether this page owns a closed set of sections of one document, or separate routes |
| control effect | For each control: does it change the content region, or one parameter of one figure |
| destinations | What the second row already offers, so the first row can drop the repeats |
| panels | Which controls in the band open a panel, and whether that panel must outlive the route |
| narrow | Which clusters of the band disappear, and what — if anything — replaces them |

## Invariants

- The body is a sibling of the band. `nav-over-body-page` puts navigation and body side by side; the
  band never wraps the routed surface.
- Two rows are one sticky landmark with one `border-b`.
- The second row is joined to the first with `-mt-px`, not spaced from it. There is no gap, at any
  scroll position.
- Every sticky offset under the band names the token of THIS band. `top-rail` and `top-course-rail`
  are never interchangeable.
- A control that changes the content region runs `w-full`. A control that changes one figure's
  parameter does not.
- The band mounts its overlays once per cluster, never once per page.
- An overlay builds no card inside itself.
- Overlay width is stated in the plan with a reason. "Modal, therefore narrow" is not a reason.
- When the second row carries this page's destinations, the first row does not repeat them.
- At a narrow width, groups disappear as groups; a half-disappeared cluster is a bug.

## Exceptions

Exceptions are part of the rule. Each names the code it modifies.

- **`CHROME-6` has no hamburger.** The live band drops route links and the search/locale/theme group
  and replaces them with nothing; brand, cart, notification and account remain. Adding a hamburger is
  a product decision that needs its own ruling — it is not the obvious completion of this rule.
- **`CHROME-5` allows a tab to write a query parameter.** Dashboard tabs call `router.replace` with
  `?tab=`, which changes the URL without changing the page. This is the one place a tab touches the
  URL, and it stays a tab because the route owner does not change. A tab may never rewrite the
  breadcrumb.
- **`CHROME-2` coexists with a breadcrumb.** Tabs navigate sections; the breadcrumb keeps route
  ancestry. Removing the breadcrumb because tabs exist was rejected explicitly.
- **`CHROME-7` overlays may be full-cover.** `GlobalSearchOverlay` opens at `size="cover"`. Width
  follows the work inside the panel, not the word "modal".
- **`CHROME-8` binds even where the live tree breaks it.** The primary row still maps all three
  routes over course detail. A new plan copies the ruling, not the source.

## Anchor

Rejection anchors — path, line, verbatim `Why`:

| Code | Anchor | Rejected → Chosen | Why (verbatim) |
|---|---|---|---|
| `CHROME-2` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:439` | Tabs page có khoảng cách như một block nội dung → Tabs liền dưới primary navbar | "tại sao cái navbar top bên phải không render kiểu như bên trái" |
| `CHROME-2` | `…\course-detail-ownership-and-rail.md:857` | `position=relative` khiến tabs biến mất khi scroll → `sticky top-16` dưới primary navbar | "Dashboard reference giữ toàn bộ tab chrome nhìn thấy khi cuộn." |
| `CHROME-2` | `…\course-detail-ownership-and-rail.md:1315` | Tabs trôi trong body và breadcrumb bị loại → Navbar-adjacent tab layer cộng route breadcrumb | "User chỉ rõ hai vùng không cùng vai trò và yêu cầu follow Dashboard/legacy." |
| `CHROME-5` | `…\course-detail-ownership-and-rail.md:440` | Tabs thay thế breadcrumb → Tabs và breadcrumb cùng tồn tại, mỗi loại đúng vai trò | "User hỏi trực tiếp vì sao bên trái không có breadcrumbs. Trò nhận sai vì đã loại nó khỏi concept." |
| `CHROME-5` | `D:\Repositories\starci-academy-backend\.workflows\designs\starci-academy\learn-branch.md:757` | Use simple route links as mobile tabs → `LearnMobileTabBar` view owner | "Legacy mobile tabs switch contents, lesson and outline views without changing route." |
| `CHROME-8` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:521` | Lặp `Trang chủ / Khóa học / Liên hệ` trên primary navbar ngay phía trên course-detail tabs → Giữ brand + tools ở primary row và để tabs làm điều hướng ngữ cảnh | "với tabs này thì bỏ mấy cái nội dung ở navbars ở trên đi" |
| `CHROME-1`·`CHROME-2` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:279` | Dùng generic `top-rail` 5.5rem → Course-specific `top-course-rail` 6.1rem | "Generic offset khiến rail chui lên dưới course navbar." |
| `CHROME-3` | `D:\Repositories\starci-academy-backend\.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82` | Intrinsic secondary year control at the row end → Full-width primary underline run | User: "nó phải là 1 line dài như shellnav" |
| `CHROME-3` | `…\dashboard-contribution-primary-tabs.md:173` | Keep year selector intrinsic at the summary row edge → Full-width primary line | User requires "1 line dài như shellnav" |
| `CHROME-4` | `…\dashboard-contribution-primary-tabs.md:242` | Treat year parameter as ShellNav-level navigation → Compact control beside the plot summary | "It changes one visualization parameter, not the page's content region." |
| `CHROME-4` | `…\dashboard-contribution-primary-tabs.md:291` | Full-width underline years → Intrinsic segmented years | "The former is secondary region navigation, not a local calendar parameter." |
| `CHROME-7` | `D:\Repositories\starci-academy-backend\.workflows\designs\starci-academy\global-search-modal-20260815.md:259` | Giả định modal phải hẹp/gọn → Search workspace lớn có sidebar và context pane | "Thầy ưu tiên dễ thao tác, không bắt modal hẹp" |
| `CHROME-7` | `…\global-search-modal-20260815.md:738` | `SurfaceCard` trong overlay → Tree regions trực tiếp | "Overlay là bounded surface, nested card tạo hai surface owners" |

Code anchors in the live repository `D:\Repositories\starci-academy-fe` (branch `main`):

| Claim | Anchor |
|---|---|
| One sticky landmark, two rows, one `border-b` | `src\components\contracts\index.ts:1691-1698`, classes at `:1692` |
| The second row joins the first at one pixel | `src\components\contracts\index.ts:2226-2230` (`sticky top-16 z-50 -mt-px … border-b`) |
| Full-width content-region control | `src\components\contracts\index.ts:1740` (`underlined-tab-strip` is `["w-full"]`), used at `ShellNav\component.tsx:113` and `PublicProfileLayout\component.tsx:103` |
| Intrinsic figure-parameter control | `src\components\contracts\index.ts:1244-1250` (`years: choice-tabs` at the right edge of a `justify-between` heading row) |
| Offset tokens | `src\app\globals.css:55-56` (`--spacing-rail`, `--max-height-rail`), `:63` (`--spacing-course-rail`) |
| Token use | `top-course-rail` only at `contracts\index.ts:2235`; `top-rail` at `:339` and `:1952,1957` |
| Narrow: route links vanish as a group | `src\components\contracts\index.ts:1716` (`hidden flex-1 … md:flex`) |
| Narrow: search/locale/theme vanish as a group | `src\components\contracts\index.ts:1731` (`hidden items-center gap-2 md:flex`) |
| The band mounts three overlays once | `src\components\layouts\ShellNav\index.tsx:162-170`, with the reason at `:163-168` |
| Tab that writes a query parameter | `src\components\layouts\ShellNav\index.tsx:131-133` (`router.replace`) |
| Six clusters mount the band | `src\app\[lang]\{cart,courses,dashboard,league,practice,profile}\layout.tsx` — `src\app\[lang]\courses\layout.tsx:31` |
| Body is a sibling of the band | `src\app\[lang]\courses\layout.tsx:28-41` (`nav-over-body-page`: `navigation` and `body` as peers) |
| BREACH — routes still repeated over course detail | `src\components\layouts\ShellNav\index.tsx:113-121` |

## Scope

This module owns the outermost frame of the six product route clusters — `cart`, `courses`,
`dashboard`, `league`, `practice`, `profile` — which is 49 of 51 pages, and everything that pins
itself under that frame.

It does not own what sits inside a region: that is `blocks`. It does not own the interior of the
overlays it mounts — see the shelf's `Owed`. A column standing beside the body belongs to
[`destination-column`](../destination-column/INDEX.md); a persistent
owner that draws nothing belongs to
[`invisible-owner`](../invisible-owner/INDEX.md).

## Version Rule

An accepted rule change increments all five records of this module by `0.01` and is recorded in
[`changelog.md`](./changelog.md). Adding or removing a `CHROME-` code is a rule change. Reading a new
rejection line that CONFIRMS an existing code is not.
