---
name: skeleton
description: Decision sheet for the skeleton axis — decide whether a component needs `isSkeleton` and how the shimmer shape is drawn when admitting a new entry into the library. Does not answer empty/error (see `async`).
scope: 7 shimmer shapes — a CATEGORICAL scale, with no order
---

# SKELETON

## Scale — seven shapes, no eighth shape

| # | Shape | When |
|---|---|---|
| 0 | **no dedicated skeleton** | the frame only wraps a slot/children, it doesn't generate any pixels of its own |
| 1 | **single node** | the root of the skeleton branch is itself a shimmer node |
| 2 | **mirror of several fixed nodes** | a few nodes, **countable** in number and not dependent on data |
| 3 | **mirror by a known-in-advance axis** | there is a shape axis the caller has **already configured** before loading ⇒ **must branch** |
| 4 | **row count via a dedicated prop** | a repeating list, the real row count isn't known yet ⇒ add `skeletonRows`/`skeletonCount` + a default |
| 5 | **pass the flag down to the child** | the child **already has** its own `isSkeleton` |
| 6 | **a single shape** | the shape axis **is decided by data** — deliberately no invented variants |

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| Q1 | Does the component draw any **shape** itself, or is it just a frame wrapping a slot? | no ⇒ **0** |
| Q2 | Is the part inside the skeleton branch another component that **already has** `isSkeleton`? | yes ⇒ **5** — just pass the flag |
| Q3 | Is it a **repeating list** whose count depends on data? | yes ⇒ **4** |
| Q4 | Is there another shape axis, and does the caller **know it in advance** or is it **decided by data**? | known in advance ⇒ **3** · decided by data ⇒ **6** · none ⇒ Q5 |
| Q5 | Does the fixed shape have **more than one** node? | yes ⇒ **2** · no ⇒ **1** |

**Two positioning rules:** the `isSkeleton` branch must come **before every other shape branch**; if the component has hooks, it must come **after every hook has been called**.

## Pairs easily confused

| Pair | The deciding test |
|---|---|
| 1 ↔ 5 · 2 ↔ 5 | is that part another component that **already has** `isSkeleton`? yes ⇒ pass the flag, don't draw it yourself |
| **3 ↔ 6** *(bitten twice already)* | is the axis value **written into the code by the caller before the request runs**? ⇒ **3**, must branch. Only known **after** the data resolves ⇒ **6** |
| 0 ↔ 2 · 0 ↔ 4 | Q1 hasn't been answered yet. A frame wrapping a child list doesn't mean **the frame itself** needs `isSkeleton` |
| 1 ↔ 3 | Q4 hasn't been answered yet. "Looks like a single node" but actually has a `size`/`variant` is really **3** |

Reasoning and history: [rationale](../../references/axis-notes/skeleton/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
