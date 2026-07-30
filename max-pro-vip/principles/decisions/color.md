---
name: color
description: Decision sheet for the color axis — which color/status/tone value to pick when admitting a new entry. Does not answer font size (see `text`), does not answer overall prominence (see `prominence`).
scope: exactly one prop — `color` of Typography · `status` of Alert · `tone` of Chip
---

# COLOR

## Scale — six values, there is no seventh value

| Value | Class | Use for |
|---|---|---|
| `default` | *(not declared)* | PRIMARY text — titles, values, figures carrying real information |
| `muted` | `text-muted` | SECONDARY text — hints, captions, meta, standalone timestamps, trivia |
| `accent` | `text-accent` | BRAND/INTERACTIVE — link, "mine", active. **Does not** signal data state |
| `success` | `text-success` | CORRECT / complete |
| `warning` | `text-warning` | NEEDS ATTENTION / approaching a threshold |
| `danger` | `text-danger` | ERROR / irreversible |

SSOT: `TypographyColor` · `AlertStatus` · `ChipTone`. Chip calls the neutral branch `neutral` — same meaning as `default`, different name.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does the color **have to** change whenever the data changes? | → 1a |
| 1a | Complete · needs attention · errored? | `success` · `warning` · `danger` |
| 2 | Brand/interactive signal, not tied to a data outcome? | `accent` |
| 3 | Secondary text, or standalone trivia not attached to a control? | `muted` |
| 4 | Everything else | `default` — do not declare `color` |

**A number sitting next to a control:** must pass **two full layers** — (a) does it carry a real informational value? (b) is it structurally attached to the currently active control? Both ⇒ `default`. Collapsing the two questions into one is a bug that has actually happened (2026-07-29).

## Five adjacent pairs — the whole battle

| Pair | The deciding test |
|---|---|
| `muted` ↔ `default` | the two layers above. Standalone + trivia ⇒ `muted` |
| `default` ↔ `accent` | clickable/active without reflecting an outcome ⇒ `accent` |
| `accent` ↔ `success` | does the color have to change when the data changes? yes ⇒ `success` · no ⇒ `accent` |
| `success` ↔ `warning` | fully complete ⇒ `success` · still moving toward a threshold ⇒ `warning` |
| `warning` ↔ `danger` | already happened, irreversible ⇒ `danger` · still time to act ⇒ `warning` |

Hesitating on a pair **≥2 steps apart** = the tree is drawn wrong, not a wrong value pick. Go back to the tree.

Reasoning and history: [rationale](../../references/axis-notes/color/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
