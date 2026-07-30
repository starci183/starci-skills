# COLOR — is this element allowed accent/semantic color, or does it stay default

> This axis answers exactly one question: **which of the 6 color steps does this
> text/icon belong to, or does it get no color at all.** It does not answer font size
> (see `text/`), and it does not answer overall prominence muted→chip→button (that is
> §2 [`principles/prominence/rationale.md`](../prominence/rationale.md), a BROADER axis —
> this axis only scopes to ONE prop, `color`, on `Typography`/`Alert`/`Chip`).
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. SCALE — six values, there is no seventh value

| Value | Real class | Meaning |
|---|---|---|
| `default` | *(not declared — `null` in `COLOR_CLS`)* | PRIMARY text: heading, value, body copy, figures that CARRY real information value |
| `muted` | `text-muted` | SECONDARY text: hint/description/caption/meta/label-of-a-value/timestamp/standalone trivia |
| `accent` | `text-accent` | BRAND/INTERACTION signal: link, "mine", active — does NOT report a data state |
| `success` | `text-success` (soft token: `text-success-soft-foreground`) | CORRECT/complete/positive state |
| `warning` | `text-warning` (soft: `text-warning-soft-foreground`) | NEEDS ATTENTION/approaching-threshold state |
| `danger` | `text-danger` (soft: `text-danger-soft-foreground`) | ERROR/delete/irreversible state |

The scale's SSOT: `TypographyColor` in `.storybook/components/atoms/text/Typography/Typography.tsx:33`
(`"default" | "muted" | "accent" | "success" | "warning" | "danger"`), mapped to the real
class in `COLOR_CLS`, same file, lines 78-85. Two other atoms repeat EXACTLY 5 of the 6
values (skipping `muted`, since they are themselves already colored blocks and need no
extra dimming): `AlertStatus` (`Alert.tsx:43`, names the neutral branch `"default"`) and
`ChipTone` (`ChipBase.tsx:48`, names the NEUTRAL BRANCH `"neutral"` — different word,
same meaning, see trap #3). Writing a color class by hand (`text-[#ff0000]`,
`style={{color}}`) outside the `color` prop is a structural error, not a compile error
— see §6.

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Is this text/icon REPORTING a REAL DATA STATE — if the data changes, the color **MUST** change with it (not just because the builder felt like coloring it)? | go to question 1a |
| 1a | What is that state: already CORRECT/complete · NEEDS ATTENTION/approaching a threshold · or ERROR/irreversible? | `success` · `warning` · `danger` respectively |
| 2 | (If NOT 1) Does this text/icon carry a BRAND/INTERACTION signal — link, "mine", selected/active — that is **not** tied to a data outcome? | `accent` |
| 3 | (If NOT 2) Is this text SECONDARY — hint/description/caption/meta/label-of-a-value/timestamp, or a standalone TRIVIA figure not attached to any control (§9a.1 layer 2)? | `muted` |
| 4 | Everything else — the row's PRIMARY text, or a figure that CARRIES real information value + is STRUCTURALLY ATTACHED to an active control (§9a.1 layer 1) | `default` — do not declare `color` |

**Before trusting the tree: if a figure sits next to a control/action, it MUST pass
both layers of §9a.1** (does it carry real information value? + is it structurally
attached to an active control?) — you may NOT collapse this into a single question like
"is this the reason the reader looks at the row." See trap #1.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing a color class by hand (`text-danger`, `text-[#hex]`, `style={{color}}`) on `Typography`/`Alert`/`Chip` when the `color`/`tone`/`status` prop can express it | **NOT YET — gate needs to be written** (no `check-color.mjs`; scan `.storybook/components/**` for `text-(muted|accent|danger|success|warning)` OUTSIDE the `Typography.tsx`/`ChipBase.tsx`/`Alert.tsx` files themselves) |
| 2 | A `color` value outside the 6 scale values, passed through the prop | `tsc` — `TypographyColor`/`AlertStatus`/`ChipTone` are literal unions |
| 3 | A color value outside the scale written DIRECTLY as a className (bypassing the prop entirely) | NOT YET — `tsc` cannot catch this because it never passes through the type; a gate that scans className by hand is needed |
| 4 | Inventing a narrower color enum (e.g. a private `"ok"|"error"`) instead of reusing `AlertStatus`/`TypographyColor` | cannot be gated — discipline (§5a.3) |
| 5 | Forcing a TIER (≥4 continuous steps) into the 3 status tokens, making two steps collide on the same color | NOT YET — gate needs to be written: scan for props that accept an enum with >3 values but map directly into `AlertStatus`/`COLOR_CLS` |
| 6 | A status-bearing icon hard-locked to color by a different context (label/parent) instead of its own `AlertStatus` | cannot be gated — discipline (§5a.3), requires reading the icon's semantics |
| 7 | Multiple highlight points at once within one region (accent-flood, §2c) | cannot be gated — discipline, aesthetic judgment by region |
| 8 | Copying color from `src` when `src` matches an OLD deciding test that has since been overturned (§9a.1) | cannot be gated — discipline, must re-verify with the two-layer question every time, do not trust `src` by default |

**Missing gates (#1/#3/#5), description to write:** scan every `className`/literal
string in `.storybook/components/**` (excluding the 3 SSOT files `Typography.tsx`/
`ChipBase.tsx`/`Alert.tsx`) matching `text-(muted|accent|danger|success|warning)
(-soft-foreground)?` or `bg-(accent|danger|success|warning)-soft`, flag it red —
because these tokens can ONLY be generated by the 3 maps
(`COLOR_CLS`/`TONE_COLOR`/`STATUS_TINT`), never written by hand at the call site.

---
# PART B · LOOK UP WHEN DRIFT IS FOUND — only open when Part A returns a drift result
---

## 3. EXHAUSTING THE EASY-TO-CONFUSE CASES — all 15 pairs

A 6-value scale ⇒ `C(6,2) = 15` pairs. The order used to group them (not an absolute
intensity scale, but distance within the TREE in §2): `muted → default → accent →
success → warning → danger` (most recessive → most alarming, following the exact
order of the tree's 4 questions).

### 3a. Five ADJACENT pairs — this is the entire battle

| Pair | THE DECIDING TEST | Anchor |
|---|---|---|
| **`muted` ↔ `default`** | Apply both layers of §9a.1: is the figure/text structurally ATTACHED to an active control **and** does it carry real INFORMATION VALUE? Both true ⇒ `default` (inherits the control's weight). Standalone + trivia ⇒ `muted`. | `ReactionButton.tsx:182` (default, "128" attached to a control) ↔ `ContentReaction.tsx:84` (muted, "views" standalone) |
| **`default` ↔ `accent`** | Is this element CLICKABLE/an active-selected state (`isLink`, "mine") that does not reflect a data outcome? YES ⇒ `accent`. Just ordinary body copy, even if it's a heading or a value ⇒ `default`. | `Typography.tsx:381` (`isLink` defaults to `text-accent` when `color` is not declared) |
| **`accent` ↔ `success`** | If the data changes (failure instead of success), MUST the color change with it? YES ⇒ `success` (it is reporting a real outcome). NO, it always keeps this color regardless of the result ⇒ `accent`. | `ContentCommentThread.tsx:265` (accent, "show replies" toggle) ↔ `ContentHeader.tsx:158,197` (success, tone/leadingIconColor) |
| **`success` ↔ `warning`** | Is the state already COMPLETE/fully correct, or still APPROACHING a threshold that needs early attention? Complete ⇒ `success`. Still time/needs attention ⇒ `warning`. | [`principles/prominence/rationale.md`](../prominence/rationale.md) §4 (trap 4) — `ContinueCard.timeLeft` escalates tone `neutral→warning` when urgent, it does NOT jump to a different element/color |
| **`warning` ↔ `danger`** | Has the consequence already HAPPENED/is it irreversible, or is there still a CHANCE to act before it becomes an error? Already happened ⇒ `danger`. Still a chance ⇒ `warning`. | `Alert.tsx` `STATUS_ICON`: `warning`→`WarningIcon` (triangle, still a warning) is entirely distinct from `danger`→`XCircleIcon` (already wrong) |

### 3b. Four pairs ONE STEP APART · 3c. Six pairs ≥2 STEPS APART — deliberately no deciding test

Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of the value chosen, but because the structure was misread

1. **Collapsing the two question layers into one "secondary" bucket — the canon
   OVERTURNED ITSELF (2026-07-29).** The old test only asked "is this figure the
   REASON someone looks at the row, or just a secondary event riding along with
   another action" — this single-layer formula WRONGLY lumped the react-count ("128",
   carrying social-proof value + attached to a control) and the view-count (trivia,
   standalone) into the SAME "secondary" bucket, because both "sit next to an
   icon/action." Lesson: you may NOT collapse the two layers of §9a.1 into one
   question, "next to an action → muted"; you must ask SEPARATELY "does it carry real
   information value" and "is it structurally attached to an active control" —
   missing either question is wrong. Anchor:
   [`principles/color/rationale.md`](../color/rationale.md) §2, `color-system.html` item 2
   (marked WRONG) vs item 2b (the correct test).
2. **A TIER (continuous range) wrongly forced into the 3 status tokens.**
   `DifficultyChip.tsx` (`DIFFICULTY_COLOR`) deliberately does NOT use
   `success/warning/danger` for its 4 difficulty steps — because forcing them into
   just 3 tokens would make `advanced` and `insane` collide on `danger`, losing the
   distinction. Tiers use their own Tailwind range (`emerald→amber→orange→rose`).
   Tell: a scale with **≥4 continuous ORDERED steps** (not a binary/ternary state) is
   a TIER, and does not go through this axis's 6-value scale.
3. **`neutral` (Chip) and `default` (Alert/Typography) are the SAME concept of
   "no color," just a different NAME.** Misreading the structure makes it easy to
   think `ChipTone` is missing a `default` value (a missing branch) or that the two
   unions conflict — actually these are 2 SEPARATE types belonging to 2 components;
   `ChipBase` maps `neutral → "default"` internally (`TONE_COLOR`,
   `ChipBase.tsx:51-57`) because it follows the chip's own "neutral" naming
   convention, not an inconsistency that needs unifying.
4. **A hover color change does NOT mean the element's REAL color changed.**
   `src/CommentItem.tsx:165` — the delete-comment button is `text-muted` at rest, and
   only CHANGES to `hover:text-danger-soft-foreground` on mouse-over. Structural
   misreading: assuming this button is "danger-colored" and hardcoding
   `color="danger"` — wrong, because the action has not happened yet; `danger` here
   is only a PREVIEW on hover, not an existing data state (different from what
   question 1a is asking).
5. **A status-bearing icon defaulted to "match the label's color"** instead of going
   through `AlertStatus`. Real bug anchor: `SurfaceCard.leadingIcon` (the
   `ContentHeader` outcomes list) was hard-locked to the label's color → the
   checkmark rendered black instead of green; fixed with a dedicated
   `leadingIconColor?: AlertStatus` prop
   ([`principles/icon/rationale.md`](../icon/rationale.md) §2c).
6. **`color` was read as `color ? COLOR_CLS[color] : null` — the vendor wins when the
   caller doesn't pass `color`.** Anchor 2026-07-30 (`ChallengePage/Graded`):
   HeroUI's `.accordion__body-inner { color: var(--muted) }` bled into text that
   should have been `text-default`, because the read branch skipped
   `COLOR_CLS["default"]` whenever the `color` prop wasn't passed. Fixed at
   `atoms/text/Typography/Typography.tsx:95` (comment "round-6") + lines 345/364/426:
   EVERY branch now reads `COLOR_CLS[color ?? "default"]`, and the
   `color ? … : null` branch is gone. Same general rule as `text/rationale.md` §4.7: an
   atom that wraps a vendor must emit an explicit class for **the default value**
   just as much as for a passed value — "not passed" must never be treated as
   "no class needed."
6. **Each individual value is LOCALLY correct but the WHOLE REGION has too many
   highlight points (accent-flood, §2c).** Anchor: `CourseCard` 2026-07-22 — 3 green
   checkmarks + a green −55% chip + a pink CTA = 4-5 highlight points at once; no
   single point picked the wrong value, but the whole cluster loses its "stands out"
   effect. This trap cannot be fixed with the §2 tree (the tree only decides one spot
   at a time); you have to look at the WHOLE REGION.

---

## 5. REAL ANCHORS — priority order when two sources conflict

1. **SEMANTIC rules already locked into the canon** (§9a/§9a.1, §2c "accent ≠
   status", §5a.3 "reuse `AlertStatus`, don't invent a narrower enum") — color on
   this axis encodes business MEANING (whether it's a real state or not), not a
   geometric measurement you can copy from a neighbor, so semantic rules WIN even
   over `src`.
2. **The real type definition** (`TypographyColor`/`AlertStatus`/`ChipTone`) bounds
   the valid VALUE scale — do not add a new parallel tone on your own.
3. **The real `src`** — use it only to learn the original CONTEXT (what control this
   used to be), do NOT copy its class verbatim if it falls exactly into a deciding
   test that has since been OVERTURNED. Anchor: `ReactionButton` — `src`
   (`ReactionBar.tsx:60,79`) is `muted`+`xs` for both the button and the number, but
   the teacher ruled **"src doesn't matter"** in this case and changed it entirely
   per the two-layer test in §9a.1 (the "128" figure drops `muted`).
4. **Outside-industry examples** — not used on this axis; semantic color is a
   business decision unique to this system, not something to reference from other
   industries.

Specific anchors for each branch: [`example.html`](example.html).
