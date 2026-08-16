---
id: fe-blocks-laws-b1-one-surface-owner-index
title: INDEX.md
slug: /gates/blocks/laws/b1-one-surface-owner
sidebar_label: b1-one-surface-owner
sidebar_position: 0
description: Binding rules for how many boundaries one block may draw, and the exact conditions under which a second boundary may sit inside the first.
---

# INDEX.md

Version: `2.00` · Module: `b1-one-surface-owner` · Law: `B1` · Refusals: **9 across 5 records**

## Law

A block draws **at most one** surface that claims page ground. A boundary inside that surface is
legal only when the inner set is a **separate, nameable membership**, and only when it declares
itself nested: one border, no shadow, and a named outer owner.

A boundary is a claim of ownership over a group. Two boundaries over one group are two claims about
one fact, and one of them is false. That is why the refusal is not about taste:

> A border still asserts grouping and cannot be decorative.

**This is binding, not advisory.** Every block that renders falls under exactly one code below —
including the two that emit no boundary at all. There is no block too small to be exempt: a
four-line streak row is `B1-3` for the same reason a leaderboard is `B1-2`. "It is only a wrapper"
is the most common place this law gets skipped, and it is exactly how a page ends up with three
edges saying the same thing.

This module decides **boundary ownership only**. Padding, gap, radius scale and elevation tokens
belong to [`gates/principles`](../../../principles/surface-in-surface/INDEX.md) and never appear in this module's output.

## Situation Codes

| Code | Situation | What the block emits |
|---|---|---|
| `B1-1` | One independent object standing under one name | exactly one `SurfaceCard` |
| `B1-2` | One joined set of comparable rows under one name | exactly one `SurfaceListCard` |
| `B1-3` | The host region contract already declares a bare surface-less strip | **no surface at all** |
| `B1-4` | A distinct, nameable joined set living inside the block's own card | inner `SurfaceListCard` with literal `isNested: true` and a named outer owner |
| `B1-5` | Two surfaces in one file on **mutually exclusive** branches | one surface per branch — this is not nesting |
| `B1-6` | A second boundary over the membership the host already claims | **nothing** — flatten one |
| `B1-7` | The block is mounted inside an overlay | **no card** — the overlay is already the bounded surface |

Codes `B1-1` to `B1-3` answer *what does this block own*. Codes `B1-4` to `B1-7` answer *what may
appear once something already owns a boundary around you*.

`B1-3` IS A SITUATION, NOT AN OMISSION. Four identity rows on the dashboard rail draw no surface,
and that is written into the region contract rather than left to each block. Emitting nothing is the
proof the block was classified and found to own no boundary — it is not a block someone forgot to
wrap.

`B1-6` IS ALSO A SITUATION. A flat container that then carries a border has not followed `B1-6`; it
has silently switched to `B1-4` without proving the membership `B1-4` requires.

There is no code for *a nested group of unlike parts*. That absence is deliberate: the only nested
membership this vocabulary admits is a joined set of comparable members. Two intents inside one
pricing card are two **named semantic groups**, not two cards.

## Inputs

| Input | Evidence required |
|---|---|
| `host` | `page-region` · `own-card` · `overlay` · `bare-rail` — what already owns a boundary around this block |
| `innerShape` | `joined-rows` · `unlike-parts` · `single-control` · `ordinary-content` |
| `innerMembership` | `same-as-host` · `distinct-and-nameable` · `unknown` |
| `familyMember` | `SurfaceCard` · `SurfaceListCard` · `SurfaceFormCard` — which member would carry the nested claim |
| `outerSurfaceOwner` | the block or branch drawing the outer boundary, **by name**, required whenever `isNested` is true |

A membership is **nameable** when you can state its name, its members, its own state and its own
outcome. DOM nesting is not evidence of membership: a `div` that exists to hold a flex direction has
no members and no outcome.

`familyMember` is an input because the family is not uniform today. Only `SurfaceListCard`
implements `isNested`; `SurfaceCard` and `SurfaceFormCard` do not. A `B1-4` claim on a non-list
member therefore **cannot be expressed** and must be escalated as owed API rather than painted by
hand at the call site.

## Invariants

- One block, one branch, at most one surface claiming page ground.
- Elevation and nested outline are mutually exclusive: an elevated card carries no border, a nested
  outline carries no shadow.
- A nested member emits `data-surface-context="nested"`; a page member emits `"page"`. The paint
  follows the marker in one stylesheet rule, never at the call site.
- The block authors no `className` at all — not for the boundary, not for anything.
- The empty branch **replaces** the surface with `empty-notice-card`; it never adds a second one.
- A single control is never wrapped in a surface. A control is not a group.
- A nested claim names its outer owner in the plan; the gate refuses `isNested: true` without
  `outerSurfaceOwner`.
- Hiding the inner label is a **separate** claim and is decided by
  [`b9-list-label-owner`](../b9-list-label-owner/INDEX.md), never implied by nesting.
- Pending, empty, failed and ready branches preserve boundary ownership. A skeleton that flattens a
  card, or a failure that promotes a flat block into one, is lying about ownership at the moment the
  reader can least check it.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **Inside an overlay.** `B1-7`, always. The modal is already the bounded surface, so its regions are
  flat `Tree` regions.
- **A genuine inner object inside an overlay.** The one admitted departure from `B1-7`: the middle
  results list of Global Search is a real joined set, so it keeps a `SurfaceListCard` at
  `isNested: true`. Literal nested mode is the **necessary** condition, never the sufficient one.
- **Two intents in one card.** `B1-6`. Separation comes from hierarchy and two named semantic groups,
  not from two inner cards.
- **Many signals on one detail page.** `B1-1` with the card divided into cells, not one card per
  signal.
- **Many reviews.** `B1-2` — one joined list with divider rows, not one card per review.
- **One item, two reading modes.** A catalogue item shown as a grid card and as a list row is **one**
  component with a layout discriminant, not two. In grid mode it is `B1-1`; in row mode the list owns
  the ground, so the item is `B1-3` and draws no surface of its own. The mode does not change the
  owner — it changes which code the owner is in.
- **A non-list family member needs nesting.** Refuse and escalate. The API does not exist yet, and a
  hand-written border at the call site is precisely the decorative border the law forbids.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A second boundary is a grouping claim, not decoration | neo TỪ CHỐI | `.workflows\upgrade\starci-academy\surface-in-surface-is-nested.md:245` | "A border still asserts grouping and cannot be decorative." |
| Literal nested mode is necessary, not sufficient | neo TỪ CHỐI | `.workflows\upgrade\starci-academy\surface-in-surface-is-nested.md:115` | "Border vẫn là grouping claim, không phải decoration." |
| Nested keeps the boundary with a border and drops the shadow | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:290` | "User chỉ rõ nested surface là trường hợp border và yêu cầu family-wide `isNested`." |
| No card inside an overlay | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:926` | "The modal is already the bounded surface" |
| An overlay is a bounded surface, so a nested card creates two owners | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-search-modal-20260815.md:738` | "Overlay là bounded surface, nested card tạo hai surface owners" |
| Two intents are two named groups in one card | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-pricing-rail-rebrainstorm.md:386` | "Group card/radius owner đã bị feedback trước bác; intent separation đến từ hierarchy, không từ card lồng card." |
| Many signals become one divided card | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:545` | "User: \"xanh render kiểu ribbon… 1 card và chia làm 6\"." |
| Many reviews become one joined list | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-review-identity-cards.md:453` | "Latest visual feedback superseded separate cards." |
| A duplicate outer edge reads as a heavier boundary | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-content-typography.md:206` | "The duplicate edge made the lower shadow appear heavier/brown." |
| One surface owner, and re-adding outer paint is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-content-typography.md:251` | "Regression test now blocks it." |
| Nested paint is a border with no shadow, in one stylesheet rule | neo CODE | `D:\Repositories\starci-academy-fe\src\app\globals.css:401-405` | — |
| A live `B1-4`: inner list nested inside the block's own card | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:93-108` | — |
| A live `B1-5`: empty and failed replace the surface rather than nest inside it | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\TopLearners\component.tsx:62-66` | — |
| Only `SurfaceListCard` implements `isNested` today | neo CODE | `D:\Repositories\starci-academy-fe\src\components\branches\SurfaceListCard\index.tsx:23` | — |
| The family-wide obligation the tree still owes | neo CODE | `D:\Repositories\starci-academy-backend\.workflows\upgrade\starci-academy\surface-in-surface-is-nested.md:65-69` | — |

## Scope

This module decides how many boundaries a block draws and which member carries them. It does not
decide the radius scale, the elevation token, the inset or the gap — those are
[`gates/principles`](../../../principles/surface-in-surface/INDEX.md) and are read after this module has closed.

Its output feeds two fields of [`gate.schema.json`](../../gate.schema.json): `surface` and
`isNested`, plus `outerSurfaceOwner` whenever the second is true.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump; changing the Law sentence is a major bump for the shelf,
because `b8` and `b9` both resolve into it.
