---
id: fe-blocks-archetypes-rail-quyet-dinh-mua-index
title: INDEX.md
slug: /fe/blocks/archetypes/rail-quyet-dinh-mua
sidebar_label: rail-quyet-dinh-mua
sidebar_position: 0
description: The anatomy of the purchase column and the mobile bar that quotes it — the only block that owns a scrolling viewport.
---

# INDEX.md

Version: `2.00` · Module: `rail-quyet-dinh-mua` · Archetype: `A7` · Live instances: **2 — the rail and its mobile twin**

## Law

**The decision rail carries one number and every way to act on it, and its narrow twin borrows the
rail's state so both quote the same number.**

Two surfaces showing one price is the risk this archetype exists to manage. They do not each compute
the price; the second reads the first's state.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A7-1` | The rail's state | one flat enum mixing business and mutation: `ready \| price-pending \| adding \| trialing \| checking-out` |
| `A7-2` | Content taller than the viewport | a named scroll boundary inside a solid card — the only one in the tier |
| `A7-3` | A narrow screen | a twin block whose state is a **subset** of the rail's, so the number cannot disagree |
| `A7-4` | Several ways to commit | primary enrol or continue, plus trial and add-to-cart; never one collapsed CTA |
| `A7-5` | Cart membership | read from shared truth, never from a local flag |

`A7-3` IS THE ARCHETYPE'S REASON TO EXIST AS A PAIR. The mobile bar declares its own state type as
`ready | price-pending` and documents why: it shows the rail's number, so it takes the rail's
situations.

## Inputs

| Input | Evidence required |
|---|---|
| `price` | The resolved payable figure and its producer |
| `commitPaths` | Every way to commit: enrol, continue, trial, add to cart |
| `pendingOwners` | One per commit path — never one shared flag |
| `scrollBoundary` | The named boundary the viewport uses |
| `sharedCartTruth` | The shared source the cart state is read from |

## Invariants

- One flat enum is legal here, and the plan says it is a flat enum —
  [`b10`](../../laws/b10-state-enumeration/INDEX.md).
- The card stays solid; only its content moves — [`b3`](../../laws/b3-block-owns-its-frame/INDEX.md).
- Each commit path owns its pending flag — [`b11`](../../laws/b11-pending-owner/INDEX.md).
- The twin never recomputes the price.
- Collapsing trial and cart into one CTA is refused.

## Exceptions

- **`'use client'` on the presentational half.** The rail's `component.tsx` is the only one in the
  tier that carries it, because of the viewport it owns.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The flat state enum mixing business and mutation | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:118-119` | — |
| The named scroll boundary in a solid card | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:194-195` | — |
| The twin taking the rail's situations, and saying why | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CourseMobileEnrollBar\component.tsx:50-51` | — |
| One CTA losing trial and cart is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:547` | "User: \"tính năng học thử và add to card đâu?\"." |
| Three pending owners, not one shared state | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1623` | "Spinner sai nút làm người dùng hiểu sai request đang chạy." |
| Shared cart truth instead of a local flag | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1469` | "The local flag cannot survive another cart surface and removes the legacy reversible action." |
| The card is a fixed frame and the content scrolls inside it | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:635` | "Card phải là khung cố định và nội dung cuộn bên trong." |

## Scope

This module decides the shape of the purchase rail. Where the rail sits and how wide it is belongs to
[`layouts`](../../../layouts/gate.schema.json); the rail is an `aside` that carries the purchase
decision and sits on the right **because legacy put it there and nobody has challenged it** — there
is no recorded UX reason in the decision store, and none is invented here.

## Version Rule

Increment all five records by `0.01` for an accepted change.
