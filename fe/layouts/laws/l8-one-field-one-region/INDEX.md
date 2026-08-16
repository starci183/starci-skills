---
id: fe-layouts-laws-l8-one-field-one-region-index
title: INDEX.md
slug: /fe/layouts/laws/l8-one-field-one-region
sidebar_label: l8-one-field-one-region
sidebar_position: 0
description: Binding rules for which region declares a field, the two closed conditions under which a second region may declare the same one, and how to tell one field from two.
---

# INDEX.md

Version: `1.00` · Module: `l8-one-field-one-region` · Law: `L8` · Refusals: **4 across 3 records**

## Law

A field is declared by **exactly one** region. The owning region is the one whose question the field
answers, and that question is not a matter of taste: it is written in the region's own `why`. A
second region may declare the same field only under two closed conditions, both stated below.

Before a field can be placed it has to be counted, and this is where the law is broken first. Two
parts of one thought are one field and take one slot. Splitting them across two slots does not move
information anywhere, it manufactures a second fact that the product does not have:

> Hai phần là một ý giải thích giá; xuống dòng làm action trông như nội dung độc lập.

**This is binding, not advisory.** Every field a page renders falls under exactly one code below,
including the two codes that permit the same field in two regions. There is no field small enough to
be exempt: a route trail is `L8-7` for the same reason a price is `L8-6`. The sentence that skips
this law is almost always *"it would be handy to also show it here"*, and the reader who then sees
the same number twice has to work out which of the two is the real one.

This module decides **which region declares a field**. What that region then holds, in what order,
and with which block is [`fe/blocks`](../../../blocks/INDEX.md). The seam between two slots and the
inset around them is [`fe/principles`](../../../principles/gap/INDEX.md). Neither appears in this
module's output.

## Situation Codes

| Code | Situation | What the plan emits |
|---|---|---|
| `L8-1` | One field, and one candidate region answers the question it belongs to | that region declares the slot, and no other region declares it |
| `L8-2` | The question a field answers has changed | the slot moves whole, and the region that lost it records the move in its `why` |
| `L8-3` | Two co-visible regions about one subject, each asking a different question | identity in the scanning region, description in the detail region |
| `L8-4` | Many comparable facts about one subject | one evidence region with one cell per fact, never one region per fact |
| `L8-5` | Two parts of one thought | **one** slot, held on one line, and no second slot anywhere |
| `L8-6` | Two regions carry the field on mutually exclusive breakpoints | both declare it, and the narrow region carries the exclusion class |
| `L8-7` | Two co-visible regions carry the same kind of control for different roles | both stay, and each `why` names its own role |

Codes `L8-1` to `L8-5` answer *where does this field live*. Codes `L8-6` and `L8-7` answer *may this
field live in a second place as well*, and they are the only two answers that are yes.

`L8-5` IS A COUNTING RULE, NOT A LAYOUT RULE, and it runs before the others. A plan that assigns a
field to a region without first settling whether it is one field has assigned nothing, because the
thing it assigned was not a field. This is the code the founder reached for on the pricing rail,
where a saving and the link that explains the saving were drawn as vertical siblings.

`L8-7` IS A SITUATION, NOT AN ESCAPE. Two navigation controls survive on course detail because the
breadcrumb answers *where did I come from* and the section tabs answer *where can I go inside this
document*. The refusal that produced it was the founder asking why the breadcrumb had disappeared,
after it was deleted on the reasoning that tabs had replaced it.

There is no code for *a field with no region*. That absence is deliberate. A field the product knows
and no region declares is not placed, it is dropped, and dropping is a product decision that belongs
in the brief rather than in a layout plan.

## Inputs

| Input | Evidence required |
|---|---|
| `field` | the datum named the way the product names it, not the way its leaf names it |
| `candidateRegions` | every region on the page that could declare a slot for it, by contract key |
| `owningQuestion` | the one question each candidate answers, quoted from that region's own `why` |
| `coVisibility` | `always-together` · `exclusive-by-breakpoint` · `exclusive-by-state` · `unknown` |
| `grain` | `one-fact` · `two-parts-of-one-fact` · `two-facts-sharing-one-leaf` |
| `subject` | whose fact this is, required whenever two regions render the same leaf |

`subject` is an input because the same leaf is not the same field. `rating-stars` renders in the
review summary and again on every review row, and those are not two homes for one field: the first
is the whole population's mean, the second is what one named person thought. The registry says so
itself at `course-review-author-line`.

`coVisibility` is `unknown` more often than a plan admits, and `unknown` is not `always-together`. A
region that hides below a breakpoint has to prove the hide, because `L8-6` is the difference between
a legal second home and two live copies of one number.

## Invariants

- One field, one owning region, and that ownership survives every state the page has.
- The owning region's `why` states the question the field answers. A field placed in a region whose
  `why` does not mention its question has been placed by convenience.
- A field that moves house moves whole. Leaving the slot behind "for now" produces two owners and no
  record of which is current.
- The region that loses a field updates its own `why` in the same change, because the next reader
  gets the layout from the `why` rather than from the diff.
- A second declaration under `L8-6` carries the exclusion class on the narrow region itself, never
  on a wrapper, so the exclusivity is readable at the point where the duplicate appears.
- Two regions sharing one leaf must name two subjects. If both name the same subject, this is not
  `L8-7`, it is a violation with a role written on top of it.
- Grain is settled before placement. `L8-5` runs first and its answer cannot be revisited to justify
  a second region later.
- A field the product knows and no region declares is escalated as a dropped field, not silently
  omitted from `regions`.

## Exceptions

Exceptions are part of the law rather than relief from it. There are exactly two, they are closed,
and they are different in kind.

- **Mutually exclusive by breakpoint.** `L8-6`. The course price is declared by the pricing rail and
  again by the mobile action bar, and the second carries `md:hidden`, so the two never appear in one
  render. Exclusivity is the whole justification, which is why the exclusion class is an invariant
  and not a detail.
- **Two roles, one kind of control.** `L8-7`. The breadcrumb inside the narrative and the section
  tabs above it are both navigation and both stay, because they answer different questions. The
  reason is the role, never the fact that there was room.
- **Same leaf, different subject.** Not an exception at all, and it is listed here because it is
  read as one. A person's score and a course's mean rating share `rating-stars` and are two fields,
  so each is an ordinary `L8-1`.
- **A field that is genuinely absent below a breakpoint.** Refuse and escalate. A region that is the
  field's only home and is itself desktop-only leaves the field with zero regions on a phone, and
  zero is not one. This is measured and open in `audit.md`; it is not settled by writing `L8-6`.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The scanning region carries identity while the detail region carries the description | neo TỪ CHỐI | `.workflows\fidel\starci-academy\global-search-modal-spacing-listbox-20260815-01.md:466` | "User: “không render briefs ở list nhưng ở bên phải phải có details”." |
| Many comparable facts become cells of one evidence region | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:545` | "User: “xanh render kiểu ribbon… 1 card và chia làm 6”." |
| Two parts of one thought are one field and take one slot | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:360` | "Hai phần là một ý giải thích giá; xuống dòng làm action trông như nội dung độc lập." |
| Two navigation regions coexist when each has its own role | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:440` | "User hỏi trực tiếp vì sao bên trái không có breadcrumbs. Trò nhận sai vì đã loại nó khỏi concept." |
| A live `L8-2`: the region records the field it no longer owns | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2255-2260` | — |
| The evidence region that received it, six comparable cells in one ruled surface | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2270-2279` | — |
| A live `L8-3`: the result region declares no description slot | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2866-2873` | — |
| The detail region that owns `snippet` instead | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2881-2888` | — |
| A live `L8-5`: saving and its explanation held on one no-wrap line | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2175-2181` | — |
| A live `L8-6`: the rail declares the price | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2387-2406` | — |
| The second declaration, carrying `md:hidden` on the region itself | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2581-2588` | — |
| A live `L8-7`: the route trail kept inside the narrative | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2248` | — |
| Same leaf, different subject, stated by the registry itself | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2363-2369` | — |

## Scope

This module decides which region declares a field, and whether a second region may declare it too.
It does not decide what the owning region contains beyond that field, which block renders it, or
what the empty and failed branches show. Those are [`fe/blocks`](../../../blocks/INDEX.md), read
after this module has closed.

Its output feeds `regions` and `sections` of [`gate.schema.json`](../../gate.schema.json): each slot
appears under exactly one region, and a slot repeated across two regions carries the `L8-6` or
`L8-7` reason inside `reason.why`.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding a situation code is a minor bump. Changing the Law sentence is a major bump for the shelf,
because `L8-5` runs before every other placement code on this shelf and `L10` reads its output.
