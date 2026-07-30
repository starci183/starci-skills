# FRAME — which frame to use for layout

> This axis answers exactly one question: **which frame to use for layout: `Stack` · `Cluster` ·
> `Grid` · `Split` · `Container`.**
> It does not answer how much spacing (see `seam/`), and does not answer how much inset (see
> `inset/` — not yet built, for now read `rules/3-shape-tier.md` §2). Real code anchor:
> [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — six frames (2026-07-29: added `ResponsiveRow`), there is no seventh frame

2026-07-29: the frame count rose to 6 (`ResponsiveRow` was born the same day `Stack`/`Flex`
learned `as`/`inline`, see below); `continue.md` line 81 still says 5 and has NOT been updated —
read this table as the real source. This is NOT a union type (each frame is its own component),
so the "scale" here is read from the REAL props that decide each frame's contract.

| Frame | File | REAL props that decide the contract | Meaning |
|---|---|---|---|
| `Stack.V` / `Stack.H` | `frames/Stack/Stack.tsx` — `StackBaseProps` | `children: ReactNode` (required — §13b: 1 axis, NO "items") | 1 axis, children **arbitrary**, can differ in kind. `wrap` exists only on `.H`. |
| `Cluster` | `frames/Cluster/Cluster.tsx` — `ClusterBaseProps` | `items: ReadonlyArray<ClusterItem>` (required, **`children` is forbidden** — not declared in the props) | N elements of the **same kind**, wraps on its own, order carries no meaning. |
| `Grid` | `frames/Grid/Grid.tsx` — `GridBaseProps` | `items` + `columns: GridColumns` (both required) | A **true 2-dimensional grid** — cells line up in columns across multiple rows, column count changes with container width (`@app-*`). FIXED column count — fewer items than columns leaves gaps, does not stretch evenly (unlike `ResponsiveRow`). |
| `Split` | `frames/Split/Split.tsx` — `SplitBaseProps` | `start`/`end: ReactNode` (2 NAMED slots, no `children`) | Exactly **two sides with fixed roles**: `start` can shrink (`min-w-0`), `end` does not shrink (`shrink-0`). |
| `Container` | `frames/Container/Container.tsx` — `ContainerBaseProps` | `size?`/`padding?` + `body`/`children` (one single slot) | **Reading measure** — centered, caps width, pads around the page. Since 2026-07-27 it **no longer** has `gap`/`header`/`footer` (see §4a). |
| `ResponsiveRow` | `frames/ResponsiveRow/ResponsiveRow.tsx` — `ResponsiveRowProps` | `items` + `columns: 1\|2` + `at: "sm"\|"md"\|"lg"` (all three required) | A FIXED `columns`-column grid below step `at`, switches directly to a **1-row flex that stretches evenly** (N cells split the width evenly on their own, never left empty even with few cells) from `at` upward. Only 1 breakpoint transition, no gap on the flex side (the seam there is `border-l`, not white space — see the file header). |

**Not counted in this scale** (even though they also live in `frames/`):
- `Flex` — marked `INTERNAL` right in the code: no story, imported only by `Stack.tsx`. It is the
  machinery underneath `Stack`, not a choice the caller makes. Since 2026-07-29 it additionally
  accepts `as?: "div"|"section"|"figure"|"span"|"li"` (the `Stack` frame forwards this prop too)
  — a frame that no longer forces a hard-coded `<div>`, letting you call `<section>`/`<li>`/
  `<figure>`/`<span>` when the real HTML needs that tag (lists need `<section>`, images need
  `<figure>`, a row of chips sitting INSIDE a sentence needs `<span>` so the sentence doesn't
  break — `<div>` is block-level, dropping it mid-sentence breaks the line). Comes with
  `inline?: boolean` (renders `inline-flex` instead of `flex`, for a frame that needs to hug its
  content instead of taking the whole line, e.g. `ProgressRing` sitting next to running text).
  **TS trap caught (2026-07-29)**: typing `as` as `ElementType`/`keyof JSX.IntrinsicElements` (a
  union of EVERY HTML tag) makes TypeScript intersect the props of ALL tags in the union — a void
  element (`img`/`input`/`br`…) doesn't accept `children`, so the intersection produces
  `children: never`, and the dynamic tag can't render even when the default is `"div"`. Fix:
  narrow `as` down to EXACTLY the 5 tags actually rendered by the frame, don't use a type wider
  than the real need.
- `SplitWorkspace` — 2 slots `main`/`aside` but it is a **concrete shape that has already frozen
  its measurements** (aside `360px`, breakpoint `@app-xl`), built for EXACTLY 1 real recurring
  situation (`ChallengeView`, `PersonalProjectWorkspace`), not a general answer — see §4.4.

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Need to cap the **reading width** + pad around **ONE block**, and don't care how the inside is arranged? | `Container` — then **repeat this tree** for the content inside (`Container` almost always wraps a `Stack.V`) |
| 2 | Arranging MULTIPLE elements. Are there **exactly 2 elements**, each with a **fixed role** (start ↔ end), and one side **must be able to shrink** (safely truncate) while the other side **keeps its size**? | `Split` |
| 3 | N elements (including N=2) of the **same repeating kind**, swapping any two of them **does not change the meaning**, needs to wrap on its own when it runs out of horizontal space, **does not need to line up in columns**? | `Cluster` |
| 4 | Need to actually split into **equal COLUMNS, aligned on both axes** (a row below must line up in columns with the row above), with column count changing by container width? | `Grid` |
| 4b | Same as question 4 (N cells of the same kind, columns by container width) BUT the number of cells can be FEWER than the column count and needs to STRETCH EVENLY to fill the width at the wide step, instead of leaving columns empty? | `ResponsiveRow` — only 1 breakpoint transition (`at`), not several steps like `Grid` |
| 5 | Everything else: a single axis, children **arbitrary** (differ in kind, not a repeating same kind) | `Stack.V` (vertical) or `Stack.H` (horizontal) depending on the main reading direction |

**Before trusting the tree: the PROPS contract wins over gut feeling.** `Cluster`/`Grid`/`Split`
do not declare `children` in their type — if your content cannot be expressed as
`items`/`start`+`end` and you're forced to stuff in an arbitrary `ReactNode`, that is immediate
evidence you're on the `Stack` branch, no matter what the tree above says.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing layout BY HAND (`flex`/`grid` + `gap-*` in `className`) at the composite/block/screen tier instead of calling a frame | `check-seams.mjs` |
| 2 | `gap` outside the `0·1·2·3·6·8` scale (6 steps of `SeamScale`) or `padding` outside the `0·3·6·8` scale (4 steps of `InsetScale`) | compiler (union literal) — if written by hand as a class, `check-seams.mjs` (gap) and `check-padding.mjs` (padding + a child's margin) |
| 3 | Passing `gap` into a frame that owns its own row rhythm (`SurfaceCard.List` and its relatives — does NOT apply to `Stack`/`Cluster`/`Grid`/`Split`/`Container`, these 5 frames taking `gap` from the caller is CORRECT) | `check-seams.mjs` (table `LIST_FRAMES`) |
| 4 | Picking the WRONG frame while it still compiles (`StackH`+`justify="between"` instead of `Split`; `Cluster` instead of `Stack.H` or vice versa) | not gateable — requires reading the semantics. Evidence: 21/21 call sites that need the `Split` contract currently all go around it via `StackH` (§3a, §4.2) |
| 5 | Building a NEW frame without first grepping to confirm **≥2 real independent cases** carry the exact comment "no dedicated frame for this case yet" | not gateable — a discipline. Anchor for doing it RIGHT: `SplitWorkspace` was grepped against `ChallengePage` + `PersonalProjectTaskPage` before being built (§4.4). **Anchor for a deliberate exception:** `ResponsiveRow` (2026-07-29) was built with exactly 1 call site (`StatRibbon`) — it doesn't clear the `≥2` bar, but the teacher signed off on it himself after hearing the real constraint clearly (`Grid` fixes the column count and leaves cells empty, `Flex` doesn't change display-type by breakpoint, forcing it into either one breaks the layout or forces hand-written `basis-[calc(...)]` — exactly what the canon is fighting). Recorded so this is NOT taken as precedent next time that "1 case is enough" — this was the teacher signing off by hand on one specific case, not lowering the general bar. |
| 6 | A NEW frame opening `@container` and setting `padding` on the SAME element (trap §4.3) | **NOT YET — gate needs writing**: scan every `frames/*.tsx` file that declares `"@container"` in the same `className` string as `PADDING_CLASS[...]`/`p-*` on the same JSX node |

---
# PART B · LOOK UP ONCE DRIFT IS SPOTTED — open only when Part A comes back off
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — all `C(5,2) = 10` pairs

A 5-frame scale ⇒ `C(5,2) = 10` pairs: `Stack↔Cluster` · `Stack↔Grid` · `Stack↔Split` ·
`Stack↔Container` · `Cluster↔Grid` · `Cluster↔Split` · `Cluster↔Container` · `Grid↔Split` ·
`Grid↔Container` · `Split↔Container`. List all 10, split into 3 groups by **how much they have
actually bitten**, not by physical distance (this axis is a branching TREE, not a linear scale
like `seam`).

### 3a. Four pairs that HAVE ACTUALLY BITTEN — one decisive deciding test per pair

| Pair | The DECISIVE deciding test | Has actually bitten |
|---|---|---|
| **`Stack.H` ↔ `Cluster`** | Do the N elements have the **SAME REPEATING KIND**, and does swapping any two of them **not change the meaning**? Yes ⇒ `Cluster` (`items`). Different kinds mixed together (icon mixed with button mixed with text) or order carries meaning ⇒ `Stack.H` (`children`). | **WAITING FOR THE TEACHER TO DECIDE** — see the §3a note below |
| **`Stack.H` ↔ `Split`** | Are there **EXACTLY 2** elements, one side **MUST be able to shrink** (safely truncate) while the other side **stays fixed**? Yes ⇒ `Split`. No (≥3 elements, or neither side can shrink, or the whole cluster needs to wrap) ⇒ `Stack.H`. | 21 real call sites |
| **`Stack.V` ↔ `Container`** | Is the question being answered the **RELATIONSHIP between the children**, or the **width+padding of the block itself**? Relationship between children ⇒ `Stack`. Reading width, not caring what's inside ⇒ `Container`. | 1 occurrence, already fixed |
| **`Cluster` ↔ `Grid`** | Do the following rows need to **LINE UP IN COLUMNS** with the row before (row 2 column 1 must align under row 1 column 1)? Needs a true column alignment, column count changes by width ⇒ `Grid`. Only needs to wrap like text ⇒ `Cluster`. | Anchor: both used correctly, no confusion recorded |

**WAITING FOR THE TEACHER TO DECIDE (`Stack.H` ↔ `Cluster`) — re-checked 2026-07-29, STILL NO
RULE ANSWERS IT:** re-read `rules/3-shape-tier.md` §3 (the SSOT, this file cannot be edited from
the `frame` axis) — that line itself lists this exact pair as **NOT YET DECIDED**. Measuring more
real call sites (`grep items={` across every `Cluster` in `.storybook`, 2026-07-29) turned up no
counter-example that breaks the deciding test in the table above — everywhere `Cluster` is used
today fits the "N chips of the same kind" shape — but that still isn't enough to close the
question on its own, since it's only 1 convention read off of exactly 1 comment
(`QuotaBar.tsx:131-134`), not a rule the teacher has approved. The question boils down to two
options:

- **(A) Lock the deciding test above in as a hard rule** — consequence: a gate can be written
  (counting the kind of element inside `items`/`children`), but the edge case must be settled too:
  do exactly 2 elements of the same kind qualify for `Cluster`, or are 2 elements always suspect
  as 2-fixed-roles (like the label↔number case above) so the default is `Stack.H` unless ≥3?
- **(B) Don't lock it in, keep reading each case in context** — consequence: flexible for
  unfamiliar cases, but not gateable by a tool, and exactly what's happening now: every call site
  writes its own comment explaining its own choice (`QuotaBar.tsx:131-134`) instead of consulting
  a shared rule.

Measurement anchor: `example.html` section "Pair 1".

**`Stack.H`↔`Split` "has bitten" even though it isn't a crash:** 21 call sites that need the exact
`Split` contract still write `min-w-0`/`shrink-0` by hand with `StackH`, while `Split` has
**0 real users** outside its own story — a quieter bite than a crash, see §4.2.

### 3b. Four pairs — the HIGHER-LEVEL question isn't answered yet, no dedicated test written

`Grid`↔`Split` · `Grid`↔`Container` · `Cluster`↔`Container` · `Cluster`↔`Split` — the
higher-level question in §2 already splits these apart, no dedicated test written.

### 3c. Two FAR-APART pairs — deliberately no deciding test

`Stack`↔`Grid` · `Split`↔`Container`. Pairs 2+ steps apart: hesitating there is a sign the tree
was drawn wrong, not a sign of picking the wrong value (cross-axis rule 3 in INDEX.md). Go back
to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of the frame choice, but because the tree was misread

1. **`Container` used to own the rhythm inside it too.** With `gap`/`header`/`footer`, passing
   `children` straight through made `gap` get **silently dropped** (measures `0px` even though
   the code says `gap="page"`). Fixed 2026-07-27: those three props are gone; now it must
   **always** be `Container > Stack.V` — seam is `Stack`'s job. Anchor:
   `rules/3-shape-tier.md` §2.

2. **`Split` was built but has 0 real users — more dangerous than active drift.** Repo-wide grep:
   `Split` is only imported by its own story. Meanwhile **21 real call sites** that need exactly
   its shape (2 roles, one side shrinks) still write `StackH gap=... justify="between"` and
   hand-write `min-w-0`/`shrink-0` themselves — `QuotaBar.tsx:131-134` even writes a comment
   explaining why it chose `StackH` over `Cluster`, without ever mentioning `Split`. This matches
   the `3-shape-tier` §4 rule exactly: *"a concept built with 0 consumers is more dangerous than
   active drift"* — just in the opposite direction: people are going AROUND it.

3. **A new frame that inherits `Container` must re-check the `@container`+`padding` trap on the
   SAME element.** `@container` measures the content-box **after subtracting that element's own
   padding**, so at `size="xl"` (right at the `@app-xl` threshold) content with padding **never**
   reaches the threshold, even at a 1920px viewport. Surfaced while building `SplitWorkspace`
   nested inside `Container size="xl"`. Fix: split into 2 layers — the outer `div` keeps
   `@container`+`max-w` (no padding), the inner `div` keeps `padding`.

4. **A missing dedicated frame ⇒ `Stack.H`+`wrap` gets turned into a "fake frame".**
   `ChallengePage` and `PersonalProjectTaskPage` both use `StackH gap="section" wrap` wrapping 2
   `StackV`s to fake a "reading column + sticky action column" — both independently wrote the
   EXACT SAME sentence *"the BEST-AVAILABLE substitute... no dedicated frame yet"*. `wrap` has no
   real breakpoint threshold, the main column shrinks indefinitely ⇒ the row ALMOST NEVER wraps,
   the 2 columns stay stuck together at EVERY width including mobile. Rule learned: **2
   independent places both admitting "no frame for this case yet" with the exact same sentence is
   enough grounds to build a NEW frame** (`SplitWorkspace`), instead of continuing to patch with
   `Stack`.

5. **`Grid.span` is hard-locked to `1|2`, no escape hatch for arbitrary position** — because
   `col-start-2` once broke the mobile layout in `GroupPressableCard`. A different shape needs a
   new composite/block, not a `Grid` prop.

6. **Call-site count: `Stack` accounts for 471/604 ≈ 78% of all calls to the 5 frames** (`Cluster`
   35 · `Grid` 25 · `Split` 14 · `Container` 51). Not a bug on its own, but `Stack` is the ONLY
   frame that accepts free-form `children` (the other 4 demand `items`/named slots), so it always
   "fits" at compile time even when the semantics are wrong — this is the mechanism behind traps
   #2 and #4.

---

## 5. REAL ANCHORS — priority order when in doubt

1. **The frame's real PROPS contract** (§1) wins over gut feeling first — `children` being
   forbidden on `Cluster`/`Grid`/`Split` is a TYPE constraint, not a convention you can choose to
   read or not.
2. **Decision tree §2** — use when (1) isn't enough to decide (e.g. the content can be described
   by either `items` or `children`).
3. **Existing call-site frequency (§4.6) is DATA to reference ONLY, not a rule.** `Stack` being
   the most common doesn't mean `Stack` is always right — see traps #2, #4: the very place where
   `Stack` is used most is where it's replacing a frame that should really be there instead.

Anchors for each branch specifically: [`example.html`](example.html).
