---
id: fe-layouts-laws-l11-full-width-run-versus-compact-control-index
title: INDEX.md
slug: /fe/layouts/laws/l11-full-width-run-versus-compact-control
sidebar_label: l11-full-width-run-versus-compact-control
sidebar_position: 0
description: Binding rules for whether a control runs the full width inside a landmark of its own or stands compact beside the thing it changes, including the two opposite rulings the founder made about the same control.
---

# INDEX.md

Version: `1.00` · Module: `l11-full-width-run-versus-compact-control` · Law: `L11` · Refusals: **6 across 1 record** — four about the shape, two about the naming

## Law

This law returns a **classification**, never a width. The founder ruled on the same control twice, in
opposite directions, and both rulings stand. Picking one of them as the default would overrule half
of the evidence this module is built from:

> "User: “nó phải là 1 line dài như shellnav”."

> "It changes one visualization parameter, not the page's content region."

**Press the control and ask what is replaced.** Two questions, in this order, and the shape follows
from the answers.

**First: is what changes a value, or a face?** A value means the thing under the control stays and
answers differently — the same plot drawn for another year, the same board recomputed for another
scope, the same list shown in another arrangement. A face means the region is refilled with content
of a different kind. A value always produces a compact control, wherever it sits.

**Second, for a face only: whose region is being refilled?** When the control is a peer of the region
the page itself holds, and it stays standing while that region is replaced beneath it, the control is
a navigation layer. It runs the full width inside a landmark of its own, joined to the chrome
baseline above the body. When the region being refilled is one region inside the page — a reading
column, a rail, an overlay body — the control belongs to that interior and stays compact, because the
interior is already named by something else.

A full-width run carries three marks together: it takes the whole line, it uses the underline
mechanism, and it opens a landmark or sits in the frame's chrome. **The underline mechanism on its
own is not a run.** One live control is painted with the underline while holding an intrinsic width,
deliberately, so that it reads as subordinate to the segmented control beside it. Reading the paint
as the classification is the second half of `L11-5`.

**This is binding, not advisory.** Every pressable choice control in the live tree falls under exactly
one code below, including the one that emits nothing. Fourteen call sites are measured: four use the
run mechanism and ten hold an intrinsic width. Three of the four answer both questions the way
`L11-1` requires; the fourth answers the second question the other way and runs anyway, which is the
single live breach and it is proved in [`audit.md`](./audit.md) rather than blessed here.

Two consequences travel with the law. A parameter control stretched across the measure stops reading
as something the reader can press and starts reading as a band the page is divided by, which is a
break rather than emphasis. And the vendor's variant token proves nothing about the classification:
HeroUI paints the underline layer `secondary` while the product calls that same layer its primary
navigation, so the placement and the mechanism are the evidence and the token is only the result.

This module decides **the shape the control takes**. What pressing it does to the URL is
[`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md), and whether a full-width run joins the
navbar as its second row is [`l3`](../l3-section-tabs-are-navbar-second-row/INDEX.md).

## Situation Codes

| Code | Situation | What the layout emits |
|---|---|---|
| `L11-1` | Pressing it refills the region the page itself holds, with content of a different kind, while the control stays standing above it | a full-width run: `w-full`, the underline mechanism, and one landmark or chrome baseline of its own |
| `L11-2` | Pressing it leaves the thing in place and makes it answer differently | a compact segmented control at an edge of that thing's own row, as wide as the words it offers |
| `L11-3` | Two controls of different kinds share one row | a full-width **row** holding intrinsic controls; each control is classified on its own and the row's width is never theirs |
| `L11-4` | The face being chosen belongs to a region inside the page rather than to the page | compact, inside that interior's own row; the interior's boundary already names the context |
| `L11-5` | The vendor's variant token and the placement describe different products | classify from placement and mechanism, then rename so the token and the render agree |
| `L11-6` | Both readings hold for the same control | **no value** — the law returns the question and the plan carries the founder's ruling verbatim |

Codes `L11-1`, `L11-2` and `L11-4` are the three outcomes of the two questions. `L11-3` and `L11-5`
are the two ways the answer is misread once it exists. `L11-6` is the exit when the questions cannot
be answered from evidence.

`L11-2 IS THE ONE THE MEASUREMENT SETTLES, AND IT SETTLES IT AGAINST THE FIRST RULING.` The year
selector was measured at `189.625px` beginning at x `978.775px` while the ShellNav run was measured at
`1216.8px` beginning at x `24px`. Round one made the first number look like the second. Round two put
it back, and the reason given was not that the earlier number looked wrong but that the year is a
parameter of one plot.

`L11-4 IS NOT A SOFTER L11-1.` The learn reader's three content faces refill a body with unlike
content and still stay compact, because the body they refill is `main`, one of three columns of
`content-reader-frame`, rather than the page's own region. Reading `L11-1` without the second question
would put a full-width underline run inside a reading column that already sits between a contents
panel and an outline rail. The coding problem page holds the same shape and answers it the other way,
and that pair is the sharpest test this criterion has; both halves of it are carried in
[`audit.md`](./audit.md).

`L11-6 RETURNS NOTHING ON PURPOSE`, the same way
[`l5`](../l5-every-route-has-a-real-owner/INDEX.md) `L5-5` does. A control whose two readings are both
defensible is a product question, and answering it from the nearest precedent is the exact failure
that produced the flip this module is written from.

There is no code for a control that is full width **and** compact at different breakpoints. No live
control does it, no ruling covers it, and a plan that wants one stops at `L11-6`.

## Inputs

| Input | Evidence required |
|---|---|
| `changeKind` | `value-of-one-thing` · `face-of-a-region` · `unknown` — read from what the reader sees replaced, never from how the control is drawn |
| `subject` | the named thing that stays and answers differently, required whenever `changeKind` is `value-of-one-thing` |
| `refilledRegion` | the contract key of the region being refilled, **by name**, required whenever `changeKind` is `face-of-a-region` |
| `regionParent` | the contract key that holds both the control and the refilled region — the input that separates `L11-1` from `L11-4` |
| `landmark` | `own-nav-host` · `frame-chrome-region` · `none` — a claim of `L11-1` with `none` has not been proved |
| `rowShares` | every other control standing in the same row, named, so `L11-3` keeps the row's width off the control |
| `variantToken` | the value that will be written on the leaf, plus the sentence making the token and the render describe the same product |
| `founderRuling` | the verbatim line, required whenever `L11-6` opens |

`changeKind` is the whole criterion and it is answered by naming what survives the press. Ask:
**after the press, is the thing under the control still the same thing?** A named subject that stays
means `value-of-one-thing`. A region that now holds a different kind of content means
`face-of-a-region`.

`regionParent` is an input rather than a derivation because the live tree proves that being a peer of
a body is not enough. `scope-switch-row` is a peer of the league board at the page's own top level and
is still compact, because the board does not change kind. The parent matters only after `changeKind`
has already said `face-of-a-region`.

`landmark` exists because the three correct full-width runs each carry one and all ten compact
controls carry none. The fourth run carries none either, which is how the single live breach shows
itself. A run that claims to be region navigation while opening no landmark is claiming a role that
nothing in the document confirms.

## Invariants

- One control, one classification. A control that would need two is two controls.
- A value control keeps the width of its own words, at every breakpoint. Stretching it across the
  measure turns one thing's setting into a band the page is divided by.
- A full-width run stands above the region it refills and outlives it. A run that is replaced along
  with the content beneath it was never a navigation layer.
- A row may be `w-full` while every control inside it is intrinsic. The row's width belongs to the
  row, and reading it as the control's width is how `L11-3` gets skipped.
- The vendor token is written last, after the classification, and it is written so the name and the
  render describe the same product.
- `ChoiceTabs` resolves an absent `variant` to `"secondary"`, which draws the underline layer. A
  compact control that omits the value has taken the navigation shape without deciding to, and that
  is an unjudged choice rather than a safe one.
- The paint is not the classification. The underline mechanism belongs to a full-width run and may
  also mark one control as subordinate to another inside the same row; what makes a run is the paint
  together with the whole line and a landmark. A plan that names only the paint has named nothing.
- A control whose token says one product while its drawing says the other is refused outright. That
  exact adapter — a `primary` name forcing the vendor's underline — is what round two removed.
- Every code holds across pending, empty and failed. A skeleton that collapses a compact control into
  a full-width bar changes the classification at the moment the reader can least check it.
- A control the founder has ruled on carries the ruling with it into the plan. Precedent from a
  neighbouring screen is not a ruling.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A full-width run whose handler only scrolls.** `L11-1`. Course detail's four section controls
  refill nothing at all, they move the viewport inside one document. They still take the full-width
  run because the four sections are the page's own regions and the strip opens a `nav` host at the
  navbar seam. The classification comes from the regions, not from the handler, and the handler is
  [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) `L4-5`.
- **A face control that stays compact.** `L11-4`. The learn reader's faces and the pricing rail's
  purchase-or-trial switch both refill a body with unlike content and both keep an intrinsic measure,
  because the body belongs to a column and to a rail rather than to the page.
- **A compact control inside an overlay.** `L11-4` again, and it is closed by
  [`l6`](../l6-overlay-is-already-a-surface/INDEX.md): the overlay is already the bounded surface, so
  nothing inside it may take the interior's measure as a band. How wide the overlay itself opens is a
  separate decision and it is not made here.
- **The underline paint on a control that is not a run.** `L11-5`. The learn reader's language axis
  keeps the underline while holding an intrinsic width, because the language qualifies the examples
  inside the chosen face rather than choosing a face, and it must not compete with the segmented
  control at the other end of the same row. The exception is the paint, never the width.
- **A default taken by omission on a full-width run.** Course detail passes no `variant` and receives
  the underline, and that is correct there because the run is `L11-1`. The same omission on a compact
  control is a defect rather than a shortcut, and the two are told apart by the classification, not by
  the diff.
- **Both readings defensible.** `L11-6`. State both, quote the ruling if one exists, and stop. Do not
  reach for the last similar control.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Round one: the year control was ruled to be a full-width run | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82` | "User: “nó phải là 1 line dài như shellnav”." |
| Round one, restated at the next phase | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:173` | "User requires “1 line dài như shellnav”." |
| Round two: a parameter is not the page's content region | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:242` | "It changes one visualization parameter, not the page's content region." |
| Round two, closing the shape: the full-width underline reads as region navigation | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:291` | "The former is secondary region navigation, not a local calendar parameter." |
| `L11-5`: the vendor's word is not the product's hierarchy | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:172` | "User classifies this selector as primary even though the underline implementation comes from the vendor's secondary skin." |
| `L11-5`: the name and the drawing must be the same product | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:241` | "Name and render must describe the same product." |
| The flip is named by the record itself, and this row is a classification line rather than a refusal | không phải neo từ chối | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:207` | "Feedback classification: correction-of-prior-interpretation" |
| The record keeps round one as history rather than deleting it; this is a `WARNINGS` row | không phải neo từ chối | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:235` | "This feedback supersedes that interpretation; old evidence remains as rejection history." |
| The settled criterion in the founder's own accepted output | không phải neo từ chối | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:213-215` | "Primary tabs \| Compact segmented/pill choice inside one bounded context." |
| The two measures round one tried to make equal | không phải neo từ chối | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:50-51` | "Width `189.625px`, x `978.775px`; intrinsic trailing control." |
| The criterion already written into the leaf, in round two's words | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\ChoiceTabs\index.tsx:26-31` | — |
| The segmented mechanism paints selection on the tab | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\ChoiceTabs\index.tsx:55` | — |
| The underline mechanism keeps the vendor's own indicator | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\ChoiceTabs\index.tsx:58,88` | — |
| An absent `variant` resolves to the navigation shape | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\ChoiceTabs\index.tsx:62` | — |
| `L11-1` mechanism: the run takes the whole line inside its own leaf | neo CODE | `D:\Repositories\starci-academy-fe\src\components\leaves\ExtendedTabs\index.tsx:37` | — |
| `L11-1` mechanism: the contract that carries the run declares `w-full` and nothing else | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1739-1744` | — |
| `L11-1` live: the run is the navbar's second row, a peer of the bar above it | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1691-1698` | — |
| The call site that fills that run | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\component.tsx:113-123` | — |
| `L11-1` live: profile route chrome is a peer of the profile body | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:781-788` | — |
| The block and the layout that mount it | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\ProfileTabs\component.tsx:20-24`; `…\layouts\PublicProfileLayout\component.tsx:103` | — |
| `L11-1` live: the page's own navigation region, a peer of the whole body | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2217-2224` | — |
| The landmark that proves it, at the navbar seam | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2226-2231` | — |
| The call site takes the underline by leaving `variant` unwritten, correctly | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\component.tsx:459-471` | — |
| `L11-2` live: round two frozen into a contract, in its `why` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1243-1250` | — |
| The call site that declares the compact variant | neo CODE | `D:\Repositories\starci-academy-fe\src\components\composites\ContributionCalendar\index.tsx:46-56` | — |
| `L11-2` live: the row exists so the switch keeps the width of its two words | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1504-1511` | — |
| The failure mode written down at the decision itself | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1505-1508` | — |
| A peer of the page's body that is still compact, because the board does not change kind | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1492-1502` | — |
| The two call sites of that row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\LeaguePage\component.tsx:121-132`; `…\pages\CourseLeaderboardPage\component.tsx:105-116` | — |
| `L11-3` live: a full row holding two intrinsic controls, one at each end | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1323-1329` | — |
| `L11-3` live: the same shape carrying a label and a control | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1243-1244` | — |
| `L11-4` live: three unlike faces of one lesson, compact | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\learn\ContentTabRow\component.tsx:26,85-93` | — |
| The region those faces refill is `main`, one of three columns | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnContentPage\component.tsx:495-522,534-542` | — |
| `L11-5` live beside it: the language axis keeps the underline, with the reason written down | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\learn\ContentTabRow\component.tsx:108-110` | — |
| `L11-4` live: the purchase decision switches inside a rail | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:206-217` | — |
| `L11-4` live: the payment plan switches inside an overlay body | neo CODE | `D:\Repositories\starci-academy-fe\src\components\overlays\commerce\CheckoutOverlay\component.tsx:127-132` | — |
| `L11-3` live again: two value axes over one feed, both intrinsic in one row | neo CODE | `D:\Repositories\starci-academy-fe\src\components\composites\DualTabsToolbar\index.tsx:21-30`; `…\blocks\dashboard\FeedExplorer\component.tsx:35-40` | — |
| A correct render whose written reason contradicts the criterion | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CoursesCatalogPage\component.tsx:216-226` | — |
| The one live breach: a run inside a column, with the peer relation stated in its own `why` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2633-2643` | — |
| The column is one of two, and the page is the pair | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2625-2631` | — |
| The call site that fills that run | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\coding\ProblemReadingColumn\component.tsx:88-103` | — |
| The gate has fields for a region's width and none for a control's shape | neo CODE | `D:\Repositories\starci-academy-backend\.claude\fe\layouts\gate.schema.json:290,295,326-359` | — |

## Scope

This module decides the shape a choice control takes and nothing about where the reader ends up. What
the press changes and whether the URL moves is
[`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md), whose `L4-4` reads this module for the
consequence rather than deciding it. Whether a full-width run joins the primary navbar as one sticky
landmark is [`l3`](../l3-section-tabs-are-navbar-second-row/INDEX.md). A region's own width, and which
contract writes it, is [`l10`](../l10-region-width-belongs-to-its-owner/INDEX.md), which currently
sends this criterion to `l4` and should send it here; that mismatch is recorded in
[`audit.md`](./audit.md) rather than repaired from this file. How wide an overlay opens is
[`l7`](../l7-overlay-width-is-a-product-decision/INDEX.md). What the control's row then holds is
[`blocks`](../../../blocks/INDEX.md).

Its output has **no field in** [`gate.schema.json`](../../gate.schema.json). `Region.widthOwner` and
`Region.widthClass` belong to `L10` and speak about regions, and `Section` carries `renderForm` for a
block archetype and nothing for a control. Until a field exists, an `L11` code is asserted in prose
inside `reason.why` and cannot be machine-compared with this module. That debt is the first entry of
[`audit.md`](./audit.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md). A new situation code is a minor bump. Changing either of the two
questions in the Law is a major bump for the shelf, because
[`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) `L4-4` and
[`l10`](../l10-region-width-belongs-to-its-owner/INDEX.md) both resolve their control-shape sentence
into this module. Adding a control field to `gate.schema.json` is a GATE change and is made in the
schema first. A third founder ruling on the same control is a rule change on its own, because it tests
whether the criterion or one of its two answers is what moved.
