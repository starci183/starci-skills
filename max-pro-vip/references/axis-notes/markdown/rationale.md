# MARKDOWN — how far this string of text is rendered as markdown

> This axis answers exactly one question: **how far this string of text is rendered as
> markdown.**
> It does not answer font size (see `text/` — not built yet), it does not answer text color
> (see `color/` — not built yet). Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — three tiers, there is no fourth tier

This scale is **NESTED**: each later tier ALWAYS allows everything the earlier tier allows,
plus more. Read from the real type definitions + real components, not invented.

| Tier | Real mechanism | Allows | Source |
|---|---|---|---|
| `title` | `Typography` (atom) prop `parseInlineCode` | ONLY `` `backtick` `` → `<code>`. No bold/italic/link/block | `atoms/text/Typography/Typography.tsx` — function `renderInlineCode`, line ~150-165 |
| `small richtext` | composite `RichText` | backtick + **bold** + *italic* + `[link]` + `\n`. NO block-level | `composites/viewers/RichText/RichText.tsx` — array `RULES`, line ~62-98 |
| `article` | composite `MarkdownContent` | everything in small richtext, plus heading · list · code fence · table · mermaid · directive (`:::tab`/`:::accordion`/`:::chip`/`:::muted`) | `composites/viewers/MarkdownContent/MarkdownContent.tsx` — `ReactMarkdown` + `REMARK_PLUGINS`, line ~224 |

SSOT for the scale: there is NO union type in the code (`MarkdownTier` does not exist yet) —
this scale lives as "which component is imported", not as a TypeScript kind. **THE SCALE HAS
NO TYPE REPRESENTATION IN CODE YET** — if it's later baked into an enum, see the "cannot be
gated yet" line in §6.

The technical reason for the `title` tier (not a matter of presentation taste): a title always
sits inside an element with an HTML CONSTRAINT (an accordion trigger's `<button>`, a
single-line compressed header tag) — `MarkdownContent` emits BLOCK-LEVEL markup (`<p>`,
`<ul>`, `<div>`) and nesting that inside a `<button>` is invalid HTML. See
`renderInlineCode`'s JSDoc, `Typography.tsx` line ~148-155.

---

## 2. DECISION TREE — ask top to bottom, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Is this field the IDENTITY of a block/item (strip all formatting and the reader **still recognizes what they're looking at**) AND/OR does it sit inside an element with an HTML constraint (`<button>`, compressed header)? | `title` — STOP |
| 2 | Does the field need to DISPLAY BLOCK STRUCTURE (a heading on its own line, a multi-item list, a multi-line code fence, a table, mermaid, or any `:::` directive)? | `article` — STOP |
| 3 | Everything else (a description of 1-few lines, may need to emphasize a word or a link, but doesn't need a block) | `small richtext` |

**A secondary test for question 1** (when torn between title vs. small richtext): strip all
bold/italic/link from the field. The reader still recognizes "what this is" ⇒ `title`. The
formatting itself CARRIES INFORMATION (a link leads to another page, bold emphasizes a
keyword) ⇒ not a title.

**Before trusting the tree: if that field's TYPE in the code is `ReactNode` (not `string`),
this tree does NOT apply** — `ReactNode` is a SLOT (the caller decides for itself, can put
anything in it), not a single-tier field that this axis adjudicates. See trap #4 below.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | A `title` field sitting inside a control with an HTML constraint (button/compressed header) typed as `ReactNode` instead of `string` | **NOT YET — gate needs to be written**: scan every prop named `title` declared in `.storybook/components/**`, warn if the type is `ReactNode`/`JSX.Element` AND that component renders it inside `<button>`/`Accordion.Trigger` |
| 2 | Rendering `MarkdownContent` (block-level) inside any element with an HTML constraint (`<button>`, `<summary>`, `<a>`, an inline element) | **NOT YET — gate needs to be written**: scan the JSX, find `<MarkdownContent` whose nearest JSX ancestor in the same file is one of the forbidden tags |
| 3 | A field declared type `string` correctly at the `small richtext` tier but rendered through bare `Typography` instead of the `RichText` composite | cannot be gated automatically (requires knowing the field author's INTENT, cannot be inferred from the type) — discipline: every new `description`/`caption`/`subtitle` field must ask itself "does it need bold/link, or is bare Typography enough" |
| 4 | A mid-tier composite (`RichText`) exists but has no real consumer beyond its own story, unchanged across multiple rounds of edits | **NOT YET — gate needs to be written**: cross-check against the existing `check-deps-coverage.mjs` (which catches "a component composes something the Deps tab doesn't declare") — extend it to also catch "a component that was BUILT but 0 one imports it outside its own story" |
| 5 | Changing a markdown field's type on 1 consumer without running `tsc` on the whole repo to catch other consumers sharing that field name | can be caught indirectly via a repo-wide `tsc --noEmit` (this exact method was used correctly in the 2026-07-29 round, catching `SubmissionFindingsList` as the 3rd consumer) |
| 6 | Judging something "safe" only by scanning story DATA (literal markdown syntax in a field), skipping a scan of the component's TYPE | cannot be gated — discipline: scanning data does NOT substitute for reading the type, see trap #5 |

---
# PART B · LOOK UP WHEN DRIFT IS ALREADY SEEN — only open when Part A produces a drifted result
---

## 3. EXHAUSTIVE — two separate axes, both must be exhausted

### 3a. The TIER axis: a 3-value scale ⇒ `C(3,2) = 3` pairs — all 3 covered

**With a scale of only 3 steps, "adjacent" is 2 pairs and "far apart" is 1 pair — there is no
"1 step apart" middle group because there aren't enough steps to form one.**

| Pair | The deciding test | Has actually bitten |
|---|---|---|
| **`title` ↔ `small richtext`** | Use §2 question 1. Does the field sit inside an HTML constraint (button/compressed header) AND is it an identity? YES ⇒ `title`. If the formatting (bold/link) CARRIES INFORMATION rather than just bolding a name ⇒ `small richtext`. | 3 times — see table §3b below |

The remaining two pairs, condensed: **`small richtext` ↔ `article`** has never actually
bitten (a theoretical risk); **`title` ↔ `article`** has bitten once —
`SubmissionFindingsList.tsx`'s `message`, see §3b. Pairs 2 or more steps apart: hesitating
there is a sign the tree was drawn wrong, not that the wrong value was picked (cross-axis rule
3 in INDEX.md). Go back to §2.

### 3b. Three real bugs that have actually bitten — the `title ↔ small richtext`/`title ↔ article` pairs

| # | Where | Was written (WRONG) | Should be | Confused pair | Date |
|---|---|---|---|---|---|
| 1 | `RichText.tsx:145` JSDoc | listed "titles" as an example use of RichText | a title does not use RichText | `title ↔ small richtext` | 2026-07-29 |
| 2 | `SurfaceCardAccordionItem.title` | typed `ReactNode` (inviting arbitrary JSX/markdown) | typed `string`, via `parseInlineCode` | `title ↔ small richtext` | 2026-07-29 |
| 3 | `SubmissionFindingsList.tsx`'s field `message` | rendered `<MarkdownContent>` directly (full, block-level) **RIGHT INSIDE the accordion trigger `<button>`** | split the icon out into `titleStart`, renamed `message`'s role to `title` (a string via `parseInlineCode`) | `title ↔ article` (the worst confusion, invalid HTML) | 2026-07-29 |

### 3c. The FIELD-KIND axis — exhausted by an OBJECTIVE CRITERION: every field name that
really appears in `.storybook/components/**` with a `string`/`ReactNode` type related to
authored text. Stopping criterion: all 8 field kinds actually found by grepping the real code
have been listed (`title`, `label`, `subtitle`, `description`, `caption`, `hint`, `body`,
`message`) — listing additional field kinds that don't exist in the code would be invented, so
it stops here.

| Field | CORRECT tier (per §2 tree) | Real CODE state today | Anchor |
|---|---|---|---|
| `title` (an item inside an array, appears in a button/compressed header) | `title` | ALREADY correct in `SurfaceCardAccordionItem`/`SubmissionFindingsList` after the 2026-07-29 fix | `SurfaceCard.tsx:1533`, `SubmissionFindingsList.tsx:293` |
| `title` (a root prop of a composite, not inside a control) | usually `article` allows a free slot — **BUT the type is still `ReactNode`, nobody has tightened it yet** | NOT tightened yet — `Alert`, `Accordion` (atom), `Toast`, `AsyncContent`, `Feedback`, `Form`, `Disclosure`, `List`, `TitledText`, `Page`, `Section` all still have `title: ReactNode`/`title?: ReactNode` | see §4 trap #4 |
| `label` (button/input/chip/badge label) | OUTSIDE THIS AXIS'S SCOPE — system/form text, not authored content | permissive `ReactNode` across form atoms (`Input`, `Select`, `Choice`, `SearchAutocomplete`) — acceptable, since nobody authors markdown for a form label | `atoms/forms/*.tsx` |
| `subtitle` | `small richtext` (accompanies a title, one extra line of description) | Drifted: `ContinueCard`/`Navbar` are already CORRECTLY `string`; `SurfaceCard`/`List`/`TitledText` are still `ReactNode` — not tightened yet | `ContinueCard.tsx:51`, `SurfaceCard.tsx:1186` |
| `description` | `small richtext` | Type is CORRECT (`string`) on most blocks (`TrialEnrollNudge`, `EnrollGate`, `MilestoneUpNextCard`, `ProfileNotFoundState`, `PremiumGateModal`) — **BUT rendered through plain `Typography`, NOT through the `RichText` composite** because `RichText` has NO real consumer yet (see §4 trap #2) | grep "description:.*string" |
| `caption` | `small richtext` | `MermaidDiagram.caption`/`LessonVideoModal.caption` are already `string` — the render mechanism has NOT been verified to go through `RichText` versus raw Typography | `MermaidDiagram.tsx:32`, `LessonVideoModal.tsx:127` |
| `hint` | OUTSIDE SCOPE (form system text, like `label`) | `ReactNode` across `Input`/`Select`/`Choice`/`FieldFrame`/`KeyValue` — more permissive than needed but not authored content | `atoms/forms/_field/FieldFrame.tsx:35` |
| `body` (a SLOT `ReactNode` accepting a whole subtree) | **NOT a single-tier field** — it's a slot, the caller decides the tier itself when composing children | `Alert.tsx:111`, `Feedback.tsx:85/196`, `Form.tsx:55/137`, `Disclosure.tsx:44`, `DrawerShell.tsx:54` | |
| `body`/`markdownBody()` (a long documentation string) | `article` | CORRECT, rendered through `MarkdownContent` | `ChallengeBrief.tsx`, `ContentArticle.tsx` |
| `message` | depends on CONTEXT — no fixed tier for this field name alone | `SubmissionFindingsList`'s `message` was once WRONG (`article` in a `title`-context) → fixed to `title`; other `message` fields (toast, alert) have not been audited yet | see §3b #3 |

---

## 4. STRUCTURAL TRAPS — wrong not because of the tier chosen, but because the field's role was misread

1. **Fields sharing the same NAME (`title`) do not share the same ROLE.** A composite's root
   `title` prop is different from the `title` of an item inside a child array that sits in an
   accordion trigger — same name, two different sets of constraints. Reading by field NAME
   without reading the RENDER CONTEXT (inside a button or not) is the surest way to confuse
   `title ↔ article`.

2. **A mid-tier composite was BUILT but NOBODY USES IT.** `RichText.tsx` (the `small richtext`
   tier) has its own story but has **0 real consumers** besides its own story
   (`grep "import.*RichText"` turns up exactly 1 file — the story file). Every current
   `description`/`caption` renders through bare `Typography`, skipping the `small richtext`
   tier even though the type is already correctly `string`. In other words: a correct type
   does NOT guarantee a correct render mechanism — you must check BOTH.

3. **`ReactNode` is an open door, not a tier.** A field declared `ReactNode` does not sit on
   the §1 scale — it lets the caller drop `MarkdownContent` (an article) in anywhere, including
   inside an accordion trigger. The trap only surfaces once a REAL consumer actually does that
   — exactly what happened in the `SubmissionFindingsList` case. **Tightening the type
   (`ReactNode` → `string`) is a real bug fix, not cosmetic type cleanup.**

4. **Fixing one spot does not automatically spread to spots that LOOK SIMILAR.** The
   2026-07-29 round only tightened `SurfaceCardAccordionItem.title`; 11 other components
   still have untouched `title: ReactNode`/`title?: ReactNode` (`Alert`, the `Accordion` atom,
   `Toast`, `AsyncContent`, `Feedback`, `Form`, `Disclosure`, `DrawerShell`, `ModalShell`,
   `Page`, `Section`, `List`, `TitledText`). There is no evidence these components are
   CURRENTLY being misused — log it as debt, do NOT infer it as a bug that has already
   happened.

5. **Scanning-by-DATA cannot substitute for scanning-by-COMPONENT.** The fix round scanned
   `.storybook/stories/**/*.stories.tsx` for literal markdown syntax (`**`, `[text](url)`) in
   `title` fields — 0 hits. The debt does not live in the story DATA but in the component's
   TYPE (`ReactNode` allows it, the current story data simply hasn't exercised that
   permission). Concluding "0 hits ⇒ safe" is WRONG if you only scan data without scanning the
   type.

---

## 5. REAL ANCHOR — priority order when two sources clash

1. **The real component actually rendering that field** (`Typography.tsx`/`RichText.tsx`/
   `MarkdownContent.tsx`) — read what it REALLY allows, don't infer from the field name.
2. Decision tree §2 — use only when (1) hasn't resolved the role yet (root prop vs.
   item-in-array, inside a button or not).
3. `.artifacts/decompose/markdown-tier-rules.html` (2026-07-29) — the record of the teacher's
   original decision, already APPLIED to the code; use it to cross-check the original INTENT,
   not as a substitute for re-reading the real component (the artifact's line numbers may
   drift over time).

Specific anchor per branch: [`example.html`](example.html).
