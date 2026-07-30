---
name: icon
description: Decision sheet for the icon axis — whether something should have an icon at all, and if so what set/placement/size/weight/animation to pick when admitting a new entry. Does not answer icon↔text spacing (see `seam`), does not answer color (see `color`).
scope: icon set · placement · size · weight — four sub-scales, not one flat scale
---

# ICON

## Icon set — a constant, not a choice

| Set | Status |
|---|---|
| `@phosphor-icons/react` | **the only one** |
| any other set | forbidden |
| **HeroUI's self-drawn glyph when the `Indicator` slot is left empty** | forbidden — **a second icon set sneaking in through the back door**, with no `import` to grep for |

| Slot | What the vendor draws when left empty | Override |
|---|---|---|
| `Accordion`/`Select.Indicator` | draws a chevron itself | pass Phosphor as children. Rotating 180° **still works** — the animation hooks off `data-expanded` |
| `Checkbox.Indicator` | draws **two** different svgs for selected/indeterminate | **must be a FUNCTION** `children(state)` |
| `Radio.Indicator` | **draws no icon at all** — the dot is CSS | **do not override.** The round dot is geometry, not an icon |

## Placement — decides the size formula

| Placement | Meaning |
|---|---|
| `TEXT` | icon sits **bare** next to running text, no wrapping cell |
| `DIV` | icon sits **inside** a cell/control with its own rhythm (tab, button, chip) |

## Size — look it up by placement, do not guess

| Class | px | `TEXT` match *(font-size)* | `DIV` match *(line-height)* |
|---|---:|---|---|
| `size-3` | 12 | `text-xs` | not used |
| `size-3.5` | 14 | `text-sm` | not used |
| `size-4` | 16 | `text-base` | `text-xs` |
| `size-5` | 20 | not used | `text-sm` |
| `size-6` | 24 | not used | `text-base` |

## Weight — two notches

`< size-5` ⇒ `bold` (compensates for thin strokes) · `size-5` and up ⇒ `regular`.

| Size | `regular` | `bold` |
|---|:---:|:---:|
| `size-3` · `size-3.5` · `size-4` | too thin | correct |
| `size-5` · `size-6` | correct | too heavy |

## Decision tree

| # | Ask | Result |
|---|---|---|
| 1 | Decorating a **static fact already fully meaningful in text**? | → question 2 |
| 2 | Is it a **"universal"** symbol — instantly understood, no association needed? | no ⇒ **drop the icon, stop** |
| 3 | **Bare** next to text, or **inside a cell**? | `TEXT` looks up font-size · `DIV` looks up line-height |
| 4 | Size `< size-5`? | ⇒ `bold` · otherwise `regular` |

An icon inside an interactive `Button`/`Link` (search, refresh, play) is a **functional** icon — always keep it, go straight to question 3.

## Animation by meaning

| Meaning | Animation |
|---|---|
| **arrow** (CTA "See more →") | slides in its direction on hover |
| static navigational **caret** | **stays still** |
| open/close **chevron** | rotates 180° |
| **rotate**/refresh/retry | spins on click or while processing |

Reasoning and history: [rationale](../../references/axis-notes/icon/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
