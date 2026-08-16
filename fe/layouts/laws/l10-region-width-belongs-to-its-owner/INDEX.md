---
id: fe-layouts-laws-l10-region-width-belongs-to-its-owner-index
title: INDEX.md
slug: /fe/layouts/laws/l10-region-width-belongs-to-its-owner
sidebar_label: l10-region-width-belongs-to-its-owner
sidebar_position: 0
description: Binding rules for which contract carries a region's width, what that width must aim at, and why a sibling owner of the same shape may never absorb the change.
---

# INDEX.md

Version: `1.00` · Module: `l10-region-width-belongs-to-its-owner` · Law: `L10` · Refusals: **6 across 4 records**

## Law

A region's width is written by **the contract that composes the row that region sits in**. That
contract aims the width at the child's **identity** rather than its position among siblings, takes
the value from the closed class union, and pairs every fixed measure with `shrink-0`. The region
receives the width; it declares that it fills the axis it was handed and nothing narrower.

Two owners can hold the same two-column shape and still be two owners. Widening the wrong one
produces a correct-looking diff on a page nobody asked about:

> Live proof phát hiện wrong owner; không để correction lan sang trang học.

**This is binding, not advisory.** Every region that ends up beside another region falls under
exactly one code below, including the two that emit nothing. "It is the same layout" is where this
law gets skipped, and the live tree already carries one selector that hits the reading column
whenever an optional rail is absent.

This module decides **who writes the width and what it aims at**. It does not decide the gap between
the two columns, the seam that runs between them, or where either of them comes to rest when pinned;
that last one is [`l9-sticky-offset-is-page-local`](../l9-sticky-offset-is-page-local/INDEX.md).

## Situation Codes

| Code | Situation | What the layout owner emits |
|---|---|---|
| `L10-1` | A row of sibling regions in which one is a fixed rail and one is the flexible surface | fixed measure plus `shrink-0` on the rail, `min-w-0` plus `grow` on the surface, both in the owner's own `classes` |
| `L10-2` | Any child of that row is optional, repeated, or a leaf a vendor may wrap | the same widths aimed at `[data-node=<contract key>]`, or `[data-component=…][data-variant=…]` for a leaf — never `*:first-child` or `*:last-child` |
| `L10-3` | The page's outer measure and centring | `mx-auto` plus exactly one `max-w-*` on the page contract; the frame above it emits none |
| `L10-4` | A width correction while a second owner carries the same two-column shape | the change lands on the named owner only, and every same-shape sibling is listed and proved unchanged |
| `L10-5` | The composing owner emits no child width at all | **nothing from the owner** — the region declares its own measure, becomes the owner of it, and names its threshold unit |
| `L10-6` | The measure belongs to a row inside a block rather than to a page region | **nothing** — L10 does not decide it |

Codes `L10-1` to `L10-3` answer *who writes this width*. Codes `L10-4` to `L10-6` answer *what may
happen to a width that someone already wrote*.

`L10-5` IS A SITUATION, NOT A LOOPHOLE. Exactly one region in the live tree sets its own measure, and
it does so because its composing owner sets none. That makes the region the owner, with everything
this law demands of an owner, including the rule that no second place may set it.

`L10-6` IS ALSO A SITUATION. A catalogue row fixing its thumbnail at `w-36` is a real width decision,
correctly made, and correctly outside this shelf. Answering it here would put a page-layout rule on a
list row.

## Inputs

| Input | Evidence required |
|---|---|
| `rowOwner` | the contract key composing the row, **by name** — the one whose `classes` array will carry the width |
| `childKind` | `contract-region` · `leaf` · `repeats` — decides whether identity is `data-node`, `data-component` plus `data-variant`, or unavailable |
| `optionality` | `all-required` · `some-optional` · `repeats` — anything other than `all-required` forbids positional selectors |
| `widthKind` | `fixed-rail` · `flexible` · `proportional` · `page-measure` |
| `threshold` | `md` (viewport) · `@app-md` (container) — named, never assumed from the neighbouring page |
| `siblingOwners` | every other contract key holding the same shape, listed so a correction cannot leak into one of them |

`optionality` is an input because the live tree already proves position is not identity. A row whose
trailing child is optional has two different last children depending on the data, and a selector
written against the shape that happened to be on screen will find the other one.

`threshold` is an input because two units are in use and they measure different things. `md:` asks
the viewport; `@app-md` asks the region, and the profile shelf deliberately chose the second so the
rail switch observes the profile area rather than the window.

## Invariants

- One width, one `classes` array. A region never receives a measure from two owners.
- A fixed rail measure always travels with `shrink-0`. Without it the number is a request that the
  flex algorithm may decline, which is how a 288px rail was measured at 273px.
- A region declares `w-full` for the stacked axis and stops there. `min-w-0` and `grow` come from the
  owner, not from the region asking to be big.
- Positional selectors are legal only when every child in the row is required and non-repeating. One
  optional child, one `repeats: true`, or one vendor wrapper, and the selector must switch to identity.
- Identity is checkable, not conventional: a branch node carries `data-node` set to its contract key,
  so a selector can be compared with the registry rather than with a screenshot.
- The page contract holds `max-w-*`; the frame holds height and direction. A frame that names a
  measure in prose but writes none has a stale `why`, not a hidden rule.
- When the row stacks on a narrow screen, no fixed measure survives. Every region is full width and
  the owner's width classes are all breakpoint-prefixed.
- A width correction names the sibling owners it did **not** change, and the proof covers them too.
- Widths come from the closed class union. A value outside it is a vocabulary change reviewed on its
  own, not a class typed at a call site.

## Exceptions

Exceptions are part of the law. Each is closed and names the code it modifies.

- **The owner writes nothing and the region writes its own.** `L10-5`. `profile-identity-rail` sets
  `@app-md:w-72` and `shrink-0` on itself because `profile-rail-then-main` sets neither. Legal, and it
  transfers ownership rather than sharing it: the composing owner may not then add a width of its own.
- **A leaf child cannot carry `data-node`.** Two admitted forms. Target the vendor identity plus its
  variant, as Global Search does for the scope list; or set the default for all children and override
  the one region by identity, as the learn shell does with `[&>*]:grow` followed by `grow-0` on the
  spine.
- **A proportional split.** `md:w-2/5` is in the union and carries `md:shrink-0` beside it. It exists
  because every other two-column token is a fixed 288px rail, and a problem statement read at 288px
  wraps every second word.
- **A row inside a block.** `L10-6`. A thumbnail column, a rank column, an action stack inside a
  pricing panel: real width decisions, decided by [`blocks`](../../../blocks/laws/b1-one-surface-owner/INDEX.md)
  and the size principles, not here.
- **A control's own width.** Whether a segmented control runs the full line or holds an intrinsic
  measure at the edge of a heading row is a hierarchy decision, and the founder ruled it both ways.
  That criterion lives in
  [`l11`](../l11-full-width-run-versus-compact-control/INDEX.md), and L10 must not answer it by
  analogy to a rail.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A same-shape sibling owner is not the owner, and a correction may not spread into it | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:445` | "Live proof phát hiện wrong owner; không để correction lan sang trang học." |
| A rail measure changes because the content at that measure fails, not because the number looks tidy | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:444` | "Buy-vs-try copy và disclosure bị dồn ở zoom 150%." |
| Child position is not region identity | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:143` | "Live DOM shows React Aria inserts hidden FocusScope siblings around ListBox, so child position is not component identity." |
| A nested row whose only job is sizing is dissolved into one owner's full-width stack | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1468` | "Legacy explicitly owns this conversion order and the user asked to preserve all three flows." |
| A control that runs the full line is a hierarchy ruling, and it was made | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82` | "User: \"nó phải là 1 line dài như shellnav\"." |
| The same control was then ruled back to an intrinsic measure | neo TỪ CHỐI | `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:291` | "The former is secondary region navigation, not a local calendar parameter." |
| A live `L10-1`: the owner writes both children's widths | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1049` | — |
| The region that receives it declares `w-full` and no measure | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1057` | — |
| The same shape at a different measure, on a different owner | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2234` | — |
| The sibling owner that was widened by mistake and reverted to `w-72` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1951` | — |
| A positional selector on a row whose trailing child is optional | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1956` | — |
| The route that omits that trailing child | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnContentPage\component.tsx:540` | — |
| A live `L10-2`: widths aimed at region and vendor identity | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2858` | — |
| A default for every child, then one identity override | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:333` | — |
| The identity that override aims at | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:335` | — |
| `data-node` is the contract key, so a selector is checkable against the registry | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2930` | — |
| A live `L10-5`: the region declares its own measure and its own threshold unit | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:813` | — |
| A fixed measure is a request until shrinking is refused, measured at 273px in a 934px viewport | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:36-42` | — |
| A frame whose `why` claims the measure while its classes carry none | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:739` | — |
| The neighbouring `why` that states the rule correctly | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:749` | — |
| A positional selector aimed at a repeated child, so one link takes the column | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:388` | — |
| The smallest legal form: the owner makes every child full width | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2416` | — |

## Scope

This module decides which contract carries a region's width and what that width aims at. It does not
decide the gap or the seam between the columns, which belong to `fe/principles`; it does not decide
where a pinned region rests, which is
[`l9`](../l9-sticky-offset-is-page-local/INDEX.md); and it does not decide what any of those regions
hold, which is `blocks`.

Its output feeds `LayoutPlan.regions[].reason` in [`gate.schema.json`](../../gate.schema.json). The
schema has no `code` field on `Region` today, so the code is asserted in prose and cannot be
machine-compared with this module. That gap is recorded in [`audit.md`](./audit.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding a situation code is a minor bump. Changing the Law sentence is a major bump for the shelf,
because `l9` resolves the pinned form of the same region and reads this module for its width.
