# READING-FLOW — which edge text and blocks align to, which line they read along

> The origin is `principles.md` §3 **the HISTORICAL version**
> (`git show 34006466b:.claude/fe/principles.md` lines 146-161), where it self-labeled
> `DRAFT — awaiting the teacher's lock`. The old anchor "principles.md lines 146-161"
> is now DEAD: that file was dissolved on 2026-07-29 into an 82-line redirect map, and
> §3's content no longer lives there — this is exactly the "canon quoting the WRONG
> anchor" pattern to stay alert for, except here the dead anchor sits IN the very
> sentence that cites this axis's own origin.
>
> Re-checked question by question on 2026-07-29: **3 of the 4 old open questions have
> now closed themselves** via direct rules/code measurement (see §1, §5) — DRAFT does
> not mean EVERY question on this axis needs the teacher. Exactly **1** question is
> still genuinely open: the "single-button confirmation modal" exception (see §5,
> example.html) — because there is NO live component to measure, not because of a
> lack of effort reading the code.
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. SCALE — TWO separate scales, do not merge

This axis is made of **two perpendicular axes**, often typed into each other by
mistake because both have a "center" step:

### Scale A — TEXT-ALIGN: aligning TEXT within its own text box
3 steps, matching `TypographyAlign` (`Typography.tsx:107-113`) + `TableAlign`
(`Table.tsx:33`, has only 2/3 steps):

| Step | Class | Prop |
|---|---|---|
| `start` | `text-start` | default — leaving the `align` prop empty = no class is set, follows the parent flow |
| `center` | `text-center` | `align="center"` |
| `end` | `text-end` | `align="end"` (Table only has `start`\|`end`, no `center` — numbers/actions are never centered) |

**Vocabulary is LOGICAL (`start`/`end`), NOT PHYSICAL (`left`/`right`)** — locked at
`Typography.tsx:98-105` (2026-07-25): matches HeroUI + the blocks already in use, and
auto-flips under RTL. Real code verification: `text-right` = **0/3** live spots (grep
`.storybook/components`, the other 3 remaining are all in `_legacy`) — the logical
convention has won absolutely at the atom layer. But `text-left` (physical) still has
**8 live spots** that don't go through `Typography` — see TRAP 2.

### Scale B — BLOCK-POSITION: where a block/track sits within its PARENT track, along the HORIZONTAL axis (reading direction)
At its core this is **one** 4-step semantic scale — `start · center · end ·
between` — but it wears **two different prop names** depending on which direction the
track runs (`frames/_spacing.ts:95-114`):

| Track | Which axis is the READING (horizontal) direction | Prop carrying the step | Available values |
|---|---|---|---|
| **HORIZONTAL** (`StackH`, `Cluster`) | the MAIN axis | `justify` | `start·center·end·between` (all 4) |
| **VERTICAL** (`StackV`) | the CROSS axis | `align` | `start·center·end·stretch` (NO `between` — the cross-axis has no concept of "stretching in the middle") |

A manual `ml-auto` on **one** child is a third route, NOT part of any track prop —
it pushes exactly one element to the end without changing the entire track's
`justify`. See TRAP 4.

**"Restrict centering" = there are 4 exceptions permitted across BOTH scales**
(inherited verbatim from the old draft). **LOCKED scope for 3 of the 4 (measured in
code on 2026-07-29, no teacher needed):**
- empty-state/error → `Feedback.tsx:280,305,330` uses BOTH `text-center` (line
  305, Scale A) AND `items-center justify-center` (lines 280/330, Scale B) for the
  same full-page case.
- a **single** hero focal → `EnrollGate.tsx:156,193` uses BOTH `text-align:center`
  (via `Typography`) AND `align="center"` (Scale B) for the same card.
- loading/spinner → `LearnShell.tsx:201-202` — `StackV align="center"
  justify="center"` (Scale B) wraps the `Spinner` while the rail is loading.

All three have live anchors confirming they apply to BOTH scales, exactly as the
old draft claimed — no need to ask the teacher again about these 3 exceptions.

**Exactly 1 remains open:** a single-button confirmation modal — NO live anchor
has been found (grepping ALL of `.storybook/components`, not just `overlays/**`,
returns 0 standalone `ConfirmDialog`/`ConfirmModal` component — see §5,
example.html). AWAITING THE TEACHER'S LOCK: does this exception still apply, or is
it obsolete?

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Are you setting this for **TEXT running inside a text box** (paragraph, heading, caption), or for where **a BLOCK/track** sits? | Text → Scale A. Block → question 2 |
| 2 | Is this one of the 4 exceptions in §1? | Yes → `center` is allowed, go to question 3 to pick the right prop. No (primary content ≥2 lines) → default `start`, do NOT center — STOP |
| 3 | Does the track in question run **HORIZONTAL** or **VERTICAL**? | Horizontal → use `justify`. Vertical → use `align` |
| 4 | Do you need to push **exactly 1** element to the end, while the others stay grouped at the start (not pushing the WHOLE row)? | Yes → `ml-auto` on that exact element, do NOT change the whole track's `justify` |
| 5 | Is the content inside a **`<button>`**/a whole-block pressable link? | Yes → you MUST manually set `text-start` (or `text-left`, see TRAP 2) to override the browser's default UA `text-align:center` — setting nothing = silently centered (TRAP 1) |

**Before trusting the tree: if a cell/column already has its own typed `align`
(Table `TableColumn.align`), use that value IMMEDIATELY** — the component has
already decided for you, don't reapply the tree from scratch.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | `text-center`/`justify-center`/`align="center"` for primary content ≥2 lines, outside the 4 exceptions in §1 | not gated yet — discipline |
| 2 | Writing `text-left`/`text-right` (physical) instead of `text-start`/`text-end` (logical) | not gated yet — Tailwind accepts both, no compile error |
| 3 | Setting `text-align` directly on `<td>`/`<th>` when un-layered CSS overrides it (TRAP 3), instead of wrapping a span | not gated yet — breaks silently, only visible when measuring `getComputedStyle` |
| 4 | Changing the WHOLE track's `justify` when only EXACTLY 1 element needs pushing (should use `ml-auto`) | not gated yet |
| 5 | Writing `justify-*`/`items-*` by hand in `className` at the `composite` layer or above | partial — `check-seams.mjs` only catches it when paired with `gap-*` (TRAP 5), `justify`-only slips through |
| 6 | Rendering a whole-block `<button>`/pressable without manually overriding `text-align` (TRAP 1) | not gated yet — only visible when measuring the DOM |

No rule on this axis is caught by `tsc` (unlike the `seam` axis, where `SeamScale`
is a literal union) — `TypographyAlign`/`TableAlign`/`LayoutJustify`/`LayoutAlign`
are all CORRECTLY literal unions, but NO union can catch "should this be centered or
not" — that is a SEMANTIC decision, not syntax, so all 6 rows above rely on reading +
measuring discipline, not on the compiler.

---
# PART B · LOOK UP WHEN DRIFT IS FOUND — only open when Part A returns a drift result
---

## 3. EXHAUSTING THE EASY-TO-CONFUSE CASES — 11 countable pairs

### 3a. Scale A (3 steps) ⇒ `C(3,2) = 3` pairs

| Pair | Deciding test | Has bitten/confirmed |
|---|---|---|
| `start` ↔ `center` | Does the content have **≥2 lines of RUNNING TEXT** (a paragraph, a description)? Yes ⇒ `start` is mandatory — both left and right edges become ragged when centered, forcing the eye to re-find the start of each line. No (≤2 SHORT lines, hero/caption/empty-state) ⇒ `center` is allowed if it matches one of the 4 exceptions in §1. | every live `text-center` case falls exactly into the "allowed" branch — see §4, example.html |
| `center` ↔ `end` | Is this a **number/price/timestamp/action at the END of a row**? Yes ⇒ `end` (with `tabularNums` if it's a number). No (a standalone single-line caption/label) ⇒ `center`. | `Table.tsx`'s `TableAlign` only defines `start`\|`end`, deliberately having NO `center` for data columns |

### 3b. Scale B (4 semantic steps) ⇒ `C(4,2) = 6` pairs

| Pair | Deciding test | Note |
|---|---|---|
| `start` ↔ `center` | Is this **primary content** (a nav item, a list) or **a single focal block** (a hero card, an empty CTA)? Primary content ⇒ `start`. Single focal ⇒ `center`. | `SettingsSidebarNav` (nav item ⇒ `justify={collapsed?"center":"start"}`, only centers when the sidebar is COLLAPSED — "collapsed" itself turns the primary content into a single icon, a genuine exception) |
| `center` ↔ `end` | Is the element the **ONE trailing action/caret** that needs to be pushed entirely to one side? Yes ⇒ `end`. No (the block needs to sit in the MIDDLE of the track, e.g. a hero) ⇒ `center`. | `ContentPager.tsx:113`, `ChallengeDeliverableList.tsx:228` use `justify="end"` for CTA/caret rows |
| `start` ↔ `between` | Are there **exactly 2 groups that need to be pushed as far apart as possible** (label ↔ value, title ↔ action)? Yes ⇒ `between`. No (several elements all grouped toward one side) ⇒ `start`. | `KeyValueList` uses `justify-between` for every label↔value row (raw class, see TRAP 5) |
| `center` ↔ `between` | Is the whole track **a single block that needs to sit in the middle**, or **≥2 groups that need to be pushed to the two ends**? Single block ⇒ `center`. ≥2 groups ⇒ `between`. | easy to confuse when there are only 2 elements — 2 elements aligned `between` and 2 elements aligned `center` with a large `gap` look identical, see TRAP 4 |
| `stretch` (only exists on `align`, replacing `between`) ↔ `center` | Does the child content need to **fill the track's FULL width** (an input, a full-width card)? Yes ⇒ `stretch` (the `StackV` default). No (the block shrinks to its content, needs to sit in the middle) ⇒ `center`. | `StackV` defaults to `align="stretch"` (`Stack.tsx:129`); every hero-card that switches to `align="center"` does so explicitly (never relying on the default) |

**Not yet bitten (a THEORETICAL risk, never actually happened — no dedicated
deciding test kept):** Scale A `start` ↔ `end` · Scale B `end` ↔ `between`.

### 3c. Two CROSS-SCALE pairs — not counted in `C(N,2)` because they're different scales, but the most commonly mistyped spot

| Pair | Why it's confused |
|---|---|
| `text-align` (Scale A, aligns TEXT) ↔ `justify`/`align` (Scale B, aligns a BLOCK) | Both have a step named **"center"**, but one sets the CSS property `text-align` (affects only the TEXT inside that element's own box), the other sets `justify-content`/`align-items` (affects the POSITION of the whole child block within the parent track). Using `text-center` to "center an icon+label row" is the WRONG tool — that row needs `align="center"` (cross-axis), not `text-center`. |
| `justify` ↔ `align` (both within Scale B) | Both map to `"center"` but are **TWO DIFFERENT PROPS** depending on whether the track is HORIZONTAL or VERTICAL (see Scale B). Both props exist on EVERY track (`StackBaseProps` has both `align` and `justify` regardless of `StackV`/`StackH`), so typing the wrong one causes NO compile error — it's only wrong in the visible result. |

**Total: 3 + 6 + 2 = 11 pairs**, none forgotten.

---

## 4. STRUCTURAL TRAPS — the right step chosen, still wrong, because the surrounding structure was misread

The five traps below all have real code anchors, rendered in `example.html` §3.

1. **A `<button>` has `text-align:center` as the browser's DEFAULT (UA
   stylesheet).** Without writing `text-center` anywhere, the text still comes out
   centered if you forget to override it. Anchor: **9 live spots** have to manually
   override it — `SurfaceCard.tsx:386,609,624,1346,1427,1626,1681`,
   `Stepper.tsx:206`, `SettingsSidebarNav.tsx:194`.
2. **Physical (`text-left`) and logical (`text-start`) both solve TRAP 1, but are
   written in 2 different styles in 2 different places within the SAME system.**
   `SurfaceCard.tsx`/`Stepper.tsx` use `text-left` (8 spots, physical) while
   `SettingsSidebarNav.tsx:194` + `ChipButtonList.tsx:77-78` use `text-start`
   (logical) for the EXACT SAME need — overriding a `<button>`'s UA default. No
   compile error, no lint error, Tailwind accepts both syntaxes in parallel so it
   drifts silently.
3. **Specificity: HeroUI's un-layered CSS beats Tailwind utilities regardless of
   which CLASS is written.** `Table.tsx:25-28` notes it directly:
   `.table__column{text-align:left}` (the HeroUI bundle, NOT inside `@layer`)
   always beats `text-end` (Tailwind v4, inside `@layer utilities`) when applied
   directly to `<td>`/`<th>` — LAYER order decides, not selector specificity.
   Worked around by setting `text-align` on a **child SPAN** (`Table.tsx:97-98`,
   `CellBox`) — that span isn't touched by any HeroUI selector, so a value set
   directly on it beats an INHERITED value, no `!important` needed. Real CSS (not
   description) is rendered at `example.html` §3.
4. **`justify-end` (pushes the whole row) ↔ `justify-between` (start-end) ↔
   manual `ml-auto` (pushes only 1 child) — three mechanisms that look IDENTICAL
   when the track has only 2 elements, and completely different once there are
   ≥3.** `ml-auto` anchors: `UserCell.tsx:129`, `SurfaceCard.tsx:1158,1393,1695`,
   `List.tsx:188`, `SubmissionAttemptsDrawer.tsx:147`. Picking the wrong mechanism
   for 2 elements shows NO symptom; only adding a 3rd element reveals the wrong
   intent.
5. **The `check-seams.mjs` gate only catches hand-rolled layout when `gap-*` is
   PRESENT in the SAME className.** (`scripts/check-seams.mjs:122`, the regex
   requires both `flex`/`grid` AND `gap-`). `justify-*`/`items-*` ALONE (no `gap-*`
   in the same spot) slips through entirely. Anchor that slipped the gate:
   `PlaygroundSetupSteps.tsx:194` (`"flex items-center justify-between
   border-b..."`, no `gap-*`) — the same violation, "hand-writing layout at the
   composite layer," as 2 other spots already caught (`Page.tsx:261`,
   `surface-card-header.tsx:71`, both HAVE `gap-3` so the gate blocked them), but
   this one escapes because it's missing exactly 1 piece of the required regex.

---

## 5. REAL ANCHORS — priority order when two sources conflict

1. **The real `src` of the EXACT component being edited** — MEASURE it, like every
   other axis (see `seam/rationale.md` §5).
2. **The component's own existing `align` prop** (`TableColumn.align`,
   `PriceEmphasis`…) — use it directly, don't reapply the decision tree from
   scratch.
3. **The §2 decision tree** — use only when (1) and (2) don't exist.

**LOCKED (measured 2026-07-29)** — the old anchor, `principles.md` §3 historical
version (line 159: "≈ $58.99 … CourseCard centered"), is now DEAD because
`CourseCard.tsx` now lives in `_legacy`, and `PriceTag.tsx` (its live replacement)
has neither that hint line nor any center-align: a 1-to-1 replacement anchor is NOT
needed, and the old anchor is not reused — the principle "numbers/prices should not
be centered" already has a STRONGER live anchor right in this document,
`Table.tsx`'s `TableAlign` (§3a Pair 2) deliberately not defining `center` for
numeric data. Losing the specific EXAMPLE does not lose the rule's validity — this is
not a question that needs the teacher.

Specific anchors for each branch: [`example.html`](example.html) §6.
