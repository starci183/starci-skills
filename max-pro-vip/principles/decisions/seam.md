---
name: seam
description: Decision sheet for the seam axis — which value to pick for the spacing between two things, the `gap` prop.
scope: `gap` of the frame. A seam has exactly ONE owner — the parent frame.
---

# SEAM

## Scale — six steps, there is no seventh step

| Step | Class | px | Relationship |
|---|---|---:|---|
| `flush` | `gap-0` | 0 | **one** unit of meaning — a title and subtitle on the same line |
| `tight` | `gap-1` | 4 | **MARK** attached to one thing — icon before a label, unit after a number |
| `related` | `gap-2` | 8 | **PEER** within a set — a row of chips, two buttons, a name and a milestone |
| `grouped` | `gap-3` | 12 | **ROW** stacked within a surface — a list row |
| `section` | `gap-6` | 24 | **REGION** different parts of one block — header/body/footer |
| `page` | `gap-8` | 32 | **BLOCK** separate on the page — block next to block |

SSOT: `SeamScale`.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Delete one and the other **loses meaning/loses context**? | `flush` or `tight` |
| 2 | Same kind, repeated, neither one is the owner? | `related` |
| 3 | Different roles but together form one line of identification? | `related` |
| 4 | Several different regions within the same larger unit? | `grouped` |
| 5 | Separate functional blocks that can stand on their own? | `section` or `page` |

**If there's a real `src`, MEASURE the source, use the measured value.** The tree is only a fallback when there's no source.

## Three adjacent pairs — the whole battle

4/4 real seam bugs logged so far were all adjacent pairs. Never off by ≥2 steps.

| Pair | The deciding test |
|---|---|
| `flush` ↔ `tight` | both **are text** and read together as one idea ⇒ `flush`. One of them isn't text (icon, dot) or is a glued suffix ⇒ `tight` |
| `tight` ↔ `related` | **MARK or PEER.** Delete one, the rest stands complete on its own ⇒ `related`. Still means something but loses the context the other one supplied ⇒ `tight` |
| `related` ↔ `grouped` | **can the order be reversed.** Swap places and meaning doesn't change ⇒ `related`. Order carries meaning, or each row is a different KIND ⇒ `grouped` |

`grouped`↔`section` and `section`↔`page` have never actually bitten.

Reasoning and history: [rationale](../../references/axis-notes/seam/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
