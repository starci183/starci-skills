---
name: reading-flow
description: Decision sheet for the reading-flow axis — which alignment to pick when admitting a new entry: aligning TEXT within its box, or aligning a BLOCK within its track. Two PERPENDICULAR scales — both have a "center" step, which makes them easy to mistype for each other.
scope: `align` of Typography/Table · `justify`/`align` of a track · a one-off `ml-auto`
---

# READING-FLOW

## Two scales, never merge them

**Scale A — aligning TEXT within its own text box**

| Step | Class | Note |
|---|---|---|
| `start` | `text-start` | default — leave the prop unset |
| `center` | `text-center` | only for the exceptions below |
| `end` | `text-end` | Table has no `center` — numbers/actions are never centered |

Vocabulary is **logical** (`start`/`end`), not physical (`left`/`right`) — it flips automatically under RTL.

**Scale B — where a block sits within its parent track**

| Track | Prop | Values |
|---|---|---|
| HORIZONTAL (`StackH`, `Cluster`) | `justify` | `start · center · end · between` |
| VERTICAL (`StackV`) | `align` | `start · center · end · stretch` — no `between` |

`ml-auto` is a third path: pushes **exactly one** element to the end, without changing `justify` for the whole track.

## Four exceptions allowed to center

empty-state/error · **one** hero focal point · loading/spinner · single-button confirmation modal *(still open — no live anchor yet, awaiting the teacher's call)*

Outside these four cases, main content ≥2 lines ⇒ **`start`, not center.**

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Setting alignment for TEXT within its box, or for where a BLOCK sits? | text → Scale A · block → question 2 |
| 2 | Is it one of the four exceptions? | no → `start`, **stop** |
| 3 | Does the track run horizontal or vertical? | horizontal → `justify` · vertical → `align` |
| 4 | Pushing exactly one element to the end? | → `ml-auto` on that element itself |
| 5 | Inside a `<button>`/pressable? | → you **must** explicitly set `text-start` to override the UA default |

A component that already has its own `align` prop (`TableColumn.align`) → use it directly, do not re-apply the tree.

## Easily-confused pairs

| Pair | The deciding test |
|---|---|
| A `start` ↔ `center` | ≥2 running lines of text ⇒ `start` required |
| A `center` ↔ `end` | number/amount/date/trailing action at end of row ⇒ `end` |
| B `start` ↔ `center` | main content ⇒ `start` · a single focal block ⇒ `center` |
| B `center` ↔ `end` | a single trailing action/caret ⇒ `end` |
| B `start` ↔ `between` | exactly two groups needing maximum separation ⇒ `between` |
| B `stretch` ↔ `center` | child needs to fill the full width ⇒ `stretch` (default for `StackV`) |
| **A ↔ B** | same word "center" but a different job: `text-center` aligns TEXT · `align="center"` aligns a BLOCK. Aligning an icon+label row with `text-center` is the **wrong tool** |
| `justify` ↔ `align` | both props exist on every track ⇒ typing the wrong one **does not fail to compile** |

Reasoning and history: [rationale](../../references/axis-notes/reading-flow/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
