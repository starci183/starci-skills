# SKELETON — does it need `isSkeleton`, and how is the shimmer shape drawn

> This axis answers exactly one question: **does this component need `isSkeleton`, and how is
> the shimmer shape drawn.**
> It does not answer empty/error (see `async/` — not built yet), it does not answer spacing
> (see `seam/`). Real code anchor: [`example.html`](example.html).

---

# PART A · RECOGNITION — load this part when SCANNING

---

## 1. THE SCALE — 7 shimmer SHAPES, there is no eighth shape

This is **not an ordered scale** (there is no "in between shape 1 and shape 3"). The scale is
a CATEGORICAL set of 7 values, each value a different WAY OF DRAWING, read from the real
components themselves (there is no `SkeletonShape` type defined in the code — this scale was
DERIVED from reading the 24 components fixed in §2r/§2s, not invented).

| # | Shape | Real anchor | When |
|---|---|---|---|
| 0 | **NO SKELETON OF ITS OWN** | `SurfaceCard`/`Container` (frame tier §4) | a frame that only wraps a slot/children, produces no pixels itself — the child inside handles its own `isSkeleton` |
| 1 | **A SINGLE NODE** | `CoverImage.tsx`, `Typography.tsx` (`isSkeleton` branch) | the root of the skeleton branch IS a `HeroSkeleton`, no wrapper of its own |
| 2 | **A FIXED-COUNT MULTI-NODE MIRROR** | `MarkdownContent.tsx` (2 `HeroSkeleton` bars) | a few shimmer nodes, COUNTABLE and NOT dependent on data/props |
| 3 | **A MIRROR ALONG A KNOWN-IN-ADVANCE AXIS** | `ProgressRing.tsx` (by `size`), `Breadcrumbs.tsx` (by `collapseFrom`/`collapseOnMobile`) | there's a shape axis the caller has ALREADY CONFIGURED before loading, and it MUST branch on it |
| 4 | **ROW COUNT VIA ITS OWN PROP** | `Legend.tsx` (`skeletonCount = 3`), `KeyValue.tsx`'s `KeyValueList` (`skeletonRows = 3`) | a REPEATING list whose real row count is NOT YET KNOWN while loading, has its own prop + default |
| 5 | **FORWARDING THE FLAG DOWN TO A CHILD** | `SegmentBar.tsx` → `Legend` (`<Legend isSkeleton skeletonCount= />`), `StatRibbon` → `StatPair` | the child component ALREADY HAS its own `isSkeleton` — do not build a parallel shimmer tree yourself |
| 6 | **A SINGLE FIXED SHAPE (no branching)** | `Pagination.tsx` | the shape axis is DECIDED BY THE DATA (not yet known while loading) — deliberately not inventing variants |

SSOT for this taxonomy: `§12g.0`/`§12g.0a`/`§12c` of the canon
[`principles/skeleton/rationale.md`](../skeleton/rationale.md) (this very axis). **There is no
type defining this scale in the code** — each component writes its own `isSkeleton` union
(see §5 REAL ANCHOR).

---

## 2. DECISION TREE — 5 questions, stop at the first YES

| # | Ask | Result |
|---|---|---|
| Q1 | Does this component draw any SHAPE of its own (or is it just an agnostic frame wrapping a slot/children — §4)? | NO ⇒ **shape 0**, stop — the child inside handles it |
| Q2 | Is what appears in the skeleton branch a DIFFERENT (already imported) COMPONENT that **ALREADY HAS** its own `isSkeleton`? | YES ⇒ **shape 5** — only forward the flag down, do NOT build your own wrapping `HeroSkeleton` |
| Q3 | Is this a REPEATING LIST (multiple rows/items of the SAME KIND) whose real count depends on DATA? | YES ⇒ **shape 4** — add a count prop (`skeletonRows`/`skeletonCount`) + a sensible default |
| Q4 | Does the component have another shape axis (`size`/`variant`/`collapseFrom`…), and is that axis KNOWN IN ADVANCE by the caller (static config) or DECIDED BY DATA (only known AFTER loading finishes)? | known in advance ⇒ **shape 3** (MUST branch) · decided by data ⇒ **shape 6** (deliberately one shape) · no such axis ⇒ Q5 |
| Q5 | Does that fixed shape have MORE THAN ONE shimmer node/row? | YES ⇒ **shape 2** · NO (just 1 node) ⇒ **shape 1** |

**Before trusting the tree: the `isSkeleton` branch must always come BEFORE every other
shape-branching path in the function** (§12g "The isSkeleton branch must be checked FIRST"),
and if the component has real hooks, that branch must come **AFTER all hooks have already
been called** (§4 item 2). See §4 STRUCTURAL TRAPS.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | A component that owns a real SHAPE (not a pure slot/re-export) but is MISSING `isSkeleton` | **NOT YET** — gate needs to be written: list `.storybook/components/**` (excluding `_legacy`/`frames`), exclude pure re-export/namespace files, flag any remaining file WITHOUT the string `isSkeleton` in its props (this is exactly the Node script already run manually in `steps/13` §2r — 246 files scanned → 24 real gaps found — proposed to be baked in permanently) |
| 2 | The `isSkeleton` branch does not come BEFORE every other shape-branching path | **NOT YET** — gate needs to be written: parse each file; if there's an `if (isSkeleton)`, no other `if` testing a shape prop (`size`/`variant`/`shape`) may appear on a line BEFORE it |
| 3 | A component WITH HOOKS places the `isSkeleton` early-return BEFORE all hooks have been called (violates Rules of Hooks) | **NOT YET** — `eslint.config.mjs` line 41 already registers the `react-hooks` plugin but ONLY disables `exhaustive-deps`, does NOT enable `rules-of-hooks` — immediately gateable: turn on `"react-hooks/rules-of-hooks": "error"` |
| 4 | Skipping the "known in advance" shape axis when drawing the skeleton (drawing one shared shape for every `size`/`variant`/`collapseFrom`) | cannot be gated — requires understanding which axis the caller knows in advance; discipline of re-reading §12g.0 every time a skeleton is added |
| 5 | Building a parallel shimmer tree for a child component that ALREADY HAS its own `isSkeleton`, instead of forwarding the flag down | **NOT YET** — gate needs to be written: cross-check the Deps tab (already declares the child component import) against `<HeroSkeleton` appearing OUTSIDE the call to that child component, within the same `isSkeleton` branch |
| 6 | Rebuilding a shared compound `Skeleton.*` (a 1:1 mirror of each component, living outside its owner) | **NOT YET** — gate needs to be written: forbid any export shaped like `Skeleton.<PascalCase>` that maps to the name of another component in `.storybook/components/**` |
| 7 | A content prop (`text`/`items`/`value`…) demoted to blanket OPTIONAL instead of being forced by a discriminated UNION on `isSkeleton` (§12b) | **NOT YET** — `check-inline-types.mjs` currently only catches anonymous shapes, not discriminated unions; a dedicated gate needs to be written |
| 8 | Missing a dedicated `Skeleton` leaf in the story (only adding the prop on the component, not the leaf, §12g.0a) | **NOT YET** — `check-story-coverage.mjs` only checks that a story FILE exists per block, not that it has ENOUGH leaves inside |
| 9 | Reporting done before running `tsc --noEmit` after adding a union (missing a narrow-fallback on the `false` branch) | cannot be gated beforehand — only `tsc` catches it AFTER the mistake is written; discipline of always running `tsc` right after every new union |

---

# PART B · LOOK UP WHEN DRIFT IS ALREADY SEEN — only open when Part A produces a drifted result

---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — 7 values ⇒ `C(7,2) = 21` pairs

The scale has no linear order, so "adjacent" is redefined: two values are **adjacent** when
they are the two branch results of the **SAME question** in the §2 tree (differing by exactly
one decision). All 21 pairs are listed, none skipped.

### 3a. Seven ADJACENT pairs on the tree — one deciding test per pair

Four pairs have NEVER bitten (a purely theoretical risk), so they get no dedicated deciding
test: `0 ↔ 1` · `1 ↔ 2` · `2 ↔ 4` · `3 ↔ 5`. The remaining three have actually bitten or
nearly did:

| Pair | The deciding test | Has actually bitten |
|---|---|---|
| **1 ↔ 5** | Is what's in the skeleton branch a DIFFERENT COMPONENT that already has its own `isSkeleton`? Yes ⇒ `5` (just forward the flag). Nobody has defined that shape yet ⇒ draw it yourself (`1`). | nearly bit: `SegmentBar` once wrapped an extra `<div data-anat-part="Legend">` AROUND the child `Legend` instead of forwarding the badge straight through — fixed in §2s |
| **2 ↔ 5** | The same test above, applied to "several fixed nodes": is that part a child composite that already has `isSkeleton`? | as above |
| **3 ↔ 6** | For that shape axis, does the caller WRITE its value INTO THE CODE BEFORE the request runs (`size`, `collapseFrom`), or is it only known AFTER the data resolves (`totalPages`)? Known in advance ⇒ `3`, MUST branch. Decided by data ⇒ `6`, deliberately one shape. | 2 times: `Breadcrumbs` once let `isSkeleton` ignore `collapseFrom`/`collapseOnMobile`; `Tabs.Base` ignored `variant` (secondary still drew the primary's pill) |

### 3b. Five pairs under the SAME PARENT QUESTION — the question above hasn't been answered, no dedicated test

| Pair | How to read it |
|---|---|
| `0 ↔ 2` | Q1 ("does this component draw any shape of its own") has not been answered yet. Answer Q1 first before asking further. |
| `0 ↔ 4` | Same reason — a frame wrapping a child LIST (whose child already has `skeletonRows`) does not mean the frame ITSELF also needs `isSkeleton`. |
| `1 ↔ 3` | Q4 ("does this component have a shape axis") has not been answered yet. A shape that "looks like 1 node" but actually has a real `size`/`variant` belongs to `3`, not `1`. |
| `3 ↔ 4` | Q3 ("is this a REPEATING list") has not been answered yet. A single-node-many-configurations cluster (`3`) is quite different from an N-row list (`4`). |
| `4 ↔ 6` | Same reason as Q3 — `4` is a list that knows its row count via a prop, `6` is one shape because the axis is decided by data; these are 2 different-axis concepts, not directly comparable. |

### 3c. Nine FAR-APART pairs — no test exists, and deliberately so

`0↔3` · `0↔5` · `0↔6` · `1↔4` · `1↔6` · `2↔3` · `2↔6` · `4↔5` · `5↔6` — Pairs 2 or more steps
apart: hesitating there is a sign the tree was drawn wrong, not that the wrong value was
picked (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of the shape chosen, but because the structure/order was misread

1. **The `isSkeleton` branch placed AFTER another shape-branching path.** Bad anchor:
   `Typography` once had its `isSkeleton` check sit below the heading branch →
   `size="h3" isSkeleton` rendered an EMPTY heading, which tsc/eslint never caught. Fix:
   `isSkeleton` must be the FIRST `if`, before every other branch.
2. **A component WITH HOOKS places the `isSkeleton` early-return BEFORE all hooks have already
   been called** — violates Rules of Hooks (a hook called conditionally). Bad anchor:
   `MarkdownContent.tsx` (2026-07-29) got this wrong TWICE in a row (before `useRef`/`useMemo`,
   then still had one `useMemo` stuck after the branch) before being fixed correctly — the
   branch is only valid AFTER the last line that calls a hook. Different from a component with
   no hooks (`Typography` — "top of the function" is enough there).
3. **Skipping the "known in advance" axis when drawing the skeleton — drawing one shared shape
   for EVERY configuration.** Bad anchor: `Breadcrumbs` (ignored `collapseFrom`/
   `collapseOnMobile`), `Tabs.Base` (ignored `variant`). This isn't picking the wrong shape
   between 3 and 6 — this is ALREADY BEING AT shape 3 but forgetting to branch.
4. **Rebuilding a parallel shimmer tree for a child component that ALREADY HAS its own
   `isSkeleton`** instead of forwarding the flag straight down. Nearly bit: `SegmentBar` once
   wrapped `data-anat-part="Legend"` around the child `Legend` instead of letting `Legend`
   badge itself — cleaned up back to "forward the flag down to the atom, don't build a
   parallel tree" (§12g.0 item 3, recorded in `steps/13` §2s).
5. **Rebuilding a shared compound `Skeleton.*`** (mirroring each component in a separate file,
   living OUTSIDE its shape's owner). A real anchor that drifted: `Skeleton.Accordion` drew
   **one extra caret slot** that the real `TruthList` had already dropped its Indicator from —
   nobody caught it because the loading shape lived outside its owner. This compound was
   ENTIRELY DELETED on 2026-07-25, forbidden to be revived under any name.
6. **Inventing a "fake card shape" for a FRAME** instead of keeping the REAL frame. The teacher
   locked this in with a counter-question: *"Since when does a card have a skeleton?"* — the
   container (`rounded-3xl`/`bg-surface`/shadow/separator/gap) stays exactly as it is, only the
   CONTENT NODES inside it turn into bars.
7. **After adding an `isSkeleton` union, TypeScript does NOT automatically narrow a variable
   already destructured on the `false` branch** — you must add a fallback yourself
   (`value ?? default`, `arr ?? []`, `x!`) at each usage site, and COMMENT clearly that it's a
   fallback that never actually runs (the union already guarantees it), not real edge-case
   handling. Skipping this step is what makes tsc go red after adding a batch of unions (§2r).

9. **Copying an old `isSkeleton` branch verbatim into a merged version, on the assumption "the
   old code must work".**
   Anchor from 2026-07-29 (`TrialEnrollBanner`): the old branch had NEVER had a leaf of its
   own, so it had never actually rendered once. Building a new leaf for it exposed a
   pre-existing HTML bug: `FeedbackCallout` renders `title`/`description` inside a `<p>`
   (via HeroUI's `Alert.Title`/`Alert.Description`), while `Typography isSkeleton` emits a
   `<div>` — a `<div>` nested inside a `<p>` is invalid HTML, and React throws a REAL hydration
   error, not just a soft warning.

   The correct fix: `FeedbackCallout` has no `isSkeleton` of its own, but the `Alert` atom
   underneath it ALREADY DOES — call `Alert isSkeleton` directly (precedent already exists in
   `CourseTeamGate.tsx`). This is exactly shape 5 of the §1 scale: forward the flag down to a
   child that already has it, don't build a parallel shimmer tree.

   General lesson: **building a NEW leaf/state often exposes a bug that has been lying dormant
   for a while.** A branch with no leaf yet is a branch nobody has ever looked at, and "it's
   been there all along" is not proof it works.

---

## 5. REAL ANCHOR — priority order when two sources clash

1. **The real `src` of the EXACT component being edited** (declared "ported from…" in its
   header) — MEASURE it. **There is currently NO `src` anchor for this axis** —
   `grep -rl "isSkeleton" src/` returns EMPTY. All 24 components in §2r/§2s are still at the
   "STORYBOOK-LOCAL DESIGN SPEC — ported faithfully from `@/components/blocks/…`, not yet
   synced back to `src`" stage. When synced back, `src` will not yet have `isSkeleton` to
   trust — use tier 2.
2. **Decision tree §2** — the current primary source, since (1) does not yet exist for this
   axis.
3. **Another component that already applied the pattern correctly**
   (`Typography`/`CoverImage`/`Legend`…) — this is only reference data for how to write the
   union + place the branch, NOT to be mechanically applied from component A to component B
   just because "it looks similar" (cross-axis rule #2 in `INDEX.md`).

Specific anchor per branch: [`example.html`](example.html).
