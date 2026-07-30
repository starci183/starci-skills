# INSET — the space from the edge inward (`padding`)

> This axis answers exactly one question: **how much padding does a frame/surface have inside
> it.**
> It does not answer the distance BETWEEN two things (see `seam/`), and does not answer margin
> (margin is FORBIDDEN, see `seam/rationale.md` §6). Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — five steps (2026-07-29: added `snug`), there is no sixth step

| Step | Class | px | Used for |
|---|---|---|---|
| `flush` | `p-0` | 0 | content TOUCHES THE EDGE: a cover image bleeding to the edge, a horizontally scrolling table |
| `snug` | `p-2` | 8 | small compact chrome: 1 collapsed sidebar item, a small icon button, 1 chip |
| `cozy` | `p-3` | 12 | the INSIDE face of a card — the house rule |
| `roomy` | `p-6` | 24 | a page-measure reading width or a container |
| `airy` | `p-8` | 32 | a hero or empty-state that wants to "breathe" |

SSOT of the scale: `InsetScale` in `.storybook/components/frames/_spacing.ts`. The table
`PADDING_CLASS: Record<InsetScale, string>` in the same file.

**Why `snug` was added (2026-07-29, see the JSDoc in `_spacing.ts`)**: the first count only
looked at the `padding` PROP (46 call sites, correctly `0·3·6·8`), so the scale was locked at 4
steps, MISSING 34 call sites written by hand with the `p-2` CLASS — every one of them small
compact chrome — and the gate at the time (§4.4) mistakenly checked against the 6-step
`SeamScale`, so it stayed silent; once the gate was fixed to the correct `InsetScale`, all 34
spots turned red at once: the scale was missing a step, not 34 spots being wrong. Lesson: counting
only ONE way of writing it (the prop) while missing the other way (the class) will under-report;
a gate that checks the WRONG scale is worse than no gate at all, because silence reads as
agreement.

Writing a number directly (`padding={3}`) is a **compile error** on any frame that types the prop
`padding?: InsetScale` (`Container`, `Stack`/`Flex`, `SurfaceCard`, `DoubleTabsCard`) — but unlike
`gap`, not EVERY `p-*` in the tree goes through a union-typed prop: see §4.4 and §6.

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does the content draw its own edge and need to SIT FLUSH against the outer edge (a cover image, media, a horizontally scrolling table)? | `flush` |
| 2 | Is this the INSIDE FACE of a card/tile that ALREADY HAS a visible border (usually paired with `SurfaceCard`, this is the "house rule" default for a card)? | `cozy` |
| 3 | Is this the READING WIDTH/measuring frame of a measure or a `Container` — how much OTHER child content, not the card itself? | `roomy` |
| 4 | Is this an area deliberately emphasizing SPACE — a sales hero, an empty/locked state that wants to "breathe"? | `airy` |

**Before trusting the tree's result: if the component has a real `src`, MEASURE that source.**
The tree is only the fallback when there is no source. See §5.

Quickly telling question 2 apart from question 3: `cozy` is the default step of **the card
itself** (`SurfaceCard` defaults to `padding="cozy"`); `roomy` is the default step of the
**outer measuring/wrapping frame** around several cards (`Container` defaults to
`padding="roomy"`). A typical screen nests both: `Container size="md" padding="roomy"` (the page
frame) wrapping several `SurfaceCard padding="cozy"` (each card) — two different steps at two
different tiers, not a choice of 1 of 2 for the whole screen.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing a NUMBER outside the scale for `p-*`/`p[trblxy]-*` (`p-4`, `p-5`, `p-1.5`…) at the `frame`/`composite`/`viewer`/`block`/`layout`/`overlay`/`page` tier, with NO `// inset-exception: <reason>` declared | `check-padding.mjs` — fixed 2026-07-29, `SCALE` now correctly holds the 5 `InsetScale` values (old §4.4 SUPERSEDED); a valid declared exception still SHOWS but doesn't fail the check (§4.5) |
| 2 | A child carrying `margin` to push its own spacing instead of receiving `padding` from the container (except the whitelist `mt-auto`/`ms-auto`/bleed `-m-*`) | `check-padding.mjs` (rule `child-margin`) |
| 3 | Opening `@container` and having `padding` on the SAME element (§4.2) | not gateable — only surfaces when measuring the DOM at the exact viewport cap; discipline: split into 2 layers any time a frame opens `@container` itself |
| 4 | Writing raw `p-*` at the `composite`/`block`/`layout`/`overlay`/`page` tier instead of using the frame's `padding` prop (`Container`/`Stack`/`Flex`/`SurfaceCard`), even if the value is on-scale | **NOT YET — gate needs writing**: scan every `className` containing `p[trblxy]?-(0\|2\|3\|6\|8)` at a `GUARDED` tier that does NOT go through the known `PADDING_CLASS` object/`padding` prop — currently `check-padding.mjs` only blocks OFF-SCALE, not ON-SCALE-BUT-HAND-ROLLED |
| 5 | Rounding an asymmetric padding from the real `src` down to a symmetric `InsetScale` step WITHOUT a note recording the drift right at the port site (§4.3) | not gateable — a discipline; an example done correctly: the inline comment in `EnrollGate.tsx` |
| 6 | Declaring `// inset-exception:` without stating a REASON, or declaring one for a spot that is NOT vendor-geometry/optical-nudge (§4.5) | `check-padding.mjs` catches a missing reason with the regex `/inset-exception:\s*\S/` (no `\S` after the `:` means no match, still counted as a normal finding); a valid category is a discipline call to read — there's no gate that distinguishes "a reasonable reason" |
| 7 | Applying `InsetScale` down at the `atom` tier (overriding an atom's own internal geometry that it owns, e.g. `Input`'s `pr-9`) | no gate needed — `atom` is exempt by design (13z), see §4.8 |

---
# PART B · LOOK UP ONCE DRIFT IS SPOTTED — open only when Part A comes back off
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — all 6 pairs

A 4-step scale ⇒ `C(4,2) = 6` pairs. List all 6, no cherry-picking.

### 3a. Three ADJACENT pairs — the main battle

| Pair | The DECISIVE deciding test |
|---|---|
| **`flush` ↔ `cozy`** | Does the content **draw its own background/border** all the way to the edge (an image, media, a table)? Yes ⇒ `flush` (padding would sit on top of the image itself, wrong). The content is ordinary text/control (a label, a button, a form field) that needs the minimum breathing room to not touch the edge ⇒ `cozy`. |
| **`cozy` ↔ `roomy`** | Is this the face of **EXACTLY ONE card/tile** (the card's border IS the padding's border), or a **measure/container wrapping SEVERAL children** (which may include several other cards)? One card ⇒ `cozy`. An outer measuring frame ⇒ `roomy`. |
| **`roomy` ↔ `airy`** | Is this NORMAL content/page, or an area DELIBERATELY EMPHASIZING SPACE to feel empty/luxurious (a sales hero, an empty-state, a locked state)? Normal ⇒ `roomy`. Deliberate emphasis ⇒ `airy`. |

### 3b. The remaining pairs — `flush` ↔ `roomy`, `cozy` ↔ `airy`, `flush` ↔ `airy`

Pairs 2+ steps apart: hesitating there is a sign the tree was drawn wrong, not a sign of picking
the wrong value (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of picking the wrong value, but because the structure was misread

1. **Confusing INSET with SEAM because they share the same word, but ask different questions.**
   `gap="related"` and `padding="cozy"` are both "a word in `_spacing.ts`" but answer two
   different questions: seam asks how far apart two things are, inset asks how much a surface
   opens up from its own edge. A concrete trap that has actually bitten (read the git history line
   "2026-07-27" in `Container.tsx`): `Container` used to have `header`/`footer`/`gap` slots —
   `CourseContents` wrote `gap="page"` **thinking that was the padding of the measuring frame**,
   and measured **0px** because `Container` only applies `gap` when using the slots, and doesn't
   go through that branch for plain `children`. Fix: dropped `gap`/the slots from `Container`
   entirely, keeping exactly ONE responsibility — `padding`; the rhythm between children moved
   fully onto `Container > StackV` (seam is `Stack`'s job, not the measuring frame's).

2. **`@container` and `padding` must not sit on the SAME element.** Real anchor: `Container.tsx`
   — opening `@container` on a `div` that also has `p-*` makes the container-query measure the
   content-box **after subtracting that element's own padding**, so `size="xl"` (its cap exactly
   equal to `max-w-app-xl`) never gets wide enough to reach the `@app-xl` threshold itself — this
   bug is **silent**, no tsc, no lint, only surfacing when measuring the DOM at a 1920px viewport
   (`SplitWorkspace` got stuck in `flex-col`). Fixed by splitting into 2 layers: the OUTER layer
   keeps `@container`+`max-w` (no padding), the INNER layer keeps `padding`. General rule: any
   frame that opens `@container` AND has its own `padding` must split into 2 elements.

3. **`InsetScale` can only represent padding EQUAL ON ALL FOUR SIDES — it cannot represent
   asymmetry.** Two real anchors of the same kind: `CollapsibleSidebar` (`px-3 py-6` on the
   collapsed rail differs from `p-6` on the open panel — the inline comment says plainly
   "`Stack`/`Flex` padding is a single uniform `InsetScale` step", so this chrome section does NOT
   use `Container`/`Stack`, it writes classes by hand); `EnrollGate` (real `src` has an asymmetric
   `px-4 pb-6`, ported to a symmetric `padding="roomy"` — the comment states directly "the ONE
   deviation from a byte-for-byte port, since the scale is symmetric and has no asymmetric step").
   Lesson: when the real `src` has padding that differs by axis (horizontal/vertical), you MUST
   choose between (a) a conscious approximate port with the drift noted right at the spot, or (b)
   dropping out of the frame and writing the class by hand — never round it off silently, the next
   reader will mistake it for an exact anchor.

4. **SUPERSEDED (2026-07-29).** An earlier version of this section noted the gate mistakenly used
   the 6-step `SeamScale`. Fixed the same day `snug` was added (§1): `SCALE` in
   `check-padding.mjs` now correctly holds the 5 `InsetScale` values (`0·2·3·6·8`), no longer mixed
   with `SeamScale`'s `1`. Kept as history (matches the codebase convention: reversed decisions
   aren't deleted, they're marked SUPERSEDED) — see §6 row 1, already updated to the new state.

5. **Declared exceptions, not gate dodges (2026-07-29, `check-padding.mjs`
   `EXCEPTION`/`inset-exception:`).** `InsetScale` only models ONE shape: equal spacing on all
   four sides of a SURFACE. Two real shapes fall outside that, measured once `snug` was born
   (§1) — only exactly two kinds of valid off-scale call sites remain:
   1. **VENDOR geometry** — 1 pill, 1 inline `<code>`, a popover body. HeroUI's `chip.css` ships
      `px-2 py-1` on its own — a wider-than-tall shape belongs to the vendor, the house scale
      deliberately doesn't model it.
   2. **VISUAL NUDGE** — a single-axis `pt-1`/`pb-1`, aligning text with a dot/connecting line,
      local, not the inset of a surface.

   Declare it with the comment `// inset-exception: <reason>` (or `{/* ... */}` if in a JSX
   children position — do NOT use `{/* */}` inside a plain JS parenthesis like a `? :` branch,
   that's a syntax error, see trap #6 below) right on the line with the class or the line
   IMMEDIATELY ABOVE it. A reason is MANDATORY — an exception with no reason is a silent
   exception, exactly what this gate exists to block. The gate currently `exempt`s it (doesn't
   fail the check) but still PRINTS it — it doesn't disappear from the report.

6. **Syntax trap when declaring an exception INSIDE an ordinary JS branch
   (`cond ? A : (...)`).** `{/* c */}` is only valid in JSX CHILDREN CONTEXT (between the `>` and
   `<` of a parent tag) — inside the parentheses grouping an ordinary JS expression (like one
   branch of a ternary) it gets parsed as an empty object `{}` sitting next to the following JSX
   element with no joining operator = a real syntax error (`TS1005`/`TS1382`...). Caught
   2026-07-29 in `Stepper.tsx`/`map.tsx` while another session was mid-typing exactly this
   exception. Fix: use a plain line comment `// ...` (not wrapped in `{}`) — a plain line comment
   is valid at ANY position between JS/TS tokens, including inside a grouping parenthesis.

8. **`atom` is EXEMPT — easy to mistakenly apply `InsetScale` all the way down to atom.**
   `check-padding.mjs` only scans from the `frame` tier upward (`GUARDED = {frame, composite,
   viewer, block, layout, overlay, page}` — tier names read from the real folder names on disk,
   no longer `design`/`screen`, both names died in the `tierOf()` cleanup, same reason as in
   `check-seams.mjs`); `atom`/`util` are deliberately excluded (13z: an atom is responsible for
   its own internal geometry). Anchor: `Input.tsx`, `Select.tsx` write `pr-9` directly to make
   room for the eye/icon button — this gate is CORRECTLY behaving, not an uncaught violation.

---

## 5. REAL ANCHORS — priority order when two sources clash

1. **The real `src` of the CURRENT component being edited** (declared in the file header "ported
   from…") — MEASURE it. Note §4.3: if the `src` has asymmetric padding, `InsetScale` cannot load
   it 1-to-1, you must read whether the inline comment already recorded the drift before trusting
   the ported number.
2. `_spacing.ts` JSDoc (the 46-call-site table + the "word → class → what it is for" table) and
   each real frame's default (`Container` defaults to `roomy`, `SurfaceCard` defaults to `cozy`)
   — use when (1) doesn't exist.
3. Decision tree §2 — use only when both (1) and (2) don't exist (a brand new component, never
   before present in `src`).

Anchors for each branch specifically: [`example.html`](example.html).
