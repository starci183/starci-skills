---
name: text
description: Decision sheet for the text axis — which size/weight tier to pick when admitting a new entry. Two INTERSECTING scales — picking a size does not automatically get the weight right, and some render branches ignore weight entirely even when it is passed.
scope: `size`/`weight` of Typography. Semantic color belongs to the `color` axis.
---

# TEXT

## Four role tiers

| Tier | size × weight | Use when |
|---|---|---|
| **A** | `h3`–`h5` + **`bold`** | stands **alone** as the focal point of a block/card/grid |
| **B** | `sm` + `medium` | **one row** in a dense list/table, not standing alone |
| **C** | `sm`/`base`, regular, usually `muted` | a sentence/paragraph describing a title above it |
| **D** | `xs`, regular | secondary meta: timestamp, tier-2 caption, struck-through price |
| **Exception** | `base` + `semibold`, **never** `h*` | **Modal** title — easiest to confuse with Tier A |

`h6` **does not exist** — when porting a real `h6`, drop it to `h5`. A step only exists when someone chose it **because it is different**, not because the library happens to offer it.

## Weight — four values, the fourth value is "not declared"

| Value | Meaning |
|---|---|
| *(not declared)* | regular — long-form prose |
| `medium` | working emphasis — labels, names, body-sized values |
| `semibold` | block-level heading emphasis. **In body it folds to `medium`**, only genuinely different in a heading |
| `bold` | heading/display. **Never** at `sm`/`xs` |

## Decision tree

**Step A — pick the tier.** Modal title? → exception, stop. Stands alone as the focal point? → A. One row in a list? → B. A prose sentence? → C. Everything else → D.

**Step B — does the weight actually render as chosen?** Three things break a tier **with no error at all**:

| Ask | If YES |
|---|---|
| has `prefixIcon`/`suffixIcon`? | weight is forced to `font-medium`, whatever you pass **has no effect** |
| is `isLink`? | `weight` **is not read** |
| `size="code"`? | `weight` **is not read** |

## Easily-confused pairs

| Pair | The deciding test |
|---|---|
| A ↔ B | can stand alone ⇒ A · always one row in a list ⇒ B |
| B ↔ C | a short name/label standing out from the surrounding line ⇒ B · a prose sentence in a secondary voice ⇒ C |
| C ↔ D | removing it loses **the main point** ⇒ C · only loses a minor detail ⇒ D |
| regular ↔ medium | label/name needs to stand out ⇒ `medium` |
| medium ↔ semibold | in **body** the two render identically — write `medium` for clarity. Only genuinely different in a heading |
| semibold ↔ bold | Tier A ⇒ `bold` · Modal header/verdict/total amount ⇒ `semibold`, never `bold` |

Reasoning and history: [rationale](../../references/axis-notes/text/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
