---
id: fe-layouts-laws-l3-section-tabs-are-navbar-second-row-index
title: INDEX.md
slug: /gates/layouts/laws/l3-section-tabs-are-navbar-second-row
sidebar_label: l3-section-tabs-are-navbar-second-row
sidebar_position: 0
description: Binding rules for where a page's section tabs live, how they join the navbar above them, what may never repeat between the two rows, and what must be measured before the seam is called clean.
---

# INDEX.md

Version: `1.00` · Module: `l3-section-tabs-are-navbar-second-row` · Law: `L3` · Refusals: **7 across 2 records**

## Law

A page's section tabs are the **second row of the navbar above them**. They pin when it pins, they
carry no space away from it, and the reader sees exactly **one** divider under the finished stack at
every scroll position. They are not a block that floats at the top of the body.

The law binds a RESULT, not a container. Four things are checkable on a rendered route:

1. **Joined.** No spacing token, no visible line, no gap between the rows, at rest and while scrolling.
2. **Pinned together.** The section run stays on screen while the body moves under it.
3. **One stroke.** One bottom border under the pair, not one per row.
4. **One full-width baseline.** The tabs span the band's width even where the body is capped to a measure.

Two different mechanisms in the live tree produce those four, and both are legal. What is illegal is
a section run that scrolls away, a run separated from the row above by a spacing token, and a run
whose width is the body's measure rather than the band's.

**This is binding, not advisory.** Every page that owns a closed set of sections falls under exactly
one code below, including the code that emits no second row at all. Producing the right pixels
through the wrong home is still classified: `L3-2` is admitted, and it is admitted at a stated cost.

This module decides **where the section run lives and how it joins**. Whether a control is a section
tab at all belongs to [`L4`](../l4-tab-switches-panel-route-switches-page/INDEX.md); the offset value that anything
pinning beneath the stack must subtract belongs to `L9`; the width of the body under it belongs to
`L10`. None of those three ever appears in this module's output.

## Situation Codes

| Code | Situation | What the page emits |
|---|---|---|
| `L3-1` | The cluster layout can see the page's closed section set | the band's own `bottom` slot, filled — one landmark, one stroke, no seam to build |
| `L3-2` | Only the page can see its section set, so the band cannot carry it | a page-owned `nav` joined by `sticky top-16 -mt-px border-b` — a second landmark producing the first's result |
| `L3-3` | The cluster carries no page-owned sections | `double-navbar` with `bottom` **absent** — one row, and that is the classified answer |
| `L3-4` | A section run mounted inside the body as a content block | **refused** — it scrolls away and it takes the body's measure; move it to `L3-1` or `L3-2` |
| `L3-5` | Something appears in both rows once they are joined | name the repeated **token** and ask which token goes; never infer that a row goes |
| `L3-6` | Someone reports the seam as already following the reference | the claim is void until two real border values are read on the route; "tabs are adjacent" is not "the seam is clean" |
| `L3-7` | The control redraws one figure rather than changing which section is on screen | **not a second row at all** — this module does not apply, `L4` does |

Codes `L3-1` to `L3-3` answer *where does this page's section run live*. Codes `L3-4` to `L3-7` answer
*what has gone wrong, or what is not this law's business*.

`L3-3` IS A SITUATION, NOT AN OMISSION. Five of the six product clusters mount the band with the
`bottom` slot empty, and the slot is declared `optional` in the contract rather than left to each
page to remember. A one-row band is the proof the page was classified and found to own no sections.

`L3-2` IS ADMITTED, NOT PREFERRED. Course detail owns its four sections and the cluster layout above
it cannot reach them, so the page draws its own `nav` and joins it by overlapping the row above by
one pixel. The reader gets `L3-1`'s result. The document gets two navigation landmarks where
Dashboard has one, and that cost is recorded in [`audit.md`](./audit.md) rather than argued away.

There is no code for *tabs that replace the breadcrumb*. That absence is deliberate: removing the
breadcrumb because tabs exist was refused directly. Tabs move within one document and the breadcrumb
states route ancestry, so they answer different questions and both stay.

## Inputs

| Input | Evidence required |
|---|---|
| `sectionSet` | `closed-set-of-one-document` · `separate-routes` · `none` — separate routes are not sections, they are destinations |
| `visibility` | `cluster-layout-sees-them` · `only-the-page-sees-them` — which owner can name the set decides `L3-1` against `L3-2` |
| `home` | `band-bottom-slot` · `page-owned-nav` · `inside-body` — where the run is mounted today, read from source and not from the render |
| `seamProof` | the two border values read on the live route under one viewport, theme, locale and persona, or the literal `chua-do` |
| `repeatedToken` | whichever vocabulary appears in both rows, **by name** — destinations, icons, labels — required whenever `L3-5` is raised |

`visibility` is an input because it is the only thing separating the two legal homes, and it is a
fact about data flow rather than about taste. The cluster layout knows the dashboard's tab set from
the pathname alone, so the band carries it. The cluster layout cannot know a course's four sections
without the course, so the page carries it.

`seamProof` is an input because a rejection exists for skipping it. A previous proof established that
the tabs sat adjacent to the navbar and was then quoted as evidence that the seam was clean. The
reader still saw a divider.

## Invariants

- The pair reads as one landmark result: one bottom stroke, one full-width baseline, no gap at any
  scroll position.
- The section run stays on screen while the body scrolls beneath it. A run that scrolls away has
  failed the law even when it renders directly under the navbar at rest.
- A page-owned run joins by overlapping the row above, never by sitting a spacing token below it.
  The joining class is a negative offset, so a positive gap anywhere in that chain is the bug.
- The run's width is the band's width. It crosses the viewport even where the body under it is capped
  to a reading measure.
- Anything pinning beneath a two-row stack subtracts the height of THAT stack through that stack's own
  token. This module only names the obligation; `L9` owns the value.
- Two joined rows never carry the same token twice. Which token leaves is a product answer.
- The breadcrumb survives the arrival of tabs. It is not a repeat of them.
- `optional: true` on the band's second slot is the mechanism for `L3-3`. A page that owns no sections
  omits the slot; it does not pass an empty run.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A second landmark, when the layout cannot see the sections.** `L3-2`. Admitted for course detail,
  where the four sections belong to the course rather than to the cluster. The departure is the extra
  `nav`, never the loosened seam: the pixel result is held to `L3-1` exactly.
- **The first row keeps its destinations.** `L3-5`, and this is the one the founder reversed himself
  on. Round one refused repeating the route links above the tabs. Round two refused acting on that,
  and named the icons instead. The settled reading is that a repeat is refused at the level of the
  TOKEN, so the question is which token, and the answer to that question is asked rather than derived.
- **A breadcrumb beside tabs.** `L3-4` does not apply to a breadcrumb inside the narrative. Navigation
  is not one job, and removing the breadcrumb because the tabs arrived was refused explicitly.
- **A figure's own control.** `L3-7`. A control that changes one parameter of one plot never earns the
  second row, however wide it looks. It is refused here and decided by `L4`.
- **A run the founder has not ruled on.** Where a page mounts a section run inside the body and no
  rejection line covers that page, the law is not satisfied and the breach is not asserted either.
  Record the divergence and ask. The live profile cluster is exactly this case.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A gap under the navbar makes tabs read as a content block | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:439` | "User: \"tại sao cái navbar top bên phải không render kiểu như bên trái\"." |
| The whole tab chrome stays visible while scrolling | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:857` | "Dashboard reference giữ toàn bộ tab chrome nhìn thấy khi cuộn." |
| Tabs adjoin the navbar and the breadcrumb stays | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1315` | "User chỉ rõ hai vùng không cùng vai trò và yêu cầu follow Dashboard/legacy." |
| Adjacency is not a clean seam, and an old proof cannot stand in for the measurement | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1387` | "User vẫn thấy divider; proof cũ chỉ xác nhận tabs đã sát navbar, chưa xác nhận seam sạch." |
| Leading icons were once required on the section run | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1388` | "User chỉ rõ icon còn thiếu so với reference." |
| Round one: with tabs present, the navbar content above comes down | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:521` | "với tabs này thì bỏ mấy cái nội dung ở navbars ở trên đi" |
| Round two, superseding: the content stays and the icons go | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:598` | `nhầm không phải bỏ nội dung, mà là bỏ icon` |
| `L3-1`: one sticky container holds both rows and one `border-b`; the second slot is `optional` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1691-1698` | — |
| `L3-1` in use: the band fills its second slot only where the layout can name the set | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:122-129` | — |
| `L3-1` reaches the strip through the band's own slot, not through the page | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\component.tsx:113-124` | — |
| The section run is full-width by contract, not by call site | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1739-1745` | — |
| `L3-2`: a page-owned `nav`, pinned at the navbar's height, joined by one negative pixel, one `border-b` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2226-2231` | — |
| `L3-2` in use: the section run is a peer of the body, not the first thing inside it | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\component.tsx:459-475` | — |
| A run mounted inside the body, unpinned and unjoined — measured, unruled | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:781-788` | — |
| The band above that run is mounted with no second row of its own | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\profile\layout.tsx:11` | — |
| The icon removal of round two is what the live tree carries: four text-only section tabs | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\component.tsx:465-470` | — |
| The destinations of round two are also what the live tree carries: the primary row still maps all routes | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:113-121` | — |

## Scope

This module decides where a page's section run is mounted and how it meets the row above it. It
covers the six product route clusters that wear the band, and it covers every page inside them that
owns a closed set of sections.

It does not decide whether a control is a section tab: a control that redraws one figure is `L4`,
and calling it a section tab is the misreading `L3-7` exists to catch. It does not decide the offset
value beneath the finished stack, which is `L9`, nor the measure of the body under it, which is
`L10`. It does not decide what the sections CONTAIN, which is [`blocks`](../../../blocks/INDEX.md).

Its output feeds `LayoutPlan.frameContract` and the `navigation` region of
[`gate.schema.json`](../../gate.schema.json). The choice between `L3-1` and `L3-2` is visible there
as whether `navigation` is a slot of the frame or a region of the page.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md). Adding or removing an `L3-` code is a rule change. Reading a new
rejection line that CONFIRMS an existing code is not. Changing the four checkable results in `Law` is
a major bump for the shelf, because `L9`'s offset tokens are derived from the row count this law
fixes.
