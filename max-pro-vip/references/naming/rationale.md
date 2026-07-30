# NAMING — how to name components, stories, types, files, folders

> This axis answers exactly one question: **how to name components, stories, types, files,
> folders.**
> It does not answer which tier holds what (see `4-organization.md` §1), only the SHAPE of the
> name. Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — not a number, a NAMING TEMPLATE per artefact KIND

This axis has no ordered scale. There are **8 KINDS OF IDENTIFIER** in the repo, ordered by the
exact sequence a component passes through from birth to use, plus **1 PROSE KIND** (kind 9) which
is not an identifier at all but text meant to be read as sentences. Each kind has one fixed
template.
**Exhaustiveness criterion: all 8 identifier kinds, plus kind 9 for non-identifier text.**

Kind 9 stands outside the pair-count in §3, deliberately: it is PROSE, not a name, so it cannot be
confused with the other eight. The `C(8,2)` count in §3 still keeps a denominator of 28.

| # | Kind | Template | Real class/token | Meaning |
|---|---|---|---|---|
| 1 | **Folder (family)** | LOAD-BEARING kind of element → PLURAL (`cards`, `chips`, `buttons`). A business-domain noun → stays singular (`learn`, `commerce`, `ai`) | `components/composites/cards/`, `components/starci/blocks/commerce/` | tells apart "grouped by shape" (cloneable, plural is correct) from "grouped by business meaning" (not cloneable, singular is correct) |
| 2 | **Impl file `.tsx`** | PascalCase matching the main export, 1 file = 1 already-FLATTENED component (no more `X.Member`) | `ContinueCard.tsx` exports `ContinueCardHero`, `ContinueCardItem` | §3b: the dot was removed 2026-07-28, a file can still bundle several exports from the same root |
| 3 | **Story file `.stories.tsx`** | PascalCase matching the Component, or `ComponentMember.stories.tsx` when the file must be split by member | `SurfaceCardList.stories.tsx`, `ContinueCardHero.Progress.stories.tsx` | 1 story file = 1 MEMBER, but the MEMBER-vs-STATE boundary gets confused easily, see §3a pair 3 |
| 4 | **Story title (`title:`)** | `Tier/Family/Component[/device][/state]`, each segment PascalCase, NO spaces | `"Atoms/Chips/Chip/ChipGroup"`, `"StarCi/Pages/CourseContents/Desktop/Paid"` | this path is the real sidebar address — changing it changes the storyId |
| 5 | **Story export (state)** | PascalCase read as a DATA CONDITION (`Default`, `Loading`, `NotStarted`) — NOT read as a component name | `export const NotStarted`, `export const LoadError` | the `Foo.Bar` shape is forbidden — that's a MEMBER disguised as a STATE, gate `check-member-as-state.mjs` |
| 6 | **Type/interface** | a suffix by ROLE: `XProps` (props) · `XLike` (a domain entity passed in) · `XItem` (an element of `items`) · `XStyle`/`XConfig` (a lookup table value) | `ChipBaseProps`, `InputButtonLike`, `AvatarGroupItem`, `AvatarSizeStyle` | it's not the call site that decides the suffix, it's the ROLE of the data shape |
| 7 | **Prop in an interface** | camelCase, symmetric with its sibling props of the same role (`isLoading`/`isDisabled`, don't rename an existing `label` when the meaning differs) | `isSkeleton`, `onRetry` | drawn from the `Button` case 2026-07-26: name props symmetrically, don't invent a private name |
| 8 | **Local variable** | camelCase describing meaning, no abbreviations, no Hungarian notation | — | **THIS STEP HAS NO GATE YET** — no `naming-convention` rule found in `eslint.config.mjs`; this is a discipline, not a machine check |
| 9 | **Prose string shown in a panel** (NOT an identifier) | **A FULL SENTENCE with a subject and a verb.** `—` as a connector is forbidden, as are `↔` `->` `=>` | `why` · `reason` · `role` of a node · `leaf` in `BlockAnatomy` | locked in by the teacher 2026-07-27, see §4.7. Exceptions: a markdown table inside a JSDoc, a `§` anchor, and an arrow in a tree diagram (`→ Page.Header`) still stand, because there they are STRUCTURE, not a sentence |

SSOT for tier names (Tier at row 4): **LOCKED IN 2026-07-29** — `INDEX.md` section "Official tier
names", disk is the judge. 9 tiers: `heroui · atom · behavior · frame · composite · block ·
layout · overlay · page`. `designs` and `screens` are DEAD (`screens` is called `page`/`pages` on
disk).
See §6 Forbidden at the end, a row once "AWAITING THE TEACHER'S DECISION" now closed.

---

## 2. DECISION TREE — ask to figure out which KIND you're naming, then apply the right template

| # | Ask | Result |
|---|---|---|
| 1 | Is this a **folder** grouping several files at the same level? | Has a repeatable component-type name ⇒ **plural** (kind 1a). Has a fixed business-domain name ⇒ **stays singular** (kind 1b) |
| 2 | Is this a **`.tsx` file that is not `.stories.tsx`**? | Kind 2 — PascalCase matching the export, no dot |
| 3 | Is this a **`.stories.tsx` file**? | Kind 3 — ask next: does this file have EXACTLY ONE root export, or is it carrying several MEMBERS with different APIs? One ⇒ file name = Component. Several ⇒ `ComponentMember` |
| 4 | Is this a string in `title:`? | Kind 4 — join by `Tier/Family/Component`, add a device/state branch if the tree is deeper than 3 levels |
| 5 | Is this an `export const` inside a story file? | Kind 5 — ask: strip out every other state, can the component still be CALLED under a different name? No (only a prop changes) ⇒ the name = a data condition. Yes (this is actually a different way to call it) ⇒ this is actually a MEMBER, go back to kind 3/4 |
| 6 | Is this an `interface`/`type`? | Kind 6 — ask: is this shape the props of 1 component? `XProps`. Is it a domain entity passed in? `XLike`. Is it an element of an `items` array? `XItem`. Is it the value of a `Record<Enum, …>`? `XStyle`/`XConfig` |
| 7 | Is this a field inside `interface Props`? | Kind 7 — camelCase, compare against sibling props in the same interface to keep it symmetric |
| 8 | Everything else (a declaration inside a function body)? | Kind 8 — camelCase, no abbreviations |
| 9 | **Ask BEFORE even question 1:** does this string SHOW UP IN A PANEL for a human reader (`why`/`reason`/`role`/`leaf`)? | Yes ⇒ **Kind 9, stop right here** — this isn't naming, this is writing a sentence. No ⇒ keep going from question 1 |

**Before trusting the tree: if kind 4 (a story title) already has 3+ files for the same Component
but different states (`ContinueCardHero.Progress` / `ContinueCardHero.NoProgress`), stop — this is
a sign of trap §4.2, not something question 5 can answer right away.**

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | A `X.Member` namespace inside a component file (`Object.assign`, `export const X = { Base }`) | `check-no-namespace.mjs` |
| 2 | An anonymous object-literal type on a prop/generic/function parameter | `check-inline-types.mjs` |
| 3 | A story export named like a MEMBER (`Foo.Bar` PascalCase, not `=`/digits/lowercase) instead of a data condition | `check-member-as-state.mjs` |
| 4 | A `storyId` pointing at a story that doesn't exist (renamed but the anchor wasn't updated) | `check-story-ids.mjs` |
| 5 | A display name in `title:`/`export const` with a space or prose (`"No progress"`) | **NOT YET — needs writing**: scan the last segment of every `title:` and every `export const <Name>`, flag red if it contains a space or starts with a lowercase letter |
| 6 | A family folder named singular when grouping a cloneable KIND of element | **NOT YET — needs writing**: needs a fixed domain-noun list (`learn`, `commerce`, `ai`…) to exclude, check the rest for plural by a trailing-`s` heuristic |
| 7 | Deriving a kind-6/7 name (type/prop) from WHERE it's used instead of the ROLE of the data shape | not gateable — a discipline, requires reading and understanding the shape's semantics |
| 8 | Abbreviations/Hungarian notation for local variables (kind 8) | not gateable — no `naming-convention` rule in `eslint.config.mjs` |
| 9 | **A connector symbol in a panel string** (kind 9): `—` as a connector, `↔`, `->`, `=>` inside `why`/`reason`/`role`/`leaf` | **NOT YET — writeable, should be written soon**: scan every `.stories.tsx`, read the values of those four keys, flag red if they contain `—` `↔` `->` `=>`. Do NOT scan JSDoc, comments, or tree diagrams (the exception already declared under kind 9) |

**LOCKED IN 2026-07-29 — TIER NAMES, see `INDEX.md` section "Official tier names":**
- Before this date, five sources declared five different lists; the standard is now **the real
  folder name on disk**.
- 9 official tiers: `heroui` (no folder, just a badge in `ANNOTATE`) · `atom`
  (`atoms/`) · `behavior` (`behaviors/`, a shapeless primitive) · `frame` (`frames/`) ·
  `composite` (`composites/`) · `block` (`<app>/blocks/`) · `layout` (`<app>/layouts/`) ·
  `overlay` (`<app>/overlays/`) · `page` (`<app>/pages/`).
- `designs` (from the old `4-organization.md` §1) and `screens` (from the old task brief) are
  DEAD — `screens` is called `page`/`pages` on disk, `designs` doesn't exist at any tier.
- Tier and app are TWO PERPENDICULAR AXES: shared tiers (`heroui, atom, behavior, frame,
  composite`) live at the root; per-app tiers (`block, layout, overlay, page`) live under
  `<app>/`.

---
# PART B · LOOK UP ONCE DRIFT IS SPOTTED — open only when Part A comes back off
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — 8 kinds, counted by pipeline order, not by rank

The 8 kinds aren't a linearly ordered scale by value, so the `C(8,2) = 28` count is used as the
overall DENOMINATOR, but only 3a (kinds ADJACENT in the birth-to-use pipeline) is where real
confusion happens. Pipeline order: **folder → impl file → story file → story title →
story export → type → prop → local variable.**

### 3a. Seven ADJACENT pairs in the pipeline — this is the whole battle

Four pairs that have never actually bitten (theoretical risk, skip the deciding-test column):
**folder ↔ impl file** · **impl file ↔ story file** (never confused) · **story export ↔ type
suffix** · **prop ↔ local variable**. Three pairs that have actually bitten remain:

| Pair | The DECISIVE deciding test | Has actually bitten |
|---|---|---|
| **story file ↔ story title** | Does the FILE name necessarily equal the LAST segment of `title:`? Not necessarily — a file bundling several states can still be 1 title; but a file SPLIT by state for ONE title produces 2 paths (`Hero/Progress`, `Hero/No progress`) ⇒ it's confusing STATE with MEMBER, see the next pair | 1 time (`ContinueCardHero` — 2 files, not yet merged) |
| **story title ↔ story export** | Does the last segment of `title:` read as ONE DATA CONDITION or as A DIFFERENT WAY TO CALL IT? Different paths (`Hero/Progress` vs `Hero/No progress`) = 2 DIFFERENT WAYS TO CALL IT ⇒ correctly 2 MEMBERS, don't merge them as states of 1 export. But if 1 title has several `export const`s that read like component names (`export const SurfaceCardList`) that's a STATE disguised as a MEMBER ⇒ wrong, split the file | gate `check-member-as-state.mjs` was written exactly for this case |
| **type suffix ↔ prop** | Are you naming the DATA SHAPE (goes with `interface`) or a SINGLE FIELD inside that shape? Field ⇒ prop, camelCase. The whole shape ⇒ type, suffixed by role | 73/44 spots before the gate — confused in WHERE the shape lives, not in the NAME itself, see `example.html` |

### 3b. Six pairs ONE KIND APART — the higher-level question isn't answered yet

| Pair | How to read it |
|---|---|
| folder ↔ story file | Hesitating here means you haven't answered 3a's "folder ↔ impl file" first — answer it and the rest follows |
| impl file ↔ story title | Haven't answered "does the impl file = 1 component", go back to 3a |
| story file ↔ story export | Haven't answered "story file ↔ story title" — same root cause as the `ContinueCardHero` trap |
| story title ↔ type suffix | Comparing a PATH against a TYPE NAME — not the same kind, go back to tree §2 to determine the kind first |
| story export ↔ prop | Haven't answered "story export ↔ type suffix" |
| type suffix ↔ local variable | Haven't answered "type suffix ↔ prop" |

### 3c. Fifteen FAR-APART pairs — deliberately no test

`C(8,2) = 28 − 7 − 6 = 15`. Pairs 2+ steps apart: hesitating there is a sign the tree was drawn
wrong, not a sign of picking the wrong value (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not in picking the template, but in reading the structure

1. **A namespace reads like a variant, but is actually a folder.** `X.Member` promises a family
   sharing the same prop signature, but measuring it before removal found only **1/10**
   namespaces actually sharing a signature — the other nine grouped totally different APIs under
   one name. All have now been flattened (`check-no-namespace` reports 0), but writing a new
   component with `X.Member` recreates this exact mistake.
2. **A STATE split by FILE mistakenly read as already "done" merging.** `ContinueCardHero.Progress`
   and `ContinueCardHero.NoProgress` are two FILES for the same MEMBER `Hero` — they should really
   be merged into 1 file with 2 leaves, but currently exist as 2 separate titles
   (`Hero/Progress`, `Hero/No progress`). Renaming both to `ContinueCard.Hero` right now would
   **collide on title, breaking the index** — the file must be merged first, renamed after, never
   the other way around.
3. **A display name with a stray space slipped through.** `"No progress"` (not PascalCase, still
   has a space) sits right inside a real running title. No gate catches a space in `title:`, so it
   survives tsc/eslint — must be caught by eye or a new gate written (§6 row 5).
4. **A family forced into plural for a domain noun.** `learn`, `commerce`, `ai` are fixed BUSINESS
   names, not a cloneable "kind of element" — forcing them plural (`Learns`, `Commerces`)
   misreads question 1 of tree §2, it isn't picking the wrong word.
5. **An anonymous type has no name to import.** The `check-inline-types.mjs` gate once miscounted
   154 by confusing a TYPE POSITION with a VALUE POSITION (a const map). The real trap: two call
   sites hand-describing the same unnamed shape will drift apart — naming it (kind 6) stops this
   bug at the root.
6. **A tier used in writing doesn't match the tier on disk.** LOCKED IN 2026-07-29
   (`INDEX.md` section "Official tier names", disk is the judge) — don't take an EXAMPLE path from
   an old document (`designs`, `screens`) and treat it as an anchor, both names are DEAD.
7. **Writing a panel string as if NAMING it instead of WRITING A SENTENCE** (kind 9, locked in by
   the teacher 2026-07-27). This is a trap about the KIND, not about the template: the writer is
   in an identifier-naming mindset so they compress meaning into symbols, when that field is
   actually a place to write a sentence.

   | | |
   |---|---|
   | wrong | `lead row — icon ↔ text cluster, center-aligned` |
   | right | `lead row where the icon sits beside the text cluster, both centred on the same line` |

   Three reasons, not taste. **The panel is a narrow column**, so text can wrap anywhere; a symbol
   torn from its two ends loses its meaning, while a sentence still reads fine. **The final reader
   is an LLM rebuilding the UI**, and hitting `A ↔ B` forces it to guess the relationship — guessing
   is exactly where it makes things up. And symbols **don't translate**: `↔` means something
   different to each reader (symmetry, conversion, or just "next to").

   This rule once **went missing**: it was born in `rules/4-organization.md` §4a, and when the
   canon split into 15 axes, no axis claimed it, because it isn't a value choice but a writing-style
   constraint. Picked back up here 2026-07-29. General lesson: **a rule that doesn't fit any axis
   is a rule about to fall through the cracks** — when that happens, say so out loud, don't let it
   go looking for a home on its own.

---

## 5. REAL ANCHORS — priority order when two sources clash

1. **The real folder structure + real `title:` strings currently on disk in `.storybook/`** —
   always re-read with `grep`/`ls`, never copy from documentation.
2. `4-organization.md` — canon still alive, but **partly out of date** (see the end of §6).
3. `.artifacts/decompose/storybook-naming.html` — **HALF DEAD**: correct on the
   plural-family template and PascalCase-identifier, **wrong** on tier names
   (`Primitives/Design/Block/Layouts/Overlays` no longer exist as of 2026-07-28). Take only the
   template shapes from it, drop every path example.

Anchors for each kind specifically: [`example.html`](example.html).
