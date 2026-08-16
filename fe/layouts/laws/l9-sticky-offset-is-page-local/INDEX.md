---
id: fe-layouts-laws-l9-sticky-offset-is-page-local-index
title: INDEX.md
slug: /fe/layouts/laws/l9-sticky-offset-is-page-local
sidebar_label: l9-sticky-offset-is-page-local
sidebar_position: 0
description: Binding rules for where a pinned region comes to rest, which chrome it subtracts, and the height cap that must be decided in the same breath as the offset.
---

# INDEX.md

Version: `1.00` · Module: `l9-sticky-offset-is-page-local` · Law: `L9` · Refusals: **5 across 2 records**

## Law

A pinned region comes to rest below **the chrome of the page it is standing on**, measured from that
page's own frame, and it declares a **height cap in the same decision** as the offset.

An offset is not a spacing choice. It is a claim about how tall the chrome above this region is, and
the chrome above a region is a property of the page, never of the product. Course detail stacks two
sticky rows and the learn shell stacks one, so the same generic number cannot be right on both:

> Generic offset khiến rail chui lên dưới course navbar.

**This is binding, not advisory.** Every region that sets `position: sticky` falls under exactly one
code below, including the two that subtract nothing and the one that pins nothing at all. A region
that owns its own scroll and states a rest position without a cap has taken half a decision, and the
half it skipped is the half the reader notices last, when the end of a long rail has already run off
the bottom edge.

This module decides **rest position and its paired cap only**. Whether a row should be sticky at all
is L3, held by [`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) as `CHROME-2`. How wide the
pinned region is, and whether it is targeted by identity or by child position, is L10, held by
[`destination-column`](../../archetypes/destination-column/INDEX.md) as `SPINE-5`. How the scroll surface inside
it is drawn belongs to `fe/blocks` and `fe/principles`.

## Situation Codes

| Code | Situation | What the layout emits |
|---|---|---|
| `L9-1` | The route cluster's chrome band pins itself above the body | `sticky top-0` — nothing above it to subtract |
| `L9-2` | A second chrome row pins beneath the first row of the same band | `sticky top-16` plus `-mt-px`, the offset being the measured height of the row above |
| `L9-3` | A page region pins under a **one-row** chrome | `top-rail` paired with `max-h-rail` |
| `L9-4` | A page region pins under a **two-row** chrome | `top-course-rail` paired with the pricing cap |
| `L9-5` | The region does not pin at all | **no offset and no cap** — the frame says so and the schema records `khong-sticky` |
| `L9-6` | A region pins to the **bottom** edge below the rail's breakpoint | `sticky bottom-0` — the chrome is above, so nothing is subtracted |
| `L9-7` | The page's chrome height has never been measured into a token | **refuse** — escalate an owed token, do not write a number |

Codes `L9-1` and `L9-2` answer *where does chrome itself come to rest*. Codes `L9-3` to `L9-6` answer
*where does a region under that chrome come to rest*. `L9-7` is the exit when the first four cannot be
answered from a measurement.

`L9-5` IS A SITUATION, NOT AN OMISSION. Two of the four rail layouts in the live tree pin nothing:
`dashboard-rail-then-main` and `profile-rail-then-main`. Dashboard writes the refusal into its own
`why` — the rail stands beside the main column *"without becoming a card or a sticky viewport of its
own"* — so a plan that adds an offset there is not improving the page, it is contradicting a decision
that was already taken and written down.

`L9-7` IS ALSO A SITUATION. A layout that reaches for `top-20` or `max-h-[80vh]` because the named
token does not exist has not found a gap in the vocabulary; it has skipped the measurement that would
have earned a token. Both of those shapes have been refused by name.

There is no code for *a pinned region whose cap is left to the browser*. That absence is deliberate.
Every page region that pins in the live tree also owns its own scroll, so a missing cap is always a
missing half of `L9-3` or `L9-4`, never a fifth kind of region.

## Inputs

| Input | Evidence required |
|---|---|
| `pageChromeRows` | `mot-hang` · `hai-hang` · `khong-co-chrome` — how many sticky rows the page's own frame stacks above the body |
| `chromeHeight` | the height of each row read from the registry class that sets it, never estimated from a screenshot |
| `pinEdge` | `top` · `bottom` · `khong-pin` |
| `ownsScroll` | boolean — `true` makes a cap mandatory |
| `offsetToken` | `top-rail` · `top-course-rail` · `khong-sticky` |
| `capToken` | `max-h-rail` · `max-height-pricing-rail` · `khong-gioi-han` |
| `capOwner` | who applies the cap, **by name** — the frame contract, or a stylesheet rule keyed by a data attribute |

`pageChromeRows` is counted from the frame this plan owns plus every enclosing frame, not from what
the screen looks like. Profile stacks a tab strip above its body and that strip is **not** sticky, so
profile is `mot-hang` for this law even though a reader sees two bands at rest.

`capOwner` is an input because the pair is not held in one place today. `top-rail` and `max-h-rail`
are both written by the frame contract, so one reader sees both halves at once. The course-detail cap
is not: the frame writes the pin and a stylesheet rule keyed by `data-scroll-inside="pricing-rail"`
writes the cap. Naming the owner is what keeps the second half from being forgotten.

## Invariants

- The pin and the cap are **one decision**. A region with `ownsScroll: true` and no `capToken` is an
  incomplete plan, not a plan with a default.
- An offset is a named token defined once under `@theme`. A raw length, a viewport fraction and an
  arbitrary Tailwind bracket value are all refused at the call site.
- The offset subtracts **this page's** chrome. Reusing another page's token because the two look alike
  is the exact failure that put the pricing rail under the course navbar.
- A second chrome row's offset equals the measured height of the row above it, and the two rows keep
  one seam: `-mt-px` so the lower row's opaque surface covers the upper row's bottom stroke.
- A bottom-pinned bar subtracts nothing, because the chrome it coexists with is above it.
- A region that does not pin records `khong-sticky` explicitly rather than leaving the field out. The
  absence of an offset must be readable as a decision.
- The cap **formula** is a product ruling and is quoted, not derived. `max-h-rail` leaves the same
  breathing below as above; the pricing cap takes 80% of what the chrome leaves. Neither follows from
  the other.
- The scroll a cap implies is expressed by a vendor scroll surface inside the card, never by
  `overflow-y-auto` written straight onto the sticky layout child.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **Eighty percent rather than everything left.** `L9-4`. The pricing rail may use only
  `(100dvh - 6.1rem) * 0.8`, by ruling. The symmetric formula `L9-3` uses would be a different
  product decision, and nobody has taken it.
- **The cap applied by stylesheet rather than by frame.** `L9-4`, and the only place `capOwner` is not
  the frame contract. Admitted because the pricing rail's scroll lives inside a card the frame does
  not reach into, refused everywhere else.
- **A second chrome row that does not pin.** Profile stacks tabs above the body and lets them scroll
  away, so the region beneath is `L9-5` and the second row contributes nothing to any offset. Whether
  that strip *should* pin is L3's ruling, not this module's.
- **Two pinned siblings on one page.** `content-reader-frame` pins its first and last children to the
  same `top-rail` with the same `max-h-rail`. One page, one chrome, one offset — two regions sharing
  it is not a conflict.
- **A page in no cluster.** A frame that stacks no sticky chrome makes every region under it `L9-5`.
  There is no live example, so this exception stays open and a plan that hits it fills `owed`.
- **The chrome height was never measured.** Refuse and escalate. Writing the number inline is how a
  token stops being the single definition, and the refused `max-h-[80vh]` is precisely that shape.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A generic offset puts the rail under the page's own second chrome row | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:279` | "Generic offset khiến rail chui lên dưới course navbar." |
| The cap subtracts chrome first and takes 80% of the remainder | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:278` | "Rail sticky chỉ được dùng 80% vùng viewport còn lại." |
| An arbitrary viewport fraction is replaced by a named token | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:210` | "Tuân thủ spacing vocabulary và vẫn đúng 80% viewport." |
| The scroll a cap implies is not `overflow-y-auto` on the sticky child | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:209` | "Tránh native scrollbar và giữ vendor ownership đúng tier." |
| Chrome that must stay visible while scrolling is what creates the offset | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:857` | "Dashboard reference giữ toàn bộ tab chrome nhìn thấy khi cuộn." |
| The one-row pin and its cap are defined together, with the mechanism written beside them | neo CODE | `D:\Repositories\starci-academy-fe\src\app\globals.css:40-56` | — |
| The two-row pin and its cap are a second, separate pair | neo CODE | `D:\Repositories\starci-academy-fe\src\app\globals.css:58-64` | — |
| The pricing cap is applied by a stylesheet rule, not by the frame | neo CODE | `D:\Repositories\starci-academy-fe\src\app\globals.css:363-377` | — |
| A live `L9-1`: the chrome band pins at the document top | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1692` | — |
| The 4rem the offsets subtract is set by the primary row's own class | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1700` | — |
| A live `L9-2`: the second chrome row rests at the first row's height and keeps one seam | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2228` | — |
| A live `L9-3`: the learn spine pins and caps in one contract | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:337-343` | — |
| A live `L9-3` with two pinned siblings sharing one offset | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1952-1958` | — |
| A live `L9-4`: the only region using the two-row offset | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2235` | — |
| A live `L9-5`: the dashboard rail carries no sticky class at all | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1049` | — |
| The dashboard rail's refusal to pin is written into its own reason | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1054` | — |
| A second live `L9-5`: the profile rail under a non-sticky tab strip | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:804-811` | — |
| A live `L9-6`: the learn tab bar pins to the bottom edge | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:324` | — |
| A second live `L9-6`: the course action bar pins to the same edge | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2581` | — |

## Scope

This module decides where a pinned region rests and which cap travels with that rest position. It
does not decide whether the region should pin, which is `CHROME-1` and `CHROME-2` inside
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) and is stated as L3. It does not decide the
region's width or selector, which is `SPINE-5` inside
[`destination-column`](../../archetypes/destination-column/INDEX.md) and is stated as L10. It does not decide the
z-index order, the seam paint or the inset, which are `fe/principles` and are read after this module
has closed.

Its output feeds three fields of [`gate.schema.json`](../../gate.schema.json): `stickyOffsetToken`,
`maxHeightToken` and `ownsScroll`. Two of this module's codes cannot be expressed there yet, and the
gap is recorded in [`audit.md`](./audit.md) rather than smoothed over here.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump. Changing the Law sentence is a major bump for the shelf, because
`L3` and `L10` both resolve against the offset this law fixes.
