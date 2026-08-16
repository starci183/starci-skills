---
id: fe-layouts-laws-l5-every-route-has-a-real-owner-index
title: INDEX.md
slug: /fe/layouts/laws/l5-every-route-has-a-real-owner
sidebar_label: l5-every-route-has-a-real-owner
sidebar_position: 0
description: Binding rules for what a route entry file may hold, and the criterion that separates a route carrying content from a door that forwards — including the two opposite rulings the founder made about the same route.
---

# INDEX.md

Version: `1.00` · Module: `l5-every-route-has-a-real-owner` · Law: `L5` · Refusals: **11 across 2 records**

## Law

A route that **carries content** has a **real page owner**: one folder under
`src/components/pages/`, mounted by the route file and by nothing else. A route that is a **door**
forwards, and forwarding is legal only because nothing becomes unreachable when it does.

**Which route is the door is a product decision this law does not make.** The founder ruled on
`/learn` twice, in opposite directions, and both rulings stand. A canon that picked one of them as a
default would be overruling half of its own evidence:

> "Trang hôm nay là ở route `/learn` default".

> "sửa learn để follow legacy".

The law therefore returns a **classification**, never a destination. It tells you whether this route
owes an owner or owes a ruling. It never tells you which door opens where.

**This is binding, not advisory.** Every route entry file in the live tree falls under exactly one
code below, and the count is closed: **51 route files, 48 mounting a real owner, 3 forwarding, 0
doing anything else.** There is no third body a route file may have.

The failure this law exists to stop is not a missing page. It is a route that **looks finished**.
A stub compiles, a redirect renders, a borrowed neighbour's page fills the viewport, and all three
turn a route green while the product behind it is absent or wrong. That is why the refusal is about
evidence rather than effort:

> "Legacy parity yêu cầu đúng anatomy và state, không chỉ route tồn tại."

This module decides **route ownership only**. What the owner's regions contain is
[`blocks`](../../../blocks/INDEX.md); how the frame arranges them is the archetype module.

## Situation Codes

| Code | Situation | What the route entry emits |
|---|---|---|
| `L5-1` | The route is a mode a reader is meant to land on and read | a route file that resolves params and mounts **one** named page owner |
| `L5-2` | The route is a door and its destination is computable from the route params alone | a bare server `redirect()` and **no page owner at all** |
| `L5-3` | The route is a door but its destination is only known after asking runtime | a **real page owner** that resolves, forwards, and declares what it draws while waiting |
| `L5-4` | The route exists and the owner is a stub, an approximate shape, or a neighbouring page borrowed | **nothing ships** — the route goes into `owed` |
| `L5-5` | Two candidate destinations for the same door | **no value** — the law returns the question and the plan carries the ruling |
| `L5-6` | A ruling moved content off a route that used to carry it | the **death list**: every owner, branch, constant and contract that stops being reachable |

`L5-1` to `L5-3` answer *what does this route file contain*. `L5-4` to `L5-6` answer *what happens
when the answer is not available yet, or changes*.

`L5-2` AND `L5-3` ARE BOTH DOORS AND THEY ARE NOT INTERCHANGEABLE. The split is not how important
the route is; it is where the destination comes from. `/learn` knows its target from `displayId`
before anything renders, so it forwards with no owner. `/profile` cannot know the username until the
viewer query answers, so the waiting is a state somebody must own, and that somebody is a page.

`L5-4` IS A SITUATION, NOT A GAP IN THE PLAN. Emitting nothing is the proof the route was classified
and found to have no legal body yet. A route listed in `owed` has been decided; a route quietly
given a redirect has been hidden.

`L5-5` RETURNS NOTHING ON PURPOSE. It is the one code whose output is a question for the founder,
and answering it from precedent is the exact failure the code exists to prevent.

There is no code for *a door that also carries content*. No live route does both, and the shape has
never been ruled on, so a plan that needs one must stop at `L5-5` rather than invent the hybrid.

## Inputs

| Input | Evidence required |
|---|---|
| `routeRole` | `carries-content` · `door` · `unknown` — never inferred from whether the route currently renders |
| `destinationEvidence` | `from-route-params` · `from-runtime-answer` · `none` — required whenever `routeRole` is `door` |
| `contentElsewhere` | the named route that still holds this content once this route is gone, or `none` |
| `ownerPath` | the exact `src/components/pages/<Name>/` folder, **by name**, required whenever `routeRole` is `carries-content` |
| `waitingState` | what the reader sees while a runtime-resolved door decides, required whenever `destinationEvidence` is `from-runtime-answer` |
| `doorRuling` | the verbatim founder line that fixes this door's target, required whenever more than one destination is defensible |
| `flipCasualties` | every owner, branch, constant and contract that stops being reachable, required whenever the input is `phan-hoi` with `feedbackKind: lat-lai-phan-quyet-cu` |

`contentElsewhere` is the whole criterion and it is answered by naming a route, not by judging
importance. Ask: **remove this route entirely — is there content that now exists nowhere?** A name
means `carries-content`. `none` means `door`.

`ownerPath` is an input rather than an output because the owner is named while it does not exist
yet. A route whose owner cannot be named is `L5-4`, and that is a finding to write down, not a
reason to reach for the nearest page that renders.

## Invariants

- One route entry file, one of exactly two bodies: mount a named owner, or `redirect()`. Nothing
  else. The live tree holds 48 of the first and 3 of the second.
- The route file resolves params and mounts. It does not draw and it does not fetch.
- A door computable from route params never carries a page owner; a door that must ask runtime
  always does, because the wait is a visible state that can fail.
- Green is not owned. A route that typechecks, renders and passes lint is not evidence that the
  product behind it exists.
- A page owner belonging to another route is not this route's owner, however close the two look.
- Compatibility is not parity. Keeping an old address alive is legal; keeping it alive **instead of**
  the surface it used to open is a change of meaning.
- The door's target follows the product ruling. There is no default, and "whichever we did last
  time" is not a ruling.
- A ruling that empties a route carries the death list with it, in the same plan.
- A `L5-3` owner declares what it renders while waiting, even when that is nothing, because
  rendering nothing on purpose and rendering nothing by accident are different states.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A door that owns a page.** `L5-3`, the one admitted departure from "a door has no owner".
  `/profile` mounts `ProfileRedirectPage`, which reads the viewer, sends a known identity to
  `/profile/<username>` and an absent one to `/authentication`. Two outcomes, one failure mode and
  one wait: that is a page's job, not a redirect's.
- **A `L5-3` owner that draws nothing.** `_ProfileRedirectPage` returns `null` and is still a real
  owner. The `L5-4` refusal is aimed at a route pretending to have a surface, not at an owner that
  deliberately shows no transient screen.
- **The `/learn` ruling is about `/learn`.** Ruling B settles which door that one address opens. It
  does not license forwarding any route that is inconvenient to build, and reading it that way
  reinstates exactly the stub the founder refused in ruling A.
- **A legacy address whose surface was a product.** Not an exception, a refusal: `/qa` was kept as a
  redirect "for parity" and that was overturned. The live tree now mounts `CourseQaPage`.
- **A route the founder has not ruled on.** `L5-5`. The plan states both candidate destinations and
  stops. It does not pick the one that matches the last similar route.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A stub turns a route green while the product behaviour is wrong | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:495` | "Stub làm route “xanh” nhưng sai product behavior và vi phạm parity." |
| A route existing is not a route being owned | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:563` | "Legacy parity yêu cầu đúng anatomy và state, không chỉ route tồn tại." |
| An approximate shape is not an owner | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:640` | "Approximate UI would violate absolute legacy parity." |
| A neighbouring page's owner is not this route's owner | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:755` | "Course purchase/detail anatomy is not the legacy learning dashboard." |
| Forwarding a route to the reader erases the surface that route owned | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:756` | "Legacy module page owns its own header, continue band and lesson/challenge lists." |
| A route that typechecks is not a finished route | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:854` | "Feedback agent xác nhận còn gap." |
| A redirect kept "as parity" changes the meaning of the address | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:1491` | "Legacy QA is a product surface; redirect changes meaning." |
| `L5-5` ruling A — `/learn` carries content and gets a real owner | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:1858` | "“Trang hôm nay là ở route `/learn` default”." |
| `L5-5` ruling A, restated at Apply | neo TỪ CHỐI | `.workflows\designs\starci-academy\learn-branch.md:2109` | "User: “Trang hôm nay là ở route `/learn` default”." |
| `L5-5` ruling B — the flip: `/learn` is a door onto legacy | neo TỪ CHỐI | `.workflows\fidel\starci-academy\learn-legacy-ai-policy.md:79` | "User: “sửa learn để follow legacy”." |
| `L5-5` ruling B, with the reason that makes it binding | neo TỪ CHỐI | `.workflows\fidel\starci-academy\learn-legacy-ai-policy.md:159` | "Binding legacy behavior and the user's explicit direction." |
| A live `L5-1`: the route resolves params and mounts one owner | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\courses\[displayId]\learn\qa\page.tsx:7` | — |
| A live `L5-2`: door whose target comes from the route params | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\courses\[displayId]\learn\page.tsx:9` | — |
| A live `L5-2`: the site root, with the reason written in the file | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\page.tsx:18` | — |
| A live `L5-2`: the third and last door in the tree | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\courses\[displayId]\learn\flashcards\page.tsx:10` | — |
| A live `L5-3`: a door that must be a page | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\profile\page.tsx:4` | — |
| The two outcomes a `L5-3` owner resolves between | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\ProfileRedirectPage\index.tsx:10-13` | — |
| A `L5-3` owner declaring that it draws nothing while it waits | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\ProfileRedirectPage\component.tsx:2` | — |
| A `L5-6` casualty: a fully built owner no route mounts | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnTodayPage\index.tsx:20` | — |
| A `L5-6` casualty: the predicate that can no longer be true | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\index.tsx:128` | — |
| A `L5-6` casualty: the tab set that predicate gated | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\index.tsx:95-99` | — |
| A `L5-6` casualty: the orphaned contract key | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:289` | — |

## Scope

This module states `L5` for the whole [`layouts`](../../INDEX.md) shelf. Inside the
`destination-column` archetype the same law is expressed as
[`SPINE-6`](../../archetypes/destination-column/INDEX.md), and `SPINE-6` remains the code a `LayoutPlan` emits
for a route under that frame. The two must never disagree; where they do, this file is the law and
the difference is a finding.

`L5` decides whether a route has an owner and what that owner's file may contain. It does not decide
the archetype of the page, the regions inside it, the frame contract, or the states the owner
enumerates. Those are the archetype modules and [`blocks`](../../../blocks/INDEX.md), read after this
module has closed.

Its output feeds `LayoutPlan.pageId` and `LayoutPlan.owed` in
[`gate.schema.json`](../../gate.schema.json). A route classified `L5-4` or `L5-5` produces an `owed`
entry rather than a `pageId`.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump. Changing the Law sentence, or adding a default to `L5-5`, is a
major bump for the shelf, because `destination-column` resolves into this module.
