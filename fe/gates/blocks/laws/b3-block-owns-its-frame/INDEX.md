---
id: fe-blocks-laws-b3-block-owns-its-frame-index
title: INDEX.md
slug: /gates/blocks/laws/b3-block-owns-its-frame
sidebar_label: b3-block-owns-its-frame
sidebar_position: 0
description: Binding rules for the line between what a block owns — inset, scroll, limits, presentation state — and what only the calling region may decide.
---

# INDEX.md

Version: `2.00` · Module: `b3-block-owns-its-frame` · Law: `B3` · Refusals: **7 across 4 records**

## Law

A block owns its **inset, its scroll, its measured limits and its own presentation state**. The
caller supplies **position and data, and nothing else**.

The line is not arbitrary. Anything the block can decide alone without knowing the page belongs to
the block; anything that requires knowing what sits beside it belongs to the region contract. A
block that places itself has assumed a page it cannot see.

## Situation Codes

| Code | Situation | Owner |
|---|---|---|
| `B3-1` | Content needs breathing room inside the surface | the block — ordinary content inset |
| `B3-2` | Content is taller than the space allowed | the block — a fixed frame with the content scrolling **inside** it |
| `B3-3` | A height, width or offset limit must be stated | the block, but only through a **named token**, never a literal value |
| `B3-4` | A choice that changes only what is displayed | the block's pure half — local state, not URL, not page |
| `B3-5` | Where the block sits, and how wide it is | the **region contract** — never the block, never the calling page |
| `B3-6` | Any paint at all | nobody at the block tier — the closed layout vocabulary owns it |

`B3-5` AND `B3-6` ARE SITUATIONS THE BLOCK ANSWERS BY EMITTING NOTHING. The measured evidence is
that the whole block tier contains zero `className` in any form and exactly one inline style — and
that one style is the single live violation.

## Inputs

| Input | Evidence required |
|---|---|
| `contentOverflow` | `never` · `sometimes` · `always` — does the content exceed its frame |
| `limit` | the named token that states it, or `none` |
| `localChoice` | what the choice changes: `display-only` · `route` · `server-state` |
| `regionContract` | the contract key that already declares this region's width and placement |

`localChoice` decides `B3-4`. Display-only lives in the block. The moment the choice changes routing
or a server request, it has left the block and belongs to the page or the URL.

## Invariants

- The block never writes `className`, in any form — not a literal, not a template string, not `cn()`.
- The block never writes an inline style, and never a `position`, `z-index`, `margin` or `top`.
- A scrolling block keeps a **solid frame** and moves only its content. A fade or shadow wrapper
  around the frame is refused.
- Every measured limit is a named token. An arbitrary value is not merely discouraged: the layout
  vocabulary is a closed union, so an arbitrary value is unrepresentable.
- A region's width lives in the region's own contract, not in the block and not in its sibling.
- A block that draws its own surface **and** sticks declares both its height limit and its scroll
  region in the same breath. Sticky without a limit means a tall card scrolls the page out from under
  its own bottom edge, and the reader never reaches the control at the end of it.
- Presentation-only state stays inside the pure half and never becomes a URL parameter.

## Exceptions

- **A block that legitimately needs a viewport.** One exists: the pricing rail. It declares a named
  scroll boundary rather than an overflow class, and it remains the only block in the tier with one.
- **Two blocks quoting the same number.** The mobile enrol bar borrows the rail's state so both say
  the same price. Borrowing **state** is allowed; borrowing **placement** is not.
- **A floating trigger.** Not an exception — a live violation. A block that pins itself to the
  viewport corner has decided its own place on every page it appears on.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Content inset belongs to the block | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:546` | "User: \"đỏ bị mất padding\"." |
| The card stays fixed and the content scrolls inside it | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:635` | "Card phải là khung cố định và nội dung cuộn bên trong." |
| A fade wrapper is refused; the card must stay solid | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:710` | "The card must remain solid while only its content moves." |
| A raw overflow class on a sticky child is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:209` | "Tránh native scrollbar và giữ vendor ownership đúng tier." |
| A measured limit uses a named token | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-pricing-rail-trial-phase-density-20260815-01.md:210` | "Tuân thủ spacing vocabulary và vẫn đúng 80% viewport." |
| Display-only choice stays local to the block | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-pricing-rail-density-r1.md:403` | "It is presentation state and does not change routing or commerce requests." |
| The same, stated as a rejection of page/URL ownership | neo TỪ CHỐI | `.workflows\designs\starci-academy\course-pricing-rail-density-r1.md:322` | "Intent chỉ đổi presentation panel, không phải navigation hoặc server state." |
| Region width lives in the region contract | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1048-1054` | — |
| The rail is declared bare by its own contract, not by its blocks | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1056-1061` | — |
| An arbitrary layout value is unrepresentable, not merely banned | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:20-25` | — |
| The one live violation: a block pinning itself to the viewport | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:35` | — |
| The one legitimate viewport, declared as a named boundary | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:194-195` | — |

## Scope

This module decides ownership, not values. Which inset, which gap, which radius is
[`gates/principles`](../../../principles/padding/INDEX.md); which region and which order is
[`layouts`](../../../layouts/gate.schema.json). Its output is the `ownsClassName: false` constant of
the gate plus the block's declared scroll and limit ownership.

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
