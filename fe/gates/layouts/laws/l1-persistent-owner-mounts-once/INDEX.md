---
id: fe-layouts-laws-l1-persistent-owner-mounts-once-index
title: INDEX.md
slug: /gates/layouts/laws/l1-persistent-owner-mounts-once
sidebar_label: l1-persistent-owner-mounts-once
sidebar_position: 0
description: Binding rules for how many times an owner mounts and how high, decided by whether the address can recompute what that owner holds.
---

# INDEX.md

Version: `2.00` · Module: `l1-persistent-owner-mounts-once` · Law: `L1` · Refusals: **3 across 1 record**

## Law

An owner mounts **once, at the locale root**, when it holds state the address cannot recompute: an
open conversation, a live socket, a started server session. Every other owner mounts in each
route-group layout that needs it, and repeating it there is not a violation.

The deciding question is not how global the owner feels, and not whether it is visible. It is
whether a fresh mount somewhere else would produce the same answer. `ShellNav` reads the lit
destination from `usePathname()` and the selected tab from `useSearchParams()`, so remounting it in
the next cluster recomputes both exactly. `GlobalAiChatLayout` holds an open conversation, a
selected code context and a tangent counter in three `useState` calls, and no address recomputes any
of the three.

**The earlier statement of this law was wrong and is withdrawn.** It said that a global visual owner
does not mount into chrome repeated per route cluster, which reads as a ban on the six `ShellNav`
mounts the live tree ships and a live test protects. Where source and trust disagree the difference
is a finding to resolve, and here the source was right: the refusal behind this law names
conversation state, not visibility.

> `ShellNav` is repeated by route clusters and would drop conversation state on cross-cluster
> navigation.

**This is binding, not advisory.** Every owner a layout mounts falls under exactly one code below,
including `L1-7`, which emits nothing and escalates instead. "It is only the navbar" is where this
law gets skipped, and hoisting a redrawable chrome owner to the root to satisfy a misread of it is
a change no evidence asks for.

This module decides **mount count and mount height only**. What the owner draws belongs to
[`gates/blocks`](../../../blocks/INDEX.md); the seam, the offset and the plane belong to `gates/principles`
— [`divider`](../../../principles/divider/INDEX.md),
[`position`](../../../principles/position/INDEX.md) and
[`elevation`](../../../principles/elevation/INDEX.md) — and never appear in this module's output.

## Situation Codes

| Code | Situation | Where the owner mounts |
|---|---|---|
| `L1-1` | Runtime state must survive a move between route clusters | once at the locale root, through the one shell that converts children into a component |
| `L1-2` | That same owner must be invisible on some routes | **the same single mount** — it drops its visible composition and keeps its provider |
| `L1-3` | Chrome the address recomputes in full | in every route-group layout that needs it; six copies of one navbar is the correct answer |
| `L1-4` | A route family that must not carry the chrome at all | **nowhere** in that family's layout, and a test holds the boundary |
| `L1-5` | The survival scope is one cluster rather than the app | at that cluster's own layout, not the root |
| `L1-6` | The owner has no visible composition at all | the provider tree — and a visual owner never goes there |
| `L1-7` | An address-recomputable owner nonetheless holds live overlay state | **nothing yet** — escalate as owed; what a cross-cluster move does to it is unmeasured |

Codes `L1-1` and `L1-3` answer *how many times does this owner mount*. Codes `L1-2` and `L1-4`
answer *what happens on a route that must not have it*, and they are not the same answer. Codes
`L1-5` to `L1-7` answer *what to do when the owner is neither plainly global nor plainly redrawable*.

`L1-2` AND `L1-4` ARE DIFFERENT SITUATIONS. Hiding is not unmounting. `GlobalAiChatLayout` stays
mounted on authentication and on live-assessment routes and returns only the routed surface inside
its provider, so the conversation survives the exam the reader is sitting. `ShellNav` is genuinely
absent from the authentication family, because there is nothing there for it to preserve. Reading
these two as one code produces either a dead conversation or a navbar over a sign-in form.

`L1-3` IS A SITUATION, NOT A TOLERATED BREACH. Six mounts of the same chrome is what the plan should
emit, and the number six is a property of how many clusters want navigation rather than a smell.

There is no code for *an owner that is global because it appears everywhere*. That absence is
deliberate. Appearing everywhere is a fact about the routing table; surviving navigation is a fact
about state, and only the second one decides a mount height.

## Inputs

| Input | Evidence required |
|---|---|
| `stateOrigin` | `address-recomputable` · `runtime-only` · `unknown` — the deciding input, named per piece of state the owner holds |
| `survivalScope` | `cross-cluster` · `one-cluster` · `one-route` — how far the state has to travel intact |
| `composition` | `visual` · `context-only` — whether the owner renders anything of its own |
| `hiddenRoutes` | the NAME of the predicate deciding where the owner is invisible, required whenever the owner hides, and shared with the frame owner |
| `mountPoint` | `locale-root` · `cluster-layout` · `route-group-layout` · `provider-tree` |

State is **address-recomputable** when you can name the hook that reads it out of the URL and say
what value a fresh mount would produce. `usePathname()` and `useSearchParams()` are that evidence.
A `useState` initialised to `false` is the opposite of that evidence, and so is a socket handle.

`stateOrigin` is measured per piece of state, not per owner, because one owner can hold both kinds.
That is exactly the case `L1-7` exists for: when a redrawable owner is also holding something a
remount would throw away, the mixture is reported rather than averaged.

`hiddenRoutes` is an input rather than a detail because two owners hiding on the same routes must
read one function. Two lists drift apart quietly, and the first person to see the drift is a reader
sitting an exam with navigation on screen and the assistant gone.

## Invariants

- Mount height equals survival scope. An owner mounted inside chrome that repeats per cluster dies
  at every cluster boundary, so mounting it there is a statement about how long it lives.
- The test is recomputability, never visibility. A visible owner may repeat; an invisible one may
  not, if what it holds cannot be rebuilt from the address.
- Hiding drops the visible composition and keeps the mount. An owner that unmounts to hide has
  chosen `L1-4` while claiming `L1-2`.
- One predicate names the hidden routes, and every owner that hides for the same reason imports it.
- A visual owner is never mounted in the provider tree. The provider tree owns contexts, and
  composition placed there is composition nobody can see in the layout it belongs to.
- Conversion from `children` to a component happens once, at `RouteShell`, wherever the mount sits.
- Repetition per route group is legal for `L1-3` and needs no justification in the plan. What needs
  justification is the single mount, because a single mount is a claim that something would be lost.
- An owner that repeats per cluster and also holds runtime state is a finding under `L1-7`. It is
  not resolved by hoisting it and not resolved by declaring the loss intended.
- The absence of the chrome from a route family is part of the plan and carries its own guard. An
  absence nobody wrote down is indistinguishable from an omission.

## Exceptions

Exceptions are part of the law. Each is closed and names the code it modifies.

- **Auth and live-assessment routes.** `L1-2`. The persistent AI owner keeps its mount and returns
  the routed surface alone. The predicate covers `/authentication` and every live-assessment path,
  and it is one function.
- **A keeper whose scope is one cluster.** `L1-5`. The playground session owner mounts at
  `playground\[slug]\layout.tsx`, because a socket opened for that slug has no reason to outlive the
  slug. Locale-root is the answer for cross-cluster survival, not a default for anything persistent.
- **The authentication family and the chrome.** `L1-4`. No `ShellNav` mount at all, and the boundary
  is asserted by a test rather than by habit.
- **A redrawable owner holding live overlay state.** `L1-7`. Refuse to bless it and escalate. The
  cart drawer, the sign-in overlay and the search overlay are mounted once beside the control that
  opens them, inside the chrome that repeats. Whether a cross-cluster move with the drawer open is
  intended is unmeasured, so the law does not speak as though it were settled.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Repeated chrome would drop conversation state, so the persistent owner mounts above the clusters | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:708` | "`ShellNav` is repeated by route clusters and would drop conversation state on cross-cluster navigation." |
| The provider tree was refused for a visual owner because it holds contexts only | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:709` | "Existing owner explicitly contains contexts and nothing visual." |
| Composition does not belong in the provider tree | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:122` | "Providers own contexts, not visual composition." |
| Three pieces of state no address recomputes | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:32-34` | — |
| Hiding keeps the mount and drops only the visible tree | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:56-62` | — |
| The owner states its own purpose as outliving the routed surface | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:27` | — |
| The single locale-root mount, through the converting shell | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\layout.tsx:101` | — |
| The lit destination is recomputed from the address | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:120` | — |
| The selected tab is recomputed from the address | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:126` | — |
| One of six route-group mounts of the same chrome | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\cart\layout.tsx:31` | — |
| A live test forbids that chrome at the locale root | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\authentication\layout-boundary.test.ts:18` | — |
| The same test requires it inside the families that own it | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\authentication\layout-boundary.test.ts:24-25` | — |
| One shared predicate decides where the persistent owner is invisible | neo CODE | `D:\Repositories\starci-academy-fe\src\modules\ai\content-ai-route-context.ts:64-68` | — |
| A cluster-scoped keeper mounts at its own cluster boundary | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\courses\[displayId]\learn\playground\[slug]\layout.tsx:15` | — |
| What that keeper holds: a relay socket and a started server session | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\PlaygroundSessionLayout\index.tsx:52-54` | — |
| Live state living inside the repeated chrome | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:53-56` | — |
| The drawer mounted once beside the control that opens it | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:169` | — |

## Scope

This module decides how many times an owner mounts and at which layout boundary. It does not decide
what that owner renders, which regions sit beside it, or how the chrome is drawn once mounted.

Its output feeds three fields of [`gate.schema.json`](../../gate.schema.json): `routeCluster`, which
carries `locale-root` exactly when the answer is `L1-1`; `reusesLayout`, which names the owner; and
`persistence` on the owner's region, which is `dung-yen-du-lieu` for `L1-1` and `L1-5` and
`ve-lai-theo-route` for `L1-3`.

`L1-2` also feeds `optional` on the region, and the predicate named in `hiddenRoutes` must be the
same function the frame owner reads.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump; changing the Law sentence is a major bump for the shelf,
because [`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) resolves `KEEPER-1` into it and the
routing table in [`../../INDEX.md`](../../INDEX.md) states the law in one line of its own.
