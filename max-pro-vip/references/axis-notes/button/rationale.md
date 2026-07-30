# BUTTON — variant · size · position within a cluster

> This axis answers exactly one question: **what `variant` is this button, what `size`, where
> does it sit within a cluster.**
> It does not answer the spacing between buttons (see `seam/`), and it does not answer which
> icon to use (see `icon/` — not built yet). Real code anchor: [`example.html`](example.html).
>
> This axis is **PARTIALLY STILL OPEN**. The 4-step descending-emphasis model (`ghost` is a
> step lower than `tertiary`, not "a different shape at the same level") has been **LOCKED
> IN** (the teacher locked it in on 2026-07-29, see
> [`principles/button/rationale.md`](../button/rationale.md) §2 questions 3-6,
> `ghost-vs-tertiary-system.html` item 3). But
> `button-variant-system.html` item 6 still has one item left undone: **there has been no
> sweep yet to re-check every existing `ghost`/`secondary` at scale** — the 4-step rule only
> applies to NEW BUILDS, not retroactively. That sweep is still open and unscheduled.

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE

### 1a. `ButtonVariant` — seven values, there is no eighth value

SSOT: `button-tokens.ts:22` (`.storybook/components/atoms/buttons/Button/`), matches exactly
`node_modules/@heroui/styles/dist/components/button/button.styles.d.ts:15-23` (the real
HeroUI declares all 7).

| Value | HERO_VARIANT map | Meaning | Call site in `src` |
|---|---|---|---|
| `primary` | `primary` | THE ONE PRIMARY CTA of a block/page | 136 |
| `secondary` | `secondary` | The 2nd most important action — next to `primary` OR standing alone when it is the main action of a small cluster | 86 |
| `tertiary` | `tertiary` | A secondary action, does not need to stand out — the MOST common (77) but the atom was MISSING until 2026-07-29 | 77 |
| `outline` | `outline` | Clear border, transparent background — rare, used when the button stands ALONE on a background that needs separation | 6 |
| `ghost` | `ghost` | No border, no background, only appears on hover — the LOWEST step of the emphasis scale | 38 |
| `danger` | `danger` | Destructive, prominent (solid red background), has not gone through any other confirmation step | 3 |
| `danger-soft` | borrows `secondary` + its own `VARIANT_CLS` | Destructive but lighter — has already, or will, go through separate confirmation | 10 |

Writing a `variant` outside these 7 values is a **compile error** (`ButtonVariant` is a union
literal).

### 1b. `ButtonSize` — three values (`button-tokens.ts:48`)

| Value | When |
|---|---|
| `sm` | Dense rows (toolbar, action row in a list), a secondary button next to small content |
| `md` | Default — a normal CTA, a button row in a modal/drawer |
| `lg` | A standalone, prominent CTA button (hero, sign-up page) |

`size` does NOT get its own exhaustive C(3,2) pass here: no real DRIFT evidence has been found
between `sm`/`md`/`lg` in the canon (quite unlike `variant`, where 4 real bugs have already
bitten — see §4). Choose `size` by the density of the frame that contains it, not by a
separate decision tree.

---

## 2. DECISION TREE — ask top to bottom, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does this action **destroy data or is irreversible** (delete, unsubscribe, permanently disable)? | go to the DANGER branch (§2a) |
| 2 | Is this the **ONLY path to the MAIN goal of the whole block/page** that contains it (not just a local utility)? | `primary` |
| 3 | Does the cluster containing this button have **≥3 emphasis levels that must be clearly distinguished** (a row of multiple actions ranked by priority)? | the LOWEST step of the cluster → `ghost`; the steps above re-apply from question 2 |
| 4 | Does the button stand **ALONE** (no other button in the same row) and **need a clear border to separate it from the background** (colored/image background, not the default white card background)? | `outline` |
| 5 | Is this the **2nd most important level, next to `primary`**, OR the **main action of a small, self-contained cluster** (no bigger goal competing with it right there)? | `secondary` |
| 6 | Everything else — the cluster only has 2 levels, the secondary button just needs to be **CLEARLY a button** (not invisible)? | `tertiary` |

**§2a — DANGER branch** (only enter when question 1 = YES):

| # | Ask | Result |
|---|---|---|
| a1 | Does the user need to **STOP AND BE ALERTED RIGHT AT THE BUTTON** (solid red background, no confirmation step has happened before it)? | `danger` |
| a2 | Everything else (already has/will go through a separate confirmation modal, or is a lighter severity) | `danger-soft` |

Question 2 uses the test from §15a (verified — do NOT use the hypothesis that "secondary
only ever accompanies primary" — see §4.1). Questions 3-6 use the exact locked-in 4-step
model from §15b.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing `variant`/`size` outside the scale's 7/3 values | `tsc` — `ButtonVariant`/`ButtonSize` is a union literal |
| 2 | Using `ghost` for a cluster with only 2 levels (should be `tertiary` under the 4-step rule, §2 questions 3-6) | **NOT YET — gate needs to be written**: scan every row with EXACTLY 2 adjacent `Button`s in the same `StackH`/`Cluster`/footer; if one of the two is `ghost` and the cluster has no third button ⇒ flag red |
| 3 | Counting/assigning `variant` without excluding the same-named `variant` prop on `Tabs`/`Select`/`Input`/`TextField`/`InputGroup` (trap §4.5) | **NOT YET — gate needs to be written**: the script must scope to the specific import (`Button`/`HeroButton`/`ButtonBase`) before counting `variant="…"` |
| 4 | Sweeping and re-fixing existing `ghost`/`secondary` at scale when there is no specific collision yet (trap §4.3) | cannot be gated — discipline, scope is locked in by the teacher |
| 5 | Inferring the variant from 1 component that "looks similar" in `src` (trap §4.2) | cannot be gated — discipline |
| 6 | Quoting an anchor from documentation ([`principles/INDEX.md`](../INDEX.md)/artifact) without grepping the real file first (trap §4.4) | cannot be gated — discipline |

**Missing gates (#2, #3), description to write:** both require JSX analysis BY CLUSTER
(counting sibling `Button`s under the same `StackH`/`Cluster` parent node), more complex than
a single regex — needs an AST parser like `check-one-instance-per-state.mjs` already built for
a similar problem.

---
# PART B · LOOK UP WHEN DRIFT IS ALREADY SEEN — only open when Part A produces a drifted result
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — all 21 pairs

A 7-value scale ⇒ `C(7,2) = 21` pairs. The seven values split into 2 FAMILIES within the
axis: the EMPHASIS FAMILY (`primary`/`secondary`/`tertiary`/`outline`/`ghost`, in the exact
order declared in `button-tokens.ts:22`) and the DESTRUCTIVE FAMILY (`danger`/`danger-soft`).
`C(5,2)=10` within the emphasis family + `C(2,2)=1` within the destructive family + `5×2=10`
CROSS-family pairs = 21.

### 3a. Five ADJACENT pairs — this is the entire battle

**Evidence for why the fight only needs to happen here**: 4/4 real collisions logged (§15b,
`example.html` §3) are all `tertiary`↔`ghost` or `secondary`↔`tertiary` — adjacent pairs
within the emphasis family.

| Pair | The deciding test | Has actually bitten |
|---|---|---|
| **`secondary` ↔ `tertiary`** | This secondary button **carries decision weight equal to a real business choice on its own** (e.g. "Try free" next to "Enroll") ⇒ `secondary`. The secondary button is only a **step-back/supporting move** for the primary action next to it (e.g. "Cancel" next to "Submit") ⇒ `tertiary`. | 2 times — `ContentCommentComposer.tsx` (was `ghost`), `CourseQaComposer.tsx` (was `secondary`), both changed to `tertiary` |

The four remaining adjacent pairs — `primary`↔`secondary` · `tertiary`↔`outline` ·
`outline`↔`ghost` · `danger`↔`danger-soft` — are all logged as "not yet": a THEORETICAL risk,
no misassigned case has been logged.

### 3b. Six pairs ≥2 STEPS APART within the SAME emphasis family

Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the
wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

### 3c. Ten CROSS-family pairs — no test exists, and deliberately so

Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the
wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of the value chosen, but because the structure was misread

1. **Trusting a self-made hypothesis instead of reading the real code.** The hypothesis the
   teacher offered, "`secondary` only ever accompanies `primary`, otherwise `tertiary`", has
   been **REFUTED by ≥8 real cases** (see §2 question 2 of this document) — `secondary`
   standing alone is very common (`SystemStatus/index.tsx:67-75`,
   `PinnedProjectCard/index.tsx:90-129`). Applying this hypothesis to question 2 of the tree
   will pick the wrong value en masse.

2. **Inferring this component's variant from 1 component that "looks similar" in `src`.**
   `ghost` and `tertiary` do NOT have a clean boundary even within the real `src` itself: 2
   authors built the SAME pattern (icon-only reorder button, "Cancel" button next to Confirm)
   but picked 2 different variants (`ghost-vs-tertiary-system.html` items 1-2). Copying the
   variant from a "looks similar" spot is the surest way to be wrong, because the source
   itself may already be wrong.

3. **Thinking the 4-step rule means a full re-sweep AT SCALE.** The teacher locked in the
   4-step rule to apply ONLY to work GOING FORWARD (building/fixing new blocks) — it does NOT
   trigger a sweep to re-check every existing `ghost`/`secondary` (see the warning at the top
   of this document, the line "The rule applies to WORK GOING FORWARD"). Only the 2 SPECIFIC
   collisions that surfaced right during cross-checking have been patched.

4. **An old anchor has DIED — code drifts faster than documentation.** `principles.md` §15b
   and `ghost-vs-tertiary-system.html` item ① quote `SubmissionAttemptsDrawer.tsx` lines
   214/222 as an example of a "`tertiary` next to `ghost`" collision. Re-reading the real file
   (2026-07-29, verified during the session that wrote this page): the file was **ENTIRELY
   REBUILT** the same day ("this very page exists" — the discovery that the earlier version
   never cross-checked the real `src`), and those 2 "View details"/"View submission" buttons
   **NO LONGER EXIST** — it changed completely to a "the whole row IS the selection action"
   model (`onSelect` + closing the drawer in a single gesture, no more 2 separate buttons).
   Before quoting an anchor from documentation, you MUST grep the real file again — do not
   trust old line numbers.

5. **Counting `variant="…"` without filtering by component.** The same-named `variant` prop
   appears on many components UNRELATED to `ButtonVariant`: `Tabs`, `Select`, `Input`,
   `TextField`, `InputGroup` all have their own `variant`. Audit §15d must EXPLICITLY EXCLUDE
   these components when counting the 20 real `Button` call sites of `variant="secondary"`
   (see FORBIDDEN §6 item 3 of this document). Grepping `variant="…"` without the context of a
   `Button`/`HeroButton` import will count a different axis mixed in as well.

---

## 5. REAL ANCHOR — priority order when two sources clash

1. **The real `src`** — but NOTE: `src` itself is NOT consistent on the `ghost`↔`tertiary`
   pair (§4.2), so for THIS PAIR, `src` must NOT be used as an absolute anchor. For other
   pairs (especially decision-tree question 2, §15a), `src` is trustworthy evidence — read
   enough files before concluding.
2. **The teacher's locked-in 4-step rule** (§2 questions 3-6 and the special case in
   `example.html` item 2 of this document) — use when (1) itself is off.
3. Decision tree §2 — the fallback when neither (1) nor (2) applies.

Specific anchor per branch: [`example.html`](example.html).
