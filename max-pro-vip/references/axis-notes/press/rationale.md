# PRESS — how pressing this thing makes it respond

> This axis answers exactly one question: **how pressing this thing makes it respond.**
> It does not answer corner radius/border (see `surface/`), it does not answer accent color
> (see `color/`). Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — five steps, there is no sixth step

| Step | Real CSS mechanism | When | Anchor |
|---|---|---|---|
| `none` | no press class at all | a static element, or a row/card without `onPress`/`href` | — |
| `fill` | `hover:bg-default` / `hover:bg-surface-secondary` / `hover:bg-current/15` | **hover**, fills either the whole element or a small round button inside it | `List.tsx:161-162`, `SurfaceCard.tsx:1141`, `ChipBase.tsx:242` |
| `underline` | `group-hover:underline` / `hover:underline` (via `Typography`) | **hover**, underlines only the TEXT — reads like a link | `SurfaceCard.tsx:596,1385`, `Typography.tsx:129,138` |
| `scale` | `active:scale-[0.97]` (native `:active`) | **press**, the whole block dips slightly | `SurfaceCard.tsx:394,440` |
| `ripple` | a `framer-motion` circle growing from the press point, `scale 0→2` + fade | **press**, ALWAYS pairs with `scale` — but `scale` does NOT ALWAYS pair with `ripple` (see §3, last pair) | `SurfaceCard.tsx:331,403` |

**BUTTONS (`Button`/`ButtonBase`) ARE OUTSIDE THIS SCALE** — not a single `active:`/ripple
line exists in `ButtonBase.tsx` or `button-tokens.ts` (grepped, 0 results). A button's press
feedback is drawn internally by **HeroUI vendor code** (`data-[pressed]`); the house atom adds
nothing, removes nothing. Asking "what step is this button at" is asking the wrong question —
the SSOT for this scale is the four remaining element types: `row · card · link · chip`.

---

## 2. DECISION TREE — ask top to bottom, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does the element have a real `onPress`/`href` (real interaction, not a hand-rolled `cursor-pointer`)? | NO ⇒ `none` |
| 2 | Is it a **BUTTON** (`ButtonBase`, has `@heroui/react` `Button` inside)? | OUTSIDE THE SCALE — stop, see §1 |
| 3 | Is it a **CHIP** (a small token, a round dismiss/action button `size-4`/`size-6` living INSIDE it)? | light `fill` on that round button itself — NEVER `scale`/`ripple` |
| 4 | Is it a **ROW** (a flat row in a list/nav, with NO border/radius of its own — any border belongs to the PARENT frame)? | choose `fill` (fills the whole row, prop `hover="fill"`) or `underline` (underlines only the title, prop `hover="underline"`) — NEVER go to `scale`/`ripple` |
| 5 | Is it a **CARD/TILE** (has its own border/radius/shadow, stands as ONE self-contained block)? | go to question 5a |
| 5a | Does the card have `actions` (secondary controls, a stretched-link overlay)? | ALWAYS `scale`, NEVER `ripple` — regardless of `href` or `onPress` (see trap 2) |
| 5b | Card has NO `actions`, has `href` (navigation)? | `underline` via `group-hover` on the text — reads like a LINK, NEVER `scale`/`ripple` |
| 5c | Card has NO `actions`, has `onPress` (an in-place action, not navigation)? | `scale` **+** `ripple` — the highest step, the only response when the resting hover state does nothing |
| 6 | Is it a standalone **LINK** (not a row/card — a piece of text/CTA like "See more")? | `underline` (self-hover or group-hover depending on context), NO `fill`, NO `scale` |

**Before trusting the tree: if the component has real `src`, MEASURE that source.** The tree
is only the fallback. See §5.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | A ROW or an element with no border/radius of its own using `active:scale`/ripple | cannot be gated — discipline (§7b) |
| 2 | A pressable card carrying `hover:bg-*` at its resting state (unless it is on the `underline`-link branch) | cannot be gated — discipline |
| 3 | Hand-rolling `<div cursor-pointer>` for a pressable card/row instead of a native `<button>`/`<a>` | cannot be gated — discipline (a11y) |
| 4 | Using react-aria `data-[pressed]` instead of native `:active` for a hand-written card/row | cannot be gated — discipline |
| 5 | Using `transition-all`/`transition-transform` for the scale effect instead of listing `transition-[scale]` exactly (Tailwind v4: `scale` is its own property, not listing it ⇒ jank) | cannot be gated — discipline |
| 6 | A value outside the `hover?: "fill" \| "underline"` union of `SurfaceCardListItem` | `tsc` — union literal |
| 7 | Manually adding `active:scale`/ripple to `ButtonBase` (overriding HeroUI's vendor press) | cannot be gated — discipline |

---
# PART B · LOOK UP WHEN DRIFT IS ALREADY SEEN — only open when Part A produces a drifted result
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — all 10 pairs

A 5-step scale (`none · fill · underline · scale · ripple`, in the exact order from §1) ⇒
`C(5,2) = 10` pairs.

### 3a. Four ADJACENT pairs — the main battle

| Pair | The deciding test |
|---|---|
| **`none` ↔ `fill`** | Does the element have a REAL `onPress`/`href`? No ⇒ `none`, even if someone accidentally added `hover:bg-*` (hover without real interaction is fake hover and must be removed). Yes, and it is a ROW or a CHIP's dismiss button ⇒ `fill`. |
| **`fill` ↔ `underline`** | Strip the background fill away — does the element still read as ONE pressable ROW (there's a leading icon/meta outside the title, and the pressable boundary needs to be clearly marked)? ⇒ `fill`. Is the pressable area ONLY the text LINE, reading like a phrase that leads elsewhere? ⇒ `underline`. |
| **`underline` ↔ `scale`** | Does the element have its OWN border/radius/shadow, separable from the list as an independent block? NO (it's just a flat row or a piece of text) ⇒ `underline`. YES, and the destination is an IN-PLACE ACTION (`onPress`, no navigation, no secondary `actions`) ⇒ `scale`. |
| **`scale` ↔ `ripple`** | A SINGLE card action (no secondary `actions`) ⇒ these two steps ALWAYS travel together, it is not a choice between the two. A card WITH `actions` (stretched-link overlay) ⇒ `scale` ONLY, ripple is dropped entirely (`SurfaceCard.tsx:429-462` never calls `<Ripple>`) — hesitating on this pair means you're actually asking "is this a plain card or a card with secondary actions", not picking the wrong level. |

### 3b. Three pairs ONE STEP APART

| Pair | How to read it |
|---|---|
| `none` ↔ `underline` | Hesitating here means question 1 of the tree — "does this element have real interaction" — has not been answered yet. Go back to it. |
| `fill` ↔ `scale` | Almost always confusing a ROW with a CARD. A ROW never stands alone as a detached block — it always lives inside a parent frame that already owns the border/radius. |
| `underline` ↔ `ripple` | Comparing a LINK/ROW-link with a full CARD-action — these are not the same kind of element. Redraw questions 4-5 of the tree first. |

### 3c. Three pairs ≥2 STEPS APART — deliberately no test

`none`↔`scale` · `fill`↔`ripple` · `none`↔`ripple`. Pairs 2 or more steps apart: hesitating
there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule
3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — the right kind of element picked, but still wrong

1. **A card with `actions` erases the LINK/ACTION boundary.** The plain branch (`!actions`)
   clearly distinguishes `href` (link, `underline`, no scale) from `onPress` (action,
   `scale`+`ripple`) — but the `actions` branch (stretched-link overlay,
   `SurfaceCard.tsx:423-463`) applies `scale` to BOTH, never checking `isLink`. A navigational
   card (`href`) that also has a secondary button (`actions`) will suddenly dip on press even
   though it's still a link — this is a REAL fact in the code, not a deduction, and it's the
   reason the `scale`↔`ripple` pair in §3a has no clean deciding test.
2. **Inferring ROW as CARD because it sits inside a bordered/rounded frame.**
   `SurfaceCard.Nested`'s `NestedSection` (`SurfaceCard.tsx:582-637`) has no border/radius of
   its own — the `rounded-3xl`/`border` belongs to the PARENT (`Nested`), and the row itself
   only has `p-3` + `divide-y` at the outer frame. Applying `scale` to it because "it's inside
   a card" confuses the PARENT frame with the element itself.
3. **Ripple does not always pair with scale (the reverse always holds).** Reading the code and
   assuming "if `active:scale-[0.97]` is there, ripple must be somewhere too" is wrong on the
   `actions` branch (trap 1). Always confirm a real `<Ripple>` is being rendered, never infer
   it from the presence of scale.
4. **Hand-rolling press for a row/card instead of composing an existing frame.**
   `<div cursor-pointer>` breaks a11y (no focus/keyboard); a card/row wrapping a BARE `<a>`/
   `<button>` is missing the correct set of scale+transition+no-hover+ripple. The owner of the
   mechanism is the PRIMITIVE (`SurfaceCard.Base`, `List.Row`) — the consumer composes it, it
   does not redraw it.

---

## 5. REAL ANCHOR — priority order when two sources clash

1. **The real `src` of the exact component being edited** — MEASURE it first.
2. Decision tree §2 — only when (1) does not exist.
3. Canon [`principles/press/rationale.md`](../press/rationale.md) (formerly `principles.md`
   §7/§7a/§7b) — **REFERENCE ONLY, partially OUTDATED.** §7 (locked in 2026-07-22/23) states
   "a pressable CARD is ALWAYS `active:scale-[0.97]`+ripple, no hover" for every card; item 6b
   (**2026-07-29**, NEWER than §7) split `href` out: a card+`href` (no `actions`) is
   `underline`, not `scale`/`ripple`. This axis follows the NEWER version + the real code
   (`SurfaceCard.tsx:384`). Specific anchor: [`example.html`](example.html) §6.
