---
name: surface
description: Decision sheet for the surface axis — which value to pick for the corner radius, border, shadow, or background of a surface.
scope: `variant`/`radius` of a surface · `rounded-*`/`shadow-*`/`border` of an element
---

# SURFACE

## Scale — two tokenized values

| Value | Class | Meaning |
|---|---|---|
| `surface` *(default)* | `rounded-3xl bg-surface shadow-surface` | the **outermost** surface, lifted off the page background with a **shadow** |
| `nested` | `rounded-3xl border border-default` | a surface **nested** inside another surface — a border **replaces** the shadow, because shadow disappears in dark mode |

Border **xor** shadow. A box with both is a double-fill.

`radius` only exists on `.Nested`: `3xl` (24px, default) · `xl` (12px, tight contexts like a chat bubble). Base `--radius: 0.5rem`.

**Radius by role:** media → `2xl` · field → `xl` · pill → `full` · frame → `3xl`. `shadow-lg` is its own role — **floating**, a surface that sits ON TOP of other content (FAB, floating chip, panel over a canvas), not drift.

## Decision tree

| # | Ask | Result |
|---|---|---|
| 1 | Does a parent surface wrap **immediately, directly** around it? | no ⇒ `surface` · yes ⇒ #2 |
| 2 | Does the nested part occupy nearly the **whole body** of the parent surface? *(a PROPORTION test, not a location test)* | nearly all of it ⇒ the nested frame is **redundant**, drop it · a small part ⇒ `nested` |
| 3 | Are you rendering the **surface frame** itself or styling an **element** inside it? | frame ⇒ stop · element ⇒ #4 |
| 4 | media · field · pill · **ROW**? | `2xl` · `xl` · `full` · **no radius/border/shadow of its own** — a ROW reads from its parent frame |
| 5 | Adding a selection `ring`/`outline` onto a surface that already has `shadow-surface`? | **must** turn off the shadow at the same time (`!shadow-none`) |

## Four surface shapes

| Step | Shape | Recognize by |
|---|---|---|
| 1 | `bare` (ROW) | no border, no shadow, no radius of its own |
| 2 | `placeholder` | only a **dashed** border, no background, no shadow |
| 3 | `nested` | a **solid** border, no shadow |
| 4 | `surface` | its own shadow + background, no border |

## Pairs easily confused

| Pair | The deciding test |
|---|---|
| `bare` ↔ `placeholder` | a real data row ⇒ `bare` · an empty cell inviting you to add something new ⇒ `placeholder` |
| `placeholder` ↔ `nested` | real content inside ⇒ `nested` · empty, static, waiting to be clicked ⇒ `placeholder` |
| `nested` ↔ `surface` | a parent surface wraps it directly ⇒ `nested` · no parent ⇒ `surface` |

## Concentric formula — applies only to FIELD

`inner radius = outer radius − padding`. Check: `3xl` (24) − `cozy` (12) = 12 = `rounded-xl`, matches the real input exactly.

**Does not apply** to a nested surface frame (nested keeps `3xl` under its own rule) and **does not apply** to media (`CoverImage` is fixed at `2xl` regardless of padding). Three kinds of object, three different answers.

Reasoning and history: [rationale](../../references/axis-notes/surface/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
