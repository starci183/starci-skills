# TEXT — font size, weight, text color

> This axis answers exactly one question: **what size is this text, how bold, what
> color.** Two scales INTERSECT: `size` and `weight` — picking a size does not
> automatically get you the right weight, and a few render branches (icon, `isLink`,
> `size="code"`) **ignore weight entirely** even if you pass it.
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. SCALES

### 1a. SIZE — 10 real values, 3 render groups with different mechanisms
Read from `type TypographySize` in `Typography.tsx` (line 43). There is NO 11th value.

| Value | Render group | Real class/mechanism | Role tier (see 1c) |
|---|---|---|---|
| `xs` | body (class) | `text-xs` (12px) | D |
| `sm` | body (class) | `text-sm` (14px) | B (with `medium`) or C |
| `base` | body (class) | `text-base` (16px), **default when `size` is not declared** | C, or separately `isLink`/`isButton` |
| `lg` | body (class) | `text-lg` (18px) | A rarely stands alone — only 5 real call sites system-wide |
| `h1`/`h2` | heading (wraps `HeroTypography.Heading`) | almost NEVER used (1 use/type: page error code, skeleton) | — |
| `h3`/`h4`/`h5` | heading (wraps `HeroTypography.Heading`) | `level={3,4,5}` | A |
| `code` | wraps `HeroTypography type="code"` | — | belongs to no tier, `weight` is IGNORED (see §4.1) |

**LOCKED 2026-07-29 — `h6` does NOT exist in `TypographySize`** (`HEADING_LEVEL` in
`Typography.tsx` stops at `h5`, line 48) even though vendor HeroUI has `h6`
(`typography.styles.ts:39`) and the real `src` uses it (`CourseCard/index.tsx:285` is
`type="h6"`). Rule: when porting a real `h6`, ALWAYS drop it to the nearest step,
`size="h5"`, on the atom — do NOT add a separate `h6` step to the atom. Basis: a real
count in `src` — `h6` is used 8 times against `h5`'s 14 times, and all 8 play the same
role, "card title in a grid," as `h5` — not a distinct step (same rule already applied
to `InsetScale`: a step is only created when someone picks it because it is DIFFERENT,
not because the vendor happens to offer it). Decision anchor:
[`example.html`](example.html) §0, the "LOCKED" block.

### 1b. WEIGHT — 4 effective values (the type only declares 3; the 4th value is NOT declaring it)
`weight?: "medium" | "semibold" | "bold"` (`Typography.tsx` line 178). The 4th step
is **not passing the prop** (regular/normal) — it is not in the union but is a real
state with its own render.

| Value | Meaning | Real application |
|---|---|---|
| *(not declared)* | regular — long-form prose | default for every group |
| `medium` | WORKING emphasis — labels, names, body-sized values | body + heading + isButton |
| `semibold` | BLOCK-LEVEL heading — modal header, total amount, verdict | ONLY has a distinct meaning at heading scale; at body scale it **FOLDS to `medium`** |
| `bold` | heading/display/large figures | ONLY pairs with heading; **NEVER** at `body-sm`/`body-xs` |

### 1c. Role tiers (apply the decision tree in §2) + the named exception
| Tier | size×weight | Use when |
|---|---|---|
| **A** | `h3`-`h5` (nearest step for a real `h6`) **always `bold`** | stands ALONE as the focal point of a block/card/grid |
| **B** | `sm` + `medium` | 1 ROW in a dense list/table, never standing alone |
| **C** | `sm`/`base`, regular, usually `color="muted"` | descriptive sentence/paragraph under a title |
| **D** | `xs`, regular | meta/secondary label: timestamp, layer-2 caption, struck-through price |
| **Exception (not a 5th tier)** | `base` + `weight="semibold"`, NEVER `h*` | Modal title — its own rule, most easily confused with Tier A |

### 1d. Color (secondary scale, the "what color" part of the axis question)
`color?: "default" | "muted" | "accent" | "success" | "warning" | "danger"`.
`default`/`muted` are the 2 BASELINE levels of text (§9a — not declaring = `default`);
the other 4 semantic colors belong to the STATE axis, owned by the separate `color/`
axis (not yet built) — the `text` axis owns only default/muted.

---

## 2. DECISION TREE — 5 steps to pick the TIER, then 3 steps to gate weight

**Step A — pick the tier/size** (canon [`principles/text/rationale.md`](../text/rationale.md) §2, locked by the teacher 2026-07-29):
1. Is this a **Modal title**? → **Exception** (`base` + `semibold`), stop.
2. Stands ALONE as the focal point of a block/card/grid? → **Tier A**.
3. 1 row in a dense list/table? → **Tier B**.
4. A descriptive sentence/paragraph? → **Tier C**.
5. Everything else (label/timestamp/secondary price/caption) → **Tier D**.

**Step B — does weight actually render as chosen?** The tier is only a default; the
following 3 questions can BREAK it with NO error reported (see the evidence in §4):
1. Does this text have `prefixIcon`/`suffixIcon`? → YES ⇒ weight is hard-forced to
   `font-medium`, ANY other `weight` you pass in has no effect.
2. Is this text `isLink`? → YES ⇒ `weight` is never read, it always renders
   `HeroLink`'s default weight.
3. Is `size` `"code"`? → YES ⇒ `weight` is never read, no weight class is applied at
   all.

None of the 3 questions above apply → the tier's weight from Step A renders exactly
as in the §1c table.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Passing `size`/`weight` outside the literal union | `tsc` — `TypographySize` + `weight` are unions |
| 2 | Scattering `text-*`/`font-*` classNames when `Typography` can express it via a prop | **NOT YET — gate needs to be written**: scan every `className=` on JSX rendering `<Typography`/`<span data-anat-part="Text"` containing `text-(xs|sm|base|lg|muted|foreground)`/`font-(medium|bold|semibold)` |
| 3 | Wrong token `text-muted-foreground`/`text-default`/redundant `color="default"` on `Typography` | **NOT YET — gate needs to be written** |
| 4 | Old-style namespace `Typography.Xs`/`.Sm`/`.H3` (merged 2026-07-25) | `check-no-namespace.mjs` |
| 5 | `size="code"` or `isLink` combined with `weight` (has no effect, see §3c/§4.1-4.2) | **NOT YET — gate needs to be written**: scan for call sites that have both `size="code"`/`isLink` and `weight=` |
| 6 | Bumping `size` up on your own compared to the real `src` ("to make the card stand out more") | cannot be gated — discipline, must cross-check `src` line by line (§4.5) |
| 7 | `weight="bold"` next to `prefixIcon`/`suffixIcon` expecting it to render bold | cannot be gated — this is correct atom design, only a documentation warning (§4.3) |
| 8 | Declaring done after only checking the role table, without reading the correct LINE of `src` (confusing an ordinal-number line with a name line) | cannot be gated — discipline, re-read the correct line before quoting |

---
# PART B · LOOK UP WHEN DRIFT IS FOUND — only open when Part A returns a drift result
---

## 3. EXHAUSTING THE EASY-TO-CONFUSE CASES

### 3a. Four tiers ⇒ `C(4,2) = 6` pairs — exhaust them by distance on the A-B-C-D scale

**One step apart (3 pairs, the main battle):**

| Pair | THE DECIDING TEST |
|---|---|
| `A ↔ B` | Can this text stand ALONE, or does it ALWAYS appear alongside N similar rows? Standalone ⇒ A. Always 1 row in a list ⇒ B. |
| `B ↔ C` | Is this text the NAME/LABEL of an entity, or a flowing DESCRIPTIVE sentence? A short name/label, more prominent than the surrounding line ⇒ B (`medium`). Long prose, a secondary voice ⇒ C (regular + usually muted). |
| `C ↔ D` | Delete this line — does the rest LOSE ITS MAIN POINT, or just a minor detail? Loses the main point (description) ⇒ C. Only loses meta (time, secondary label) ⇒ D. |

**2 or more steps apart (3 pairs: `A ↔ C`, `B ↔ D`, `A ↔ D`):** Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

### 3b. Four weight values ⇒ `C(4,2) = 6` pairs — exhaust them by distance on the regular-medium-semibold-bold scale

**One step apart (3 pairs):**

| Pair | Deciding test |
|---|---|
| `regular ↔ medium` | Is this text a LABEL/NAME that needs to stand out from its surroundings (Tier B), or just prose/meta (Tier C/D)? Stands out ⇒ `medium`. Doesn't ⇒ don't declare it. |
| `medium ↔ semibold` | Is this at HEADING scale (`h3`-`h5`) or BODY scale? At BODY scale, `semibold` folds to `medium` — these two values render IDENTICALLY at body scale, so don't hesitate, write `medium` for clarity. At HEADING scale, the two values genuinely differ — `semibold` is the Modal-header/block-level-verdict exception, `medium` is almost never used at heading scale. |
| `semibold ↔ bold` | Is this Tier A (standing alone as the focal point)? YES ⇒ `bold`. Is this a Modal title/verdict/total amount? YES ⇒ `semibold`, never `bold`. |

**2 or more steps apart (3 pairs: `regular ↔ semibold`, `medium ↔ bold`, `regular ↔ bold`):** Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

### 3c. size×weight COMBINATIONS — a DIFFERENT exhaustion criterion (not an ordered scale): list out EVERY RENDER BRANCH × every weight value
`Typography.tsx` has exactly **6 render branches** that read/don't read `weight`
differently (skeleton is skipped since it has no `text`). 6 branches × 4 weight values
= 24 cells; stop exhausting once all 24 are covered:

| Render branch | regular | `medium` | `semibold` | `bold` |
|---|---|---|---|---|
| **body, no icon, not link/button** | not bold | `font-medium` | FOLD → renders identically to `medium` | `font-bold` |
| **body, WITH `prefixIcon`/`suffixIcon`** | no effect — forced to `font-medium` | no effect (same forced value) | no effect | **no effect — even `bold` is downgraded to `medium`, with no error reported** |
| **`isLink`** | the `weight` prop is never read in this branch — it renders `HeroLink`'s default weight regardless of what's passed | | | |
| **`isButton`** | not bold | `font-medium` | FOLD → `font-medium` (same as regular body) | `font-bold` |
| **heading (`h1`-`h5`)** | HeroUI's default for that `type` (the atom does not set it itself) | 3 REAL distinct steps, no fold | | |
| **`size="code"`** | | the `weight` prop is never read in this branch | | |

Reading the table: **the FORBIDDEN cells that matter** (the 2 cells at body+icon and
at `isLink`/`code`) are not compile errors — the code accepts any value and silently
ignores it. This is exactly the trap in §4.

---

## 4. STRUCTURAL TRAPS — backed by real evidence, not a wrong value choice

1. **`weight` is read by no one at `size="code"`.** The code branch
   (`Typography.tsx` lines 338-354) does not read `weight` inside `cn(...)` —
   passing `weight="bold"` together with `size="code"` errors on nothing and bolds
   nothing. Anchor: `INLINE_CODE_CLS` (line 146) likewise has no bold token.
2. **`weight` is read by no one at `isLink`.** The `isLink` branch (lines 372-391)
   builds its className only from `TEXT_CLS`/`COLOR_CLS`/underline — no branch reads
   `weight`. A "bold" link has to be decided some other way (not the `weight` prop) —
   not a bug, but easy to mistake for one when weight "disappears."
3. **Having an icon → the passed-in `weight` gets OVERRIDDEN, with no warning.**
   Lines 417-423: `hasIcons ? "font-medium" : (fold per weight)`. This is CORRECT BY
   DESIGN (the inline comment says: "icon strokes fit medium text") but it's a real
   trap if the code author expects `weight="bold"` to render bold next to an icon —
   it always comes out `medium`.
4. **`semibold` at body scale used to have a completely SILENT BUG** (patched
   2026-07-29, see §1b/§3c of this document) — 2 body-scale render branches used to
   drop `weight === "semibold"` into `null` (LOSING bold entirely) instead of folding
   to `medium`, silently wrong across 7 files/9 call sites before being caught through
   a single piece of feedback. Lesson: after FIXING the fold logic, you still have to
   grep every `weight="semibold"` call site at body scale to make sure no third
   branch was missed by the fold.
5. **"Big and bold" ⇒ instinct picks heading, but a Modal header is NEVER a
   heading.** Anchor: `PaymentModal/index.tsx:460`, `CookieConsentModal/index.tsx:45`
   — both `type="body"` + `semibold`. All 5/5 real errors logged in the canon on
   2026-07-29 (`MilestoneUpNextCard`, `EnrollGate`, `LeaderboardBoard`,
   `ContentPaywall`, `VoiceHero`) were BUMPING size up on their own compared to `src`,
   none went the other way and under-sized — a systematic bias; be suspicious of
   yourself whenever you're about to pick a bigger size.
6. **A bare `text-xl font-semibold` in `src` = `h4` (20px heading), NOT `lg` body
   (18px)** — 2 different scales, easy to confuse because both are "bigger than sm."
   Anchor: `EnrollGate` (a real `type="h4"`), `ContentPaywall` (`text-xl
   font-semibold` written bare, not going through Typography).
7. **Vendor CSS silently overrides `weight` when the atom doesn't declare an
   explicit class itself.** Anchor 2026-07-30 (`ChallengePage/Graded`, round-1):
   HeroUI's `.accordion__trigger { font-medium }` bled into a line of text that
   should have been `font-normal`, because the old `weightCls` branch returned
   `null` when there was no `weight`/icon — a missing class means NOTHING blocks the
   parent library's CSS from winning. Fixed at
   `atoms/text/Typography/Typography.tsx:448-450`: `weightCls` now ALWAYS produces
   one of four concrete classes (`font-medium`/`font-bold`/`font-normal`), never
   `null`/empty — see the inline comment at lines 444-450. General rule: **an atom
   that wraps a vendor must ALWAYS emit an explicit class for every value it owns;
   "the default value" must never mean silence/inheritance** — silence is the gap
   through which `.accordion__*`/`.progress-bar` or any parent library class leaks
   in.

---

## 5. REAL ANCHORS — priority order when two sources conflict

1. **The role table → real HeroUI `type`**, distilled from ~70 real `src` files (see
   §1c of this document) — highest priority when porting one specific line of text.
2. **The 4-tier decision tree + the Modal exception** (§2 Step A of this page) — use
   when there is no specific `src` to check against, or when you need to CLASSIFY a
   new piece of text that has never existed in `src`.
3. **Outside-industry research** (Dropbox mobile cut its hierarchy from 5→3 steps,
   +17% conversion) — this is ONLY a reason to ORGANIZE the real data into 4 tiers,
   NOT a source for adding new cases beyond the data already distilled.

Specific anchors for each branch: [`example.html`](example.html).
