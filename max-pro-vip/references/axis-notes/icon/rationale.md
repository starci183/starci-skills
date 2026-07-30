# ICON — which icon, what size, what weight, whether to have an icon at all

> This axis answers exactly one question: **should there be an icon here at all, and
> if so what is its size/weight/interaction.** It does not answer icon↔text spacing
> (see `seam/`), and it does not answer icon background color (see `color/` once
> built). Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. SCALE — four sub-scales, not one flat scale

Icon does not have ONE value axis like `gap`. Four independent questions combine to
form a complete decision. Three of the four scales have a REAL type/constant in code;
the SIZE scale is derived from the real Tailwind theme (not a TS union, not
invented).

**1a. ICON SET — a locked constant, not a choice:**

| Value | Status |
|---|---|
| `@phosphor-icons/react` | ONLY ONE — used by 161 files (real count, see `example.html` §1) |
| `@gravity-ui/icons` | FORBIDDEN — 0 files still use it, it's only stuck in `package.json` |
| the glyph HeroUI draws itself in the `Indicator` slot | FORBIDDEN — must be overridden, see §1a.1 |

**1a.1. THE VENDOR'S GLYPH IS ALSO AN ICON SET** (locked by the teacher 2026-07-29)

The "one set only" rule is often read as "one `import` line only," so a second set
sneaks in through the back door: **HeroUI draws its own glyph whenever the
`Indicator` slot is left empty.** There is no `import` to grep, no gate to catch it,
but on screen it's still two icon sets with two different stroke weights.

Reading the vendor source directly
(`node_modules/@heroui/react/dist/components/*`) shows three DIFFERENT behaviors, and
lumping them together as one is the error:

| Slot | What the vendor does when left empty | How to override |
|---|---|---|
| `Accordion.Indicator` · `Select.Indicator` | draws `IconChevronDown` itself | pass a Phosphor icon as `children`. The vendor `cloneElement`s it and **keeps `data-expanded` + `data-slot` intact**, so the 180° rotation effect on open **still works** — the animation tracks `data-expanded`, not the glyph |
| `Checkbox.Indicator` | draws TWO different svgs itself, for `selected` and `indeterminate` | **MUST be a FUNCTION**, `children(state)`, see trap §4.x |
| `Radio.Indicator` | **draws no icon at all** — it's just a `<span>` wrapping `children`, the dot is the slot's CSS | **DO NOT override.** The dot is GEOMETRY, not an icon (§1b) — stuffing a Phosphor icon in there is a backwards reading of this very rule |

Size is still looked up in the §1c table like any other icon, **there is no
separate number for indicators**: the caret in `Select`/`Accordion` is position
`DIV` (it sits inside a control), not `TEXT`.

**1b. Icon POSITION — 2 values, determines the sizing formula:**

| Value | Meaning |
|---|---|
| `TEXT` | a BARE icon next to running text, no dedicated wrapping cell (`Typography.prefixIcon`/`suffixIcon`) |
| `DIV` | an icon INSIDE a cell/control with its own rhythm (tab, button, chip) |

**1c. SIZE — 5 real values in current use** (counted by grep, see `example.html` §1):

| Class | px | Real count | `TEXT` position matches `text-*` | `DIV` position matches `text-*` |
|---|---|---|---|---|
| `size-3` | 12 | 24 | `text-xs` (font-size 1:1) | — |
| `size-3.5` | 14 | 46 | `text-sm` | — |
| `size-4` | 16 | 110 | `text-base` | `text-xs` (line-height) |
| `size-5` | 20 | 124 | — | `text-sm` (line-height) |
| `size-6` | 24 | 22 | — | `text-base` (line-height) |

Measurement SSOT: `node_modules/tailwindcss/theme.css` — every `text-*` step comes
with a default `font-size` AND `line-height`, and the two columns above are looked up
from exactly those two numbers (not an invented convention).

**1d. WEIGHT — the real type `IconWeight = "regular" | "bold"`**, redeclared
locally in ≥8 primitives (`Avatar`, `IconTile`, `ImageDropzone`, `Chip`, `Tabs`,
`Menu`, `Popover`, `Typography`, `SurfaceCard`) instead of importing Phosphor's type
— deliberate, so the whole tree isn't locked to one library.

| Value | When |
|---|---|
| `regular` | size `size-5` and above |
| `bold` | size smaller than `size-5` (compensates for thin strokes at small size) |

**"Should there be an icon" is NOT a value scale** — it is a binary GATE
(keep/drop) at the first step of the §2 decision tree, applying specifically to
DECORATIVE icons next to a fact that already means something on its own in text.

---

## 2. DECISION TREE — three independent branches, each stopping at the first YES

### 2a. Main branch — whether to have an icon, what size, what weight

| # | Ask | Result |
|---|---|---|
| 1 | Is this icon decorating a **STATIC fact that already means something on its own in text** ("2 min read", "N replies")? | go to question 2 |
| 2 | (if 1=YES) Is the icon a **"universally recognized"** symbol — anyone can read it instantly, no association required (checkmark, lock)? | YES→keep it, go to question 3. NO→**DROP THE ICON, stop here** |
| 3 | Is the icon sitting **BARE next to running text** or **INSIDE a cell/control**? | Bare→position `TEXT`, look up size = font-size 1:1 (table 1c). Inside a cell→position `DIV`, look up size = line-height (table 1c) |
| 3′ | EXCEPTION: is the icon a **navigation caret/chevron** (a trailing `>` affordance, not a content icon)? | size is fixed by whichever PRIMITIVE owns it — the measured reality = `size-4` + `bold` muted (see TRAP §4.2, contradicts the old canon) |
| 4 | Is the size you just got **smaller than `size-5`**? | YES→`weight="bold"`. NO (size-5 and above)→`weight="regular"` |

Step 1, "is it decorating a static fact," **does not apply to icons inside an
interactive `Button`/`Link`** (search, refresh, play, back…) — those are FUNCTIONAL
icons, always kept, go straight to question 3.

### 2b. Secondary branch — for icons with an INTERACTION MEANING, which animation (only when hoverable/clickable)

| Icon semantics | Animation |
|---|---|
| **ARROW** (CTA "See more →") | slides in that direction on hover: `transition-[translate] group-hover:translate-x-1` |
| **static navigation CARET** (`>` in a list-row/pager) | STAYS STILL, no sliding |
| **CHEVRON** open/close (accordion, dropdown) | rotates 180°: `transition-transform data-[open]:rotate-180` |
| **ROTATE/refresh/retry/sync** | spins when clicked or while processing: `animate-spin` |

### 2c. Secondary branch — for icons with a STATE MEANING, which color (different from the decorative icons in 2a)

Reuse the `AlertStatus` type (`"default"|"accent"|"success"|"warning"|"danger"`), do
NOT invent a narrower color table — even when the case at hand only needs exactly
1-2 values.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Using an icon set other than `@phosphor-icons/react` (including `@gravity-ui/icons`, still in `package.json`) | **NOT YET — gate needs to be written**: scan for icon-lib imports outside the whitelist, except `react-icons` brand logos (`ProgrammingLanguageTabs`, an entirely different semantic) |
| 1b | **Leaving HeroUI's `Indicator` slot empty** (`Accordion` · `Select` · `Checkbox` · `Chip`/`Alert` close) and letting the vendor draw its own glyph — that's a second icon set sneaking in the back door, with no `import` to grep (§1a.1) | **NOT YET — a gate can be written**: scan JSX for a self-closing `<*.Indicator />`, whitelist `Radio.Indicator` since it draws no icon |
| 1c | Overriding `Checkbox.Indicator` with a node instead of a function ⇒ indeterminate shows a checkmark (trap §4.7) | **NOT YET — a gate can be written**: `Checkbox.Indicator` has children that are NOT an arrow function |
| 2 | Weight outside the 2 steps `regular`/`bold` (`thin`/`light`/`duotone`) | **NOT YET — gate needs to be written**: scan the literal value passed into `weight=` |
| 3 | Icon size outside the 5 scale values (`size-4.5`, `size-7`…) | **NOT YET — gate needs to be written**, same shape as `check-seams.mjs` but for the icon class |
| 4 | A `Record<Size, Weight>` table assigning the SAME value to every key (the `StepBadge` trap) | **NOT YET — gate needs to be written**: scan object literals with 2+ keys typed `Weight`/`IconWeight`, flag red if every value is identical |
| 5 | Declaring an icon prop with a library-specific type (`PhosphorIcon`, `IconType`…) | **NOT YET — gate needs to be written**: scan for a type imported from `@phosphor-icons/react` used as a prop type |
| 6 | Looking up the size table before determining bare vs. inside a cell (the `ContentModeNav` trap) | cannot be gated — requires knowing the render CONTEXT, cannot be inferred from static text — discipline |
| 7 | Keeping a decorative icon that isn't a "universally recognized" symbol next to a fact that already means something in text | cannot be gated — requires semantic judgment of "does everyone get it instantly or does it need association" — discipline |
| 8 | Icons in the same row with different geometric SHAPES (a bare triangle next to a circle) | cannot be gated — requires comparing geometry between icons, not text — discipline |

---
# PART B · LOOK UP WHEN DRIFT IS FOUND — only open when Part A returns a drift result
---

## 3. EXHAUSTING THE EASY-TO-CONFUSE CASES

Four sub-scales ⇒ four separate counts, do not merge them into one fake number.

### 3.0. POSITION pair — `C(2,2) = 1` pair

| Pair | THE DECIDING TEST | Has actually bitten |
|---|---|---|
| `TEXT` ↔ `DIV` | Does the icon have its OWN dedicated cell/control with its own padding/line-height? Yes ⇒ `DIV`, look up by line-height. No, the icon is bare next to running text ⇒ `TEXT`, look up by font-size. | 1 time — `ContentModeNav` (fixed `size-4`→`size-5`) |

### 3.1. SIZE pairs — 5 values ⇒ `C(5,2) = 10` pairs

**3.1a. Four ADJACENT pairs:**

| Pair | Deciding test |
|---|---|
| `size-3` ↔ `size-3.5` | Is `text-xs` or `text-sm` wrapping the icon (position `TEXT`)? Look it up directly in the font-size column of table 1c, don't guess. |
| `size-3.5` ↔ `size-4` | Same question, `text-sm` or `text-base`? This is also a crossed `TEXT`↔`DIV` pair (`text-xs` DIV = `size-4`) — you must know the position before looking it up. |
| `size-4` ↔ `size-5` | This is EXACTLY the pair `ContentModeNav` used to get wrong: an icon inside a `text-sm` cell must be `size-5` (line-height), not `size-4` (`text-xs`'s font-size). Ask: does the icon have a wrapping cell — if yes, line-height wins. |
| `size-5` ↔ `size-6` | Is `text-sm` or `text-base` wrapping the icon at position `DIV`? Look it up in the line-height column of table 1c. |

**3.1b. The remaining six pairs of `C(5,2)`:** Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

### 3.2. WEIGHT pair — `C(2,2) = 1` pair

| Pair | Deciding test |
|---|---|
| `regular` ↔ `bold` | Is the size you just picked `< size-5`? Yes ⇒ `bold`. `size-5` and above ⇒ `regular`. Do NOT pick by taste — the SIZE→WEIGHT table must differ per EACH size; hard-coding one weight for every size within the same component is a trap (see §4.4). |

### 3.3. SIZE×WEIGHT combinations — 5×2 = 10 cells, exhaust the full grid

| | `regular` | `bold` |
|---|---|---|
| `size-3` | strokes too thin | correct |
| `size-3.5` | strokes too thin | correct |
| `size-4` | strokes too thin | correct |
| `size-5` | correct (standard) | strokes too heavy, breaks the row's rhythm |
| `size-6` | correct | strokes too heavy |

Stop criterion: every cell of the 5×2 grid has a verdict, none left open.

---

## 4. STRUCTURAL TRAPS — wrong not because of the number chosen, but because the context was misread

1. **Looking up the size table BEFORE knowing the position.** `ContentModeNav.tsx`
   picked `size-4` for an icon inside `Tabs.Tab` (`text-sm`) — correct per the
   icon=TEXT formula for `text-xs`, but wrong because that icon is icon=DIV. Fixed to
   `size-5` (see `example.html` §2). Always answer "bare or inside a cell" before
   opening table 1c.

2. **LOCKED 2026-07-29: a caret has NO fixed size — it matches the size of the text
   next to it.** The teacher: *"a caret matches text size"*.

   The old canon's error wasn't the number `size-3` itself, but **turning it into a
   CONSTANT**. A caret goes through the exact same §1c table as any other icon: ask
   position (`TEXT` or `DIV`) first, then look up the text size. Three contexts give
   three answers, and that's why a single constant is never right across the board.

   Re-measured the same day, after splitting by POSITION instead of merging into one
   number:

   | Location | Position | Next to what | Currently | Per table §1c |
   |---|---|---|---|---|
   | `Disclosure.tsx` caret next to a label | `TEXT` | `text-sm` | `size-4` | **`size-3.5`** |
   | `Select.tsx` inside `HeroSelect.Indicator` | `DIV` | control | `size-4` | look up the `DIV` row, not the `TEXT` row |
   | `ArchitectureFlow` connector mark between 2 nodes | not a navigation caret | diagram | `size-3` | outside this axis |

   The lesson costs more than the number: **"5/5 call sites are all `size-4`" is a
   CORRECT count but a WRONG reading** — those five spots aren't the same type, so
   their agreement proves nothing. Counting without splitting by the deciding axis
   means the bigger the number, the more likely it leads to a wrong conclusion.

   Remaining work: fix the `TEXT`-position call sites from `size-4` back to
   `size-3.5`. Not done yet because another session was writing to `.storybook`
   (2026-07-29 19:33) — avoid overlapping edits.

3. **Weight hard-coded to one value for every size in the same table.**
   `StepBadge.tsx` used to hard-code `weight="bold"` for both `sm` (`size-4`) and
   `md` (`size-5`) — so `md` ended up bolder than every other `size-5` glyph in the
   system. This is the REVERSE of the common error (forgetting bold at small sizes),
   so scanning for "missing bold" would never catch it — you have to scan the
   SIZE→WEIGHT table for whether it has 2 distinct values per key.

4. **Icons in the same row with different geometric SHAPES**, not just different
   size/weight. `KeepGoingPath` used to put `PlayIcon` (a bare triangle) next to
   `CheckCircleIcon`/`CircleIcon` (two round icons) → it broke the row's rhythm even
   though size/weight were both correct. Fixed to `PlayCircleIcon` (a play button
   inside a circle, matching the shape of its two siblings). This trap doesn't live
   in any numeric table — you have to LOOK at the whole row, not just read cell by
   cell.

5. **Wrongly applying the "universally recognized" gate to a functional icon.** The
   gate in §2a questions 1-2 applies only to decorative icons next to a STATIC fact;
   icons inside an interactive button/link (search, refresh, play) are always kept
   because they're an affordance, not an illustration — confusing the two loses a
   genuinely necessary functional icon.

6. **Declaring an icon prop with a library-specific type** (`icon?: PhosphorIcon`)
   instead of `ComponentType<SVGProps<SVGSVGElement> & { weight?: IconWeight }>` —
   locks the whole dependency tree to one vendor; switching libraries later means
   editing every signature. Anchor: `AsyncContent` used to have this.

7. **Overriding `Checkbox.Indicator` with a SINGLE node instead of a FUNCTION.**
   Reading the vendor source: `typeof children === "function" ? children(state) :
   children`, where `state` carries `isSelected` and `isIndeterminate`, and when
   left empty it draws **two different svgs** for those two states. Passing
   `<CheckIcon />` directly means **the indeterminate state also shows a
   checkmark** — the wrong state, and wrong silently: no compile error, no lint
   error, and a screenshot of the default state looks completely normal.

   ```tsx
   <HeroCheckbox.Indicator>
       {({ isIndeterminate }) => isIndeterminate ? <MinusIcon weight="bold" /> : <CheckIcon weight="bold" />}
   </HeroCheckbox.Indicator>
   ```

8. **Overriding `Radio.Indicator`.** It draws NO icon — it's just a `<span>`
   wrapping `children`, the round dot is drawn by the slot's CSS. This is the
   reverse trap of trap 7: skipping the override where one is needed, and stuffing
   an icon in where there isn't one. The deciding test: **does the vendor draw its
   own glyph when the slot is empty** — if yes, that's a second icon set and must be
   overridden; if no, it's geometry, leave it alone.

---

## 5. REAL ANCHORS — priority order when two sources conflict

1. **The real Tailwind measurements** (`tailwindcss/theme.css` font-size +
   line-height) for the SIZE table — this is the most objective source, not an
   internal convention.
2. **The primitive that owns that icon** (e.g. `SurfaceCard.trailingIcon`,
   `Typography.ICON_CLS`) — MEASURE the real value it's forcing, even when it
   differs from the canon's prose (see TRAP §4.2).
3. **The §2 decision tree** — use only when (2) doesn't exist (a new component,
   with no primitive owning it yet).

Specific anchors for each branch: [`example.html`](example.html).
