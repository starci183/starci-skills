---
name: frame
description: Decision sheet for the frame axis — which value to pick when choosing a frame for layout: Stack, Cluster, Grid, Split, Container, ResponsiveRow.
scope: choosing the frame component, not the values inside the frame
---

# FRAME

## Scale — six frames, there is no seventh frame

| Frame | Props that decide the contract | Meaning |
|---|---|---|
| `Stack.V` / `Stack.H` | `children` — **no** `items` | 1 axis, arbitrary children, different types. `wrap` only on `.H` |
| `Cluster` | `items` required · **`children` forbidden** | N elements of the same kind, wraps freely, order carries no meaning |
| `Grid` | `items` + `columns` | A true 2D grid — columns line up across rows. Fixed column count; fewer cells just **leave gaps** |
| `Split` | `start`/`end` — 2 named slots | Exactly **two** sides with fixed roles: `start` can shrink, `end` cannot |
| `Container` | `size?`/`padding?` + 1 slot | **Reading measure** — centers, constrains width. No longer has `gap`/`header`/`footer` |
| `ResponsiveRow` | `items` + `columns: 1\|2` + `at` | Fixed grid below the `at` breakpoint, **stretches evenly** to fill the width at `at` and above |

**Not counted in the scale:** `Flex` (internal, only `Stack` imports it) · `SplitWorkspace` (a specific shape whose measurements are already frozen).

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Constrain the **reading width** + pad around a block? | `Container` — then **repeat the tree** for what's inside |
| 2 | Exactly 2 elements, fixed roles, one side **must be able to shrink**? | `Split` |
| 3 | N elements of **the same kind**, reordering doesn't change meaning, wraps, no need to line up columns? | `Cluster` |
| 4 | Equal columns, **aligned in both directions**? | `Grid` |
| 4b | Same as question 4 but fewer cells than columns and need to **stretch evenly** instead of leaving gaps? | `ResponsiveRow` |
| 5 | Everything else: 1 axis, arbitrary children | `Stack.V` / `Stack.H` |

**The props contract beats gut feel.** If the content can't be expressed as `items`/`start`+`end` and you're forced to stuff in an arbitrary `ReactNode` ⇒ immediate proof you're in the `Stack` branch, regardless of what the tree says.

## Pairs easily confused

| Pair | The deciding test |
|---|---|
| `Stack.H` ↔ `Cluster` | same kind repeated + reordering doesn't change meaning ⇒ `Cluster`. **not yet locked in as a hard rule** |
| `Stack.H` ↔ `Split` | exactly 2 elements, one side must shrink ⇒ `Split`. ≥3 elements or neither shrinks ⇒ `Stack.H` |
| `Stack.V` ↔ `Container` | relationship between the children ⇒ `Stack` · width+padding of the block itself ⇒ `Container` |
| `Cluster` ↔ `Grid` | the next row needs to **line up columns** with the row before ⇒ `Grid` · just needs to wrap like text ⇒ `Cluster` |

Pairs ≥2 steps apart: hesitating there means the tree is drawn wrong. Go back to the tree.

Reasoning and history: [rationale](../../references/axis-notes/frame/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
