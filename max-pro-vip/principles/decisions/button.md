---
name: button
description: Decision sheet for the button axis — decide `variant` and `size` when admitting a new button entry into the library. Handed off AFTER the `prominence` axis has already decided "this is really a button".
scope: `variant`/`size` of Button
---

# BUTTON

## Scale — seven variants, no eighth value

| Value | Meaning |
|---|---|
| `primary` | the **single main** CTA of a block/page |
| `secondary` | second most important — next to `primary` **or** standing alone when it is the main action of a small cluster |
| `tertiary` | a secondary action, doesn't need to stand out |
| `outline` | clear border, transparent background — a **standalone** button on a background that needs separation |
| `ghost` | no border, no background — the **lowest tier** of the emphasis scale |
| `danger` | destructive, solid red background, has **not** gone through any confirmation step |
| `danger-soft` | destructive but lighter — **has/will** go through a separate confirmation |

`ghost` is a **lower tier** than `tertiary`, not "a different look at the same level".

**Size:** `sm` dense rows · `md` default · `lg` a standalone, prominent CTA. Choose based on the density of the containing frame — there is no separate decision tree.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Destroys data / not reversible? | → danger branch |
| 2 | The **only path** to the block's main goal? | `primary` |
| 3 | Does the cluster have **≥3 emphasis levels** to distinguish? | lowest tier → `ghost`, higher tiers re-apply starting from question 2 |
| 4 | Standing **alone** and needs a clear border to separate from a colored/image background? | `outline` |
| 5 | Second most important next to `primary`, **or** the main action of a small self-contained cluster? | `secondary` |
| 6 | Remaining — the cluster has only 2 levels, the secondary button just needs to read as a button | `tertiary` |

**Danger branch:** the user needs to stop and take notice **right at the button** ⇒ `danger`. Has/will go through a separate confirmation modal ⇒ `danger-soft`.

## Pairs easily confused

| Pair | The deciding test |
|---|---|
| **`secondary` ↔ `tertiary`** *(bitten twice already)* | the secondary button **itself carries decision weight equal to a business choice** ("Try it" next to "Sign up") ⇒ `secondary`. Just a step-back/supporting action ("Cancel" next to "Submit") ⇒ `tertiary` |

The remaining four adjacent pairs have no logged mistake case yet. Pairs ≥2 steps apart and cross-family pairs: deliberately have no test.

Reasoning and history: [rationale](../../references/axis-notes/button/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
