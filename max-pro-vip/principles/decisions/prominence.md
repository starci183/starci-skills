---
name: prominence
description: Decision sheet for the prominence axis — which MECHANISM to pick when admitting a new entry: muted text, accent text, a bounded chip, or a real button. Sits ABOVE `color` and `button`: this axis picks the form, the other two axes pick the value inside the chosen form.
scope: the decision made before falling into Typography · Chip · Button
---

# PROMINENCE

## Scale — four mechanisms, there is no fifth mechanism

| Step | Mechanism | Use when |
|---|---|---|
| `muted` | text, no frame, dim | neutral meta, a standalone scalar (a count, a time, trivia) |
| `accent` | text, no frame, signal color | link · "mine" · pinned · verified · active — flowing inline |
| `chip` | **bounded** — a soft bounded token | enum/category/status/badge — meaningful even when not clickable |
| `button` | **the actual shape of a button** — its own background/border/padding | a real action happens on click **and** the shape drawn is a button's shape |

`default` is **not** a step on this scale — it is the baseline. Choosing between `muted` and `default` is the job of the `color` axis.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does clicking cause a real action **AND** is the shape drawn a button's shape? | `button` → move to `button` to pick a variant |
| 2 | Is it a bounded token with fixed meaning (enum/status/badge), whether or not it is clickable? | `chip` → move to `color` to pick a tone |
| 3 | A brand/interactive signal that does not need a frame? | `accent` |
| 4 | Everything else — secondary text, standalone scalar | `muted` |

**Question 1 needs both halves.** A chip wrapped in a `Popover.Trigger` really is clickable, but its shape is still a chip → stop at question 2.

## Three adjacent pairs — the whole battle

| Pair | The deciding test |
|---|---|
| `muted` ↔ `accent` | has an interactive/brand signal ⇒ `accent` · standalone neutral fact ⇒ `muted` |
| **`accent` ↔ `chip`** *(the heaviest one)* | is the meaning bound to a fixed set of values **and** does it need to be set apart from running text so the eye reads "this is a LABEL"? ⇒ `chip`. Reads inline within a sentence ⇒ `accent` |
| `chip` ↔ `button` | clicking creates a real action (not just opening the detail of that same token) **and** the shape drawn is a button's shape ⇒ `button` |

Hesitating on a pair ≥2 steps apart = the tree is drawn wrong. Go back to the tree.

Reasoning and history: [rationale](../../references/axis-notes/prominence/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
