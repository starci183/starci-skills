---
name: press
description: Decision sheet for the press axis — decide how pressing this thing responds when admitting a new entry into the library. Does not answer corner radius/border (see `surface`), does not answer color (see `color`).
scope: row · card · link · chip. BUTTON is OUTSIDE the scale — a button's press is drawn by the vendor itself.
---

# PRESS

## Scale — five steps, no sixth step

| Step | Mechanism | When |
|---|---|---|
| `none` | no press class at all | static, or a row/card without `onPress`/`href` |
| `fill` | `hover:bg-*` | **hover** — fills the background of the whole element, or a small round button inside it |
| `underline` | `group-hover:underline` | **hover** — underlines only the **text**, reads like a link |
| `scale` | `active:scale-[0.97]` native | **press** — the whole block sinks slightly |
| `ripple` | a circle grows from the press point | **press** — always paired with `scale`, but `scale` does **not** always come with `ripple` |

**BUTTON is outside the scale.** Not a single `active:`/ripple line exists in the button atom — press is drawn by the HeroUI vendor. Asking "what step is this button" is asking the wrong question.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Has a **real** `onPress`/`href`? | no ⇒ `none` |
| 2 | Is it a **BUTTON**? | outside the scale — stop |
| 3 | Is it a **CHIP**? | light `fill` on the round button itself — **never** `scale`/`ripple` |
| 4 | Is it a **ROW** (a flat row, **without** its own border/radius — the border belongs to the parent frame)? | `fill` or `underline` — **never** goes as far as `scale`/`ripple` |
| 5 | Is it a **CARD/TILE** (has its own border/radius/shadow, stands as a self-contained block)? | → 5a |
| 5a | Does the card have `actions` (stretched-link overlay)? | **always `scale`, no `ripple`** — regardless of `href` or `onPress` |
| 5b | No `actions`, has `href` (navigation)? | `underline` — reads like a LINK, **no** `scale`/`ripple` |
| 5c | No `actions`, has `onPress` (in-place action)? | `scale` **+** `ripple` |
| 6 | Is it a standalone **LINK**? | `underline` — no `fill`, no `scale` |

## Four adjacent pairs

| Pair | The deciding test |
|---|---|
| `none` ↔ `fill` | is there a real `onPress`/`href`? No ⇒ `none`, even if someone accidentally added `hover:bg-*` — **hover without a real interaction is fake hover and must be removed** |
| `fill` ↔ `underline` | remove the filled background — does it still read as **a pressable row** (icon/metadata beyond the title remain)? ⇒ `fill`. Pressable **only on the text line** ⇒ `underline` |
| `underline` ↔ `scale` | does it have its **own** border/radius/shadow, separable as a standalone block? no ⇒ `underline` · yes, and the destination is an in-place action ⇒ `scale` |
| `scale` ↔ `ripple` | a single card action ⇒ **they always go together**, it is not a choice between the two. A card with `actions` ⇒ `scale` only. Hesitating here means you are actually asking "single card or card with actions", not picking the wrong level |

Reasoning and history: [rationale](../../references/axis-notes/press/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
