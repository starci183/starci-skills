---
id: fe-layouts-laws-l4-tab-switches-panel-route-switches-page-index
title: INDEX.md
slug: /fe/layouts/laws/l4-tab-switches-panel-route-switches-page
sidebar_label: l4-tab-switches-panel-route-switches-page
sidebar_position: 0
description: Binding rules for what a control changes when the reader presses it — a page, a panel, a parameter or a scroll position — and which of those four is allowed to touch the URL.
---

# INDEX.md

Version: `1.00` · Module: `l4-tab-switches-panel-route-switches-page` · Law: `L4` · Refusals: **6 across 3 records**

## Law

A control that takes the reader to a **different page owner** pushes a path. A control that changes
**which panel of the same page owner is shown** does not push a path.

Between those two sits a second decision the first one does not answer: whether the panel choice
must survive a reload and a pasted link. When it must, the page owner reads the choice from a query
param that the control writes with `replace` — same page, no Back step. When it need not, the choice
is local view state and the URL never moves.

A third case is neither. A control that changes **one parameter of one block** is not page
navigation at all, so it keeps the width of the words on it and stays inside the block's own column
rather than becoming a line the page is divided by.

**This is binding, not advisory.** Every pressable control that changes what the reader sees falls
under exactly one code below, including the one that emits nothing because the requirement was never
stated. "It is just a tab" is where this law gets skipped, and four visually identical `choice-tabs`
runs in the live tree do four different things.

This module decides **what the control changes and whether the URL moves**. Where the control sits,
how wide it is drawn and which seam it shares belong to
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) and to
[`fe/principles`](../../../principles/gap/INDEX.md); this module names the width class only as a
consequence of the code, never as the choice itself.

## Situation Codes

| Code | Situation | What the layout emits |
|---|---|---|
| `L4-1` | The control takes the reader to a different page owner | `router.push(path)`; a new history entry; the destination owns its own metadata and landmark |
| `L4-2` | The control swaps the main content region of the same page owner, and the choice must survive reload and a pasted link | `router.replace` of a query param; the page owner reads the key and resolves an absent or unknown value to the resting panel |
| `L4-3` | The control swaps a panel of the same page and the choice is a private reading position | local view state; **no URL mutation at all** |
| `L4-4` | The control changes one parameter of one block, not the page's content region | local state, intrinsic width, inside the block's own column — never a full-width line |
| `L4-5` | The control moves the viewport inside one continuous document | scroll to a section addressed by identity; no panel swap, no route |
| `L4-6` | Choosing a row must show more before the reader commits | preview writes local selection; a **separate** control does the `push` |
| `L4-7` | Nobody said whether the panel choice must be shareable | **nothing** — ask; this is a product question and not something to infer |

Codes `L4-1` to `L4-3` answer *does the URL move, and how far*. Codes `L4-4` to `L4-6` answer *is
this navigation at all*. `L4-7` is the exit when the first question cannot be answered from evidence.

`L4-7` IS A SITUATION, NOT A STALL. Shareability is a decision about whether a learner can send
somebody the Community tab of the dashboard. Nothing in a component tree implies it, and choosing
`L4-2` "because a query param is more flexible" spends a history-visible URL on a preference the
product never asked for.

`L4-5` IS ALSO A SITUATION, and it is the one most often mistaken for `L4-2`. A strip of tabs that
scrolls the reader down one long page and a strip of tabs that replaces the main region are the same
silhouette, the same leaf and the same sticky band. Only the handler tells them apart.

There is no code for *a tab that both routes and swaps a panel*. That absence is deliberate: a
control with two destinations has no honest current state, because the underline can only light one
of them.

## Inputs

| Input | Evidence required |
|---|---|
| `destinationKind` | `other-page` · `panel-of-this-page` · `parameter-of-one-block` · `position-in-this-document` |
| `shareability` | `must-survive-reload` · `private-reading-position` · `unstated` — from the founder, never inferred from the component |
| `panelOwner` | the component that reads the key and resolves it to a panel, **by name**, required whenever `destinationKind` is `panel-of-this-page` |
| `restingPanel` | which panel an absent or unrecognised key resolves to |
| `historyIntent` | `new-entry` · `no-entry` — a panel switch never earns a Back step |
| `sectionIdentity` | for `L4-5`, the `data-node` each destination is addressed by |
| `commitControl` | for `L4-6`, the named control that performs the navigation the preview refused to perform |

`shareability` is an input rather than a derivation because both answers ship in this repository and
neither is a default. The dashboard's four tabs survive a reload; the learn shell's mobile views do
not, and the second was ruled deliberately.

`restingPanel` exists because a panel key is not a route. A route that does not exist is a 404, and
a panel key that does not exist must degrade to the resting panel rather than blank the main region.

## Invariants

- One control, one destination kind. A control that would need two is two controls.
- A panel switch writes no history entry. Back returns the reader to the page they came from, not to
  the tab they were on a moment ago.
- The page owner resolves the panel key. Chrome may write the key, but the component that reads it
  and picks a panel is the page, and it is named in the plan.
- An unrecognised panel key resolves to the resting panel. It never renders an empty main region and
  never redirects.
- `L4-3` writes nothing to the URL. Updating only the selected underline while the panel stays put
  was refused; the panel is the proof the control worked.
- A parameter control keeps the width of its own words. Stretching it across the measure turns a
  block's setting into a band the page is divided by, and the reader reads that band as region
  navigation.
- `L4-5` addresses its destinations by identity. Ordinal targeting over a `querySelectorAll` result
  sends the reader to the wrong section the day a section is added.
- A preview and a commit are different controls with different labels. A row that navigates on click
  destroys the panel that exists to be read before committing.
- Every code holds across pending, empty and failed. A skeleton that swallows the tab strip, or a
  failure that turns a panel switch into a redirect, changes the law at the moment the reader can
  least check it.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A panel choice that must be shareable.** `L4-2`, and it is the only code allowed to touch the
  URL without changing the page. It is earned by a stated requirement, not by the tab count.
- **The dashboard is the only live `L4-2`.** Its key vocabulary lives in the navbar rather than in
  the page that owns the panels. That is a measured defect carried in `audit.md`, not a shape to
  copy into a second page.
- **A full-width strip that scrolls.** `L4-5`. Course detail's four section controls are chrome by
  placement and a scroll by behaviour. The exception is the placement, never the handler.
- **A parameter control that the founder called primary.** `L4-4`. Primary hierarchy is about how a
  control is drawn; it does not promote a block's parameter into the page's content region. The
  founder ruled the SHAPE of that control both ways, and that criterion is
  [`l11`](../l11-full-width-run-versus-compact-control/INDEX.md), which `L4-4` reads rather than
  decides. See the flip in `changelog.md`.
- **A preview that is itself a fetch.** `L4-6` still forbids the `push`. The panel may load, fail
  and retry on its own while the commit control stays untouched.
- **Requirement unstated.** `L4-7`. Refuse and ask. A guessed `?tab=` is far harder to remove later
  than an unanswered question is to ask now.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A panel must visibly change without the URL moving | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:2111` | "Visible panel must change without URL mutation." |
| Mobile tabs switch views, they do not change route | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:757` | "Legacy mobile tabs switch contents, lesson and outline views without changing route." |
| A block's parameter is not the page's content region | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:242` | "It changes one visualization parameter, not the page's content region." |
| A full-width line reads as region navigation, so a parameter may not take one | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:291` | "The former is secondary region navigation, not a local calendar parameter." |
| The overturned ruling, kept because it is why the criterion exists | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82` | "User: “nó phải là 1 line dài như shellnav”." |
| Navigating on select destroys the panel that exists to be read | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:467` | "Nếu điều hướng ngay thì người dùng không thể đọc detail panel." |
| `L4-2` live: a tab replaces a query param and writes no history | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:132` | — |
| `L4-1` live: a destination pushes a path, in the same file and the same router | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:137` | — |
| The current tab is read back from the query, not held in the navbar | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:123-127` | — |
| The page owner resolves the key and falls back to the resting panel | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\DashboardPage\index.tsx:30-31` | — |
| The swapped region is the main column and not a second column shape | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1070-1076` | — |
| `L4-3` live: a mobile tab sets view state and the URL never moves | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\index.tsx:192-195` | — |
| `L4-1` beside it: a spine row pushes, in the same handler block | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\index.tsx:187-191` | — |
| `L4-4` live: a parameter sits at the trailing edge of its own block | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1244-1251` | — |
| `L4-4` live: a scope switch takes the width of its two words | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1504-1510` | — |
| `L4-4` live: a view toggle stays at one end of the catalogue toolbar | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2092-2098` | — |
| `L4-5` live: a full-width strip whose handler scrolls | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\index.tsx:133-140` | — |
| The same strip declared as one navigation landmark over one document | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2226-2231` | — |
| `L4-6` live: preview and commit are two handlers on two controls | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\search\GlobalSearchOverlay\index.tsx:184-185` | — |
| Only the commit handler reaches the router | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\search\GlobalSearchOverlay\index.tsx:144-149` | — |

## Scope

This module decides what a pressable control changes and whether the URL moves with it. It does not
decide where the control sits, whether it joins the navbar as a second row, or what offset a sticky
layer subtracts — those are [`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md), and this
module reads its verdict rather than reopening it.

It does not decide whether a route has a page owner at all. A route that carries nothing and exists
only as a door is [`destination-column`](../../archetypes/destination-column/INDEX.md) `SPINE-6`, and the two
laws meet only when a control's destination turns out to be a door.

Its output feeds [`gate.schema.json`](../../gate.schema.json) through the `reason.why` of the region
that holds the control, plus `states` whenever `L4-2` introduces a panel key that has a resting
value.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding or removing an `L4-` code is a minor bump. Changing the Law sentence is a major bump for the
shelf, because `sticky-chrome-band` `CHROME-5` and the proofs scorecard both resolve into it. A
second live `L4-2` page joining the tree is a rule change on its own, because it tests whether the
navbar-owned key vocabulary is a defect or a second legitimate shape.
