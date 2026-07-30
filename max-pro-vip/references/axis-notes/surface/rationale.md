# SURFACE — rounding · border · shadow · fill (`variant` / `radius`)

> This axis answers exactly one question: **how much rounding, is there a border, is there a
> shadow, what fill color.**
> It does not answer spacing (see `seam/`), does not answer padding (see `inset/` — but the
> concentric formula in §1 uses padding as a variable, so the two axes intersect at exactly one
> point, see §4.5).
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE

### 1a. The REAL tokenized scale — `SurfaceCardVariant`, 2 values
SSOT: `export type SurfaceCardVariant = "surface" | "nested"` —
`surface-card-header.tsx:123`, the class-building function `surfaceFrame()` in the same file,
lines 135-136.

| Value | Class | Meaning |
|---|---|---|
| `surface` (default) | `rounded-3xl bg-surface shadow-surface` | the **OUTERMOST** surface, lifted off the page background by a SHADOW |
| `nested` | `rounded-3xl border border-default` (+ `bg-surface` via `surfaceFrame()`, though `Nested` specifically re-draws it as `bg-transparent` — see §4.4) | a surface **NESTED** inside another surface, border REPLACES shadow since shadows disappear in dark mode |

### 1b. Secondary — `radius: "xl" | "3xl"`, exists only on `.Nested`
`SurfaceCardNestedProps.radius` (`SurfaceCard.tsx:544`) — default `"3xl"` (24px), `"xl"` (12px)
used for tight contexts (a chat bubble). Real base unit: `--radius: 0.5rem` (8px) at
`src/app/globals.css:215`, `rounded-3xl = 3×radius = 24px`, `rounded-xl = 1.5×radius = 12px`,
`rounded-2xl = 2×radius = 16px` (read straight from that file, not Tailwind's hand-typed
defaults).

### 1c. MOSTLY LOCKED IN 2026-07-29 — tokenize `SurfaceRadiusRole`, KEEP `shadow-lg`, `shadow-sm` PENDING (narrowed)
Frequency grep across all of `.storybook/components` (`rounded-*`: 120 `rounded-full` · 46
`rounded-2xl` · 44 `rounded-3xl` · 34 `rounded-xl`; `shadow-*`: 29 `shadow-surface` · 6
`shadow-field` · 6 `shadow-none` · 5 `shadow-lg` · 4 `shadow-sm`) — these values repeat by clear
ROLE (media→2xl, field→xl, pill→full, tile-restyle→`shadow-field`).

**Tokenize `SurfaceRadiusRole = "frame" | "media" | "field" | "pill"`: DO IT.** The rule has
already answered this — applying the same rule just used to lock in `InsetScale`'s new `snug` and
to REJECT `h6` (same day, 2026-07-29): **a step/token is only born when someone CHOOSES it
because it's DIFFERENT, not because the library happens to have it.** These three roles never
overlap (nowhere does media use `xl`, or field use `2xl`) — 200 call sites splitting cleanly into
3 distinct roles is the same kind of evidence as the 34 `p-2` call sites that earned `snug` (a
real difference), not like the 8 `h6` spots (rejected because they share the SAME role as `h5`,
not a step of their own).

**Remove `shadow-lg` from the surface area: DO NOT remove it — it is its OWN role
("floating"), not drift.** Re-reading all 3 live spots (`FloatingActionButton.tsx:54`,
`ContentAiSelectionAsk.tsx:91`, `MindMapContinueButton.tsx:128,138`) — all three are surfaces
FLOATING ON TOP of other content (a fixed FAB, a floating chip, a panel floating over a
ReactFlow canvas), not a card lying flat on the page. `MindMapContinueButton.tsx:39-45` states
plainly that this is a JUDGEMENT CALL: *"the shadow is what tells the eye this is on top of the
canvas, not part of it"* — `shadow-lg` was CHOSEN because it differs from `shadow-surface` (a flat
surface), exactly the condition the rule requires to keep a step of its own, not just reaching for
a Tailwind number that happened to be available.

**`shadow-sm`: STILL PENDING, but narrowed by re-measuring.** The count of `4` above includes dead
code — 2/4 spots (`_legacy/designs/rendering/RagSourceGraph/RagSourceGraph.tsx:70,93`) sit inside
`_legacy`, following the same convention already used on the `press`/`reading-flow` axes: not
counted as a live source. Only **2 live spots** remain: `QRCode.tsx:37` (a border around the logo
in the middle of a QR code, a small pill variant) and `FlowDiagram.tsx:55` (a diagram node, which
already has a `border` at the same time — suspect double-fill, same as Forbidden #2). These two
spots don't CLEARLY share one role (a small badge vs. a diagram node) and have no explanatory
comment recording intent the way `shadow-lg` does — not enough evidence to tokenize into its own
role yet, and not enough to declare it drift that should be removed either. **The real question
that needs the teacher's eyes:** (a) migrate these 2 spots onto `shadow-field` (an existing role,
simpler vocabulary, but `field` inherently means input/button, using it for a badge/diagram-node
is a slight semantic stretch) or (b) leave them as-is, not tokenized (fits the context better but
leaves 2 call sites drifting outside the vocabulary)?

---

## 2. DECISION TREE

| # | Ask | Result |
|---|---|---|
| 1 | Does this surface have a parent surface (`bg-surface`/`bg-surface-secondary`/modal/drawer/page-card) wrapping it **DIRECTLY**? | NO ⇒ the OUTERMOST surface ⇒ `variant="surface"` (default). YES ⇒ go to #2 |
| 2 | Does the nested part occupy nearly the **ENTIRE BODY** of the parent surface (a RATIO test, not a location test)? | Nearly all ⇒ the nested frame is REDUNDANT — drop the frame, let it be the ONLY surface (the parent becomes `frameless`). Only a small part ⇒ `variant="nested"` |
| 3 | Is this RENDERING A SURFACE FRAME, or coloring an ELEMENT inside one (a cover image / field / chip)? | A surface frame ⇒ stop at #1-#2. An element ⇒ go to #4 |
| 4 | Is the element media (cover/thumbnail) or a field (input/select/button) or a pill (chip/avatar/switch) or a ROW (a row in a list that already has a parent frame)? | media ⇒ fixed `rounded-2xl` · field ⇒ `rounded-xl`/`rounded-field` · pill ⇒ `rounded-full` · ROW ⇒ **NO rounding/border/shadow of its own** (§7b, read from the parent frame) |
| 5 | Adding a selection `ring`/`outline` (`isSelected`/`isFocusVisible`) onto a surface that already has `shadow-surface`? | YES ⇒ must turn off the shadow at the same time (`!shadow-none`) — two box-shadow layers don't stack, see §4.3 |

**Before trusting the tree: if the component has a real `src`, MEASURE that source.** The tree is
only the fallback.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing `rounded-*`/`shadow-*` outside the observed vocabulary (e.g. `rounded-[10px]`, `shadow-[0_0_0_2px_red]`) | **NOT YET** — no script in `scripts/*.mjs` scans `rounded-`/`shadow-` (fully grepped, 0 hits) |
| 2 | A box having both `border` and `shadow-surface` at the same time (double-fill §1a) | **NOT YET** — gate needs writing: scan every `cn(...)` that contains both `border` (not `border-none`) and `shadow-surface` |
| 3 | `variant="nested"` when there's no parent surface wrapping it directly (has actually bitten twice, §4.2) | **not gateable** — requires knowing the real DOM parent tree, not regex-able — discipline/eyes only |
| 4 | Adding a selection ring/outline without turning off the accompanying shadow (§4.3) | **NOT YET** — gate needs writing: scan every `isSelected &&`/`isFocusVisible &&` next to `ring-`/`outline-` whose branch is missing `shadow-none` |
| 5 | A ROW (`NestedSection`, `SurfaceCardListItem`) adding its own `rounded-*`/`border`/`shadow-*` (violates §7b ROW≠CARD) | **NOT YET** |
| 6 | Passing `className` meant to restyle the card face into the outer wrapper instead of `contentClassName` (§4.1) | **NOT ONGOING** — a one-off Node script once caught this bug (`steps/13` §2p, scanning 88 files calling `SurfaceCard.*`), but it was never turned into a live script in `scripts/*.mjs` |
| 7 | Applying the concentric formula (`inner radius = outer radius − padding`, §4.5) to a NESTED surface frame or media instead of only to a FIELD element | **NOT YET** — no gate yet distinguishes the kind of object before applying the formula |

---
# PART B · LOOK UP ONCE DRIFT IS SPOTTED — open only when Part A comes back off
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — 4 real surface shapes, `C(4,2) = 6` pairs

Only `surface`/`nested` are values of ONE shared prop (§1a). But "rounding/border/shadow/fill"
across the whole `SurfaceCard.*` family is actually **4 distinguishable surface shapes** — visibly
and in code — with the other two not going through the `variant` prop at all, but being a
separate convention of a different component. Ordered by increasing surface WEIGHT (no chrome →
dashed border only → solid border → full border/shadow) produces an ordered scale, so the same
`C(N,2)` counting method as the `seam` axis applies. Fully grepped
`rounded-|shadow-|border` in `SurfaceCard.tsx` — found no fifth shape.

| Step | Shape | Anchor |
|---|---|---|
| 1 | `bare` (ROW) | no border, no shadow, no rounding of its own — borrows the parent frame (§7b) |
| 2 | `placeholder` | DASHED border only (`border-2 border-dashed`), no fill, no shadow |
| 3 | `nested` | SOLID border, no shadow |
| 4 | `surface` | shadow (`shadow-surface`) + its own fill, no border |

### 3a. Three ADJACENT pairs

| Pair | The DECISIVE deciding test |
|---|---|
| `bare` ↔ `placeholder` | Is this a **REAL DATA ROW** in a list, or an **EMPTY SLOT inviting a new addition**? Real data ⇒ `bare`. An empty slot waiting to be tapped ⇒ `placeholder` |
| `placeholder` ↔ `nested` | Does this border come with **REAL CONTENT** inside, or does it just signal "this spot is empty, tap to add"? Real content, nested inside a parent surface ⇒ `nested`. Empty, static, waiting for an action ⇒ `placeholder` |
| `nested` ↔ `surface` | Tree §2 question 1: is there a parent surface wrapping it DIRECTLY? YES ⇒ `nested`. NO (this is the outermost surface) ⇒ `surface` |

Pairs 2+ steps apart: hesitating there is a sign the tree was drawn wrong, not a sign of picking
the wrong value (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of picking the wrong value, but because the structure was misread

1. **`className` landing on the wrong wrapper ⇒ a "ghost card" second surface showing up behind
   the real one (HAS ACTUALLY BITTEN).** `.Base` has 2 props split by layer: `className` → always
   lands on the OUTERMOST `<section>` (no fill); `contentClassName` → lands on the REAL card frame
   (`rounded-3xl bg-surface shadow-surface`). `PressableGroup`'s tile builder once passed
   `TILE_CHROME` (`"rounded-2xl shadow-field"`) through `className` (a mistake) — `box-shadow`
   draws fine without a fill, so the outer `<section>` (16px rounding, its own shadow) showed up
   as a second card nested behind the real card (24px rounding). Fixed + re-scanned all 88 files
   calling `SurfaceCard.*`, no second case found. Lesson: measure `outerHTML`/`getComputedStyle`,
   don't reason from theoretical CSS.

2. **`variant="nested"` chosen for a surface that was actually OUTERMOST — repeated 2 REAL
   TIMES.** `ContentHeader` and `ContentRelatedList.tsx:131` both once set `variant="nested"` even
   though no parent surface wrapped them. The bug isn't "picking the wrong one of 2 values" — it's
   **misreading whether a parent surface exists** before even reaching the value-picking step
   (tree §2 question 1 was never actually asked).

3. **A selection ring not turning off its accompanying shadow ⇒ two box-shadow layers don't stack,
   one DISAPPEARS.** **CONFIRMED 2026-07-29 by reading the code directly — no longer a suspicion.**
   `.shadow-surface` compiles to `box-shadow: var(--shadow-surface)` — a literal, does NOT go
   through Tailwind's `--tw-shadow`/`--tw-ring-shadow` variable chain used to stack ring+shadow.
   Two utilities both setting `box-shadow` on one element means one EATS the other, by
   stylesheet order, not by the order written in `className`. `.SelectableGroup` handles it
   correctly — uses `outline` (not Tailwind's `ring-*`) AND `!shadow-none` together when selected
   (`SurfaceCard.tsx:1153`, comment at lines 1110-1113 explains the mechanism above correctly).
   Re-reading all 3 branches of `.Base` (`SurfaceCard.tsx:370, 390, 440` — not-pressable /
   link-pressable / actions-pressable branches) confirms **all 3** pair `surfaceFrame(variant)`
   (⇒ `shadow-surface` at the default variant) with `isSelected && "ring-2 ring-accent"` and NO
   accompanying `!shadow-none` — exactly the mistake `.SelectableGroup` had before it was fixed.
   This is a REAL BUG (not a guess), but the fix lives in `.storybook` — outside this axis's
   scope, not fixed here directly (HARD RULE #2). The canon's job ends here; the rest is code
   backlog.

4. **LOCKED IN 2026-07-29 — `Nested` not calling `surfaceFrame()` is DELIBERATE, not a copy-paste
   drift.** The shared helper `surfaceFrame()` (`surface-card-header.tsx:135-136`) ALWAYS keeps
   `bg-surface` regardless of `variant` — but this helper serves `.Base` (a STANDALONE card, with
   no guarantee it sits inside an already-colored parent surface), so it needs to keep the fill to
   stand on its own anywhere. `Nested` (`SurfaceCard.tsx:648-680`, docblock at lines 640-644) is a
   DIFFERENT component — a "card-inside-card" — with a usage contract stated directly in its own
   JSDoc: *"Parent context drives the shell: any filled parent surface → variant="nested""*,
   meaning this component is ONLY called when the parent surface is ALREADY a filled surface.
   Given that constraint, `bg-transparent` is the CORRECT choice: it avoids stacking two
   meaningless `bg-surface` layers (the same color twice), while the border alone is still enough
   to mark the boundary on an already-filled parent. Two functions producing two different results
   because they serve two different USAGE CONTRACTS (`.Base` has no guarantee of a filled parent,
   `Nested` guarantees one) — not duplicate code that needs merging.

5. **LOCKED IN — the concentric formula (`inner radius = outer radius − padding`) and the §1b rule
   (nested KEEPS 3xl) ANSWER TWO DIFFERENT QUESTIONS, not a contradiction — you just need to read
   which object is being asked about.** Real measurements: `surface` defaults to `rounded-3xl`
   (24px) + `cozy` padding (`p-3` = 12px, `PADDING_CLASS.cozy`, `_spacing.ts:129`) ⇒ the formula
   gives `24 − 12 = 12px = rounded-xl` — an EXACT MATCH with a real field/input
   (`Input.tsx:687` `rounded-xl`). But `flush` padding (`p-0`) ⇒ the formula gives
   `24 − 0 = 24px = rounded-3xl`, while `CoverImage.tsx:49,56` ALWAYS fixes `rounded-2xl` (16px)
   regardless of padding — the formula is right for a field, WRONG for media. **Rule:** the
   concentric formula only applies to an ELEMENT (field) nested inside a frame; it does NOT apply
   to a SURFACE FRAME (a nested card keeps 3xl per its own separate §1b rule) and does NOT apply
   to media (`CoverImage` is fixed by role, not by calculation). Three kinds of object, three
   different answers — not one shared formula that's drifted. **REMAINING DEBT (tooling, not a
   decision):** there's still no gate that automatically distinguishes "calculating for a field
   element" from "calculating for a surface frame/media" before applying the formula — add this to
   the §6 Forbidden table.

---

## 5. REAL ANCHORS — priority order when two sources clash

1. **The real `src` of the current component being edited** — e.g.
   `src/components/blocks/cards/SurfaceListCard/index.tsx:48-77` still keeps the old prop name
   `bordered?: boolean` (before `.storybook` switched to `variant`), but with the SAME
   border-xor-shadow logic. This is the original evidence behind the whole axis.
2. Canon [`principles/surface/rationale.md`](../surface/rationale.md) §1 (LOCKED IN 2026-07-26,
   previously `principles.md §1`) — the hand-written rule for border/shadow + radius-keeps-3xl.
3. Already-locked memory (not in the repo, in the user memory store):
   `concentric-radius-formula` (the math formula, corrected 2026-07-14) and
   `surface-in-surface-ratio-test` (the RATIO test, 2026-07-16) — both LOCKED IN but NOT yet fully
   baked into [`principles/INDEX.md`](../INDEX.md) (memory itself notes "this rule has NOT been
   baked into canon yet").
4. Tree §2 — use only when (1) doesn't exist.

Anchors for each branch specifically: [`example.html`](example.html).
