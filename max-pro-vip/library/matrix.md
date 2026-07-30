# MATRIX — which COMPONENT for which SHAPE OF DATA

> **This is a LOOKUP table, not a catalog.** Enter from the leftmost column — *"what shape of data
> do I have in hand"* — then read rightward to exactly ONE component. Never read backward from a
> component name.
>
> The teacher confirmed 2026-07-30, at the close of the `ChallengePage/Graded` feedback session:
> *"the matrix is which situation picks what — for example label + text that needs rendering ⇒
> SurfaceCard; list-shaped data with extends ⇒ SurfaceCardAccordion; list-shaped data that's a
> checklist of tasks ⇒ SurfaceCardCrossList"*.
>
> **Open this file BEFORE typing the first line of JSX.** Not after you've already built it and
> are auditing it afterward.

---

## Why this file exists

The entire `ChallengePage/Graded` session (2026-07-30) repeated **exactly one mistake**: the right
field, the right business logic, clean `tsc`, all 10 gates green, eslint green — but **the wrong
shell chosen**.

A real anchor. A paragraph (the `ChallengeBrief` hint) was crammed into `SurfaceCardList` with
`items` whose length is **always 1**. The teacher caught it: *"why SurfaceCardList instead of just
rendering SurfaceCard and putting the text in? it's not even a list"* Before that, the same region
also nested `SurfaceCardAccordion` inside itself just to get one trigger; the teacher caught it:
*"can the feedback render as something other than a card?"* — the correct case is `Disclosure`.

No gate catches either mistake, because both are **type-valid and still look fine when rendered**.
Only the lookup table blocks them.

## Relationship to the other canon files

| File | Answers the question | Used when |
|---|---|---|
| [`house-rules.md`](../references/house-rules.md) | *"what rules outrank everything else"* | before everything |
| **`matrix.md`** (this file) | *"which COMPONENT does this content cluster take"* | while **BUILDING** |
| [`principles/`](../principles/INDEX.md) 15 axes | *"is this value (gap · font size · color) right or wrong"* | while **AUDITING** |

The order is mandatory, not a suggestion: **pick the wrong shell and all 15 axes being right means
nothing.** A `SurfaceCardList` carrying a single paragraph — gap on the right scale, font size on
the right step, color on the right token — is still wrong.

No row in this file matches my cluster ⇒ **only then** consider extending the component set. And
that is **the teacher's decision**, not something to add on your own — draw the proposed entry as a
widget and let the teacher rule on it.

## Contents

Enter by what you have in hand, not by the component you already have in mind.

| # | You are holding | Section |
|---|---|---|
| 1 | a block that needs a visible card surface | [Surfaces with a label](#1-surfaces-with-a-label--the-surfacecard-family) |
| 2 | rows or a list that needs no card | [Rows and lists without a card surface](#2-rows-and-lists-without-a-card-surface--the-list-family) |
| 3 | content that hides and shows on click | [Hide/show on click](#3-hideshow-on-click--choose-by-number-of-regions-then-by-whether-theres-a-border) |
| 4 | a string, and you must decide how it renders | [Text](#4-text--three-steps-by-string-shape-not-by-length) |
| 5 | a payload written by an author or decided by data | [Viewers](#5-payload-authored-by-a-writer-or-decided-by-data--viewers) |
| 6 | a classification label, chip, or token | [Labels, chips, tokens](#6-classification-labels--chips--tokens--four-doors-by-data-shape) |
| 7 | a number that needs a bar, ring, or tile | [Measurements](#7-measurements--bars--rings--stat-tiles) |
| 8 | label-value pairs, or a table | [Label-value pairs and tables](#8-label-value-pairs-and-tables) |
| 9 | children to arrange, with rhythm between them | [Frames and rhythm](#9-frames-and-rhythm--frames) |
| 10 | a whole page, region, or overlay | [Page, region, overlay](#10-page--region--overlay) |
| 11 | a region that can be empty, loading, or failed | [Async and empty holes](#11-async--notifications--empty-holes) |
| 12 | an input or a form | [Inputs and forms](#12-inputs-and-forms) |
| 13 | an action the user can trigger | [Buttons and actions](#13-buttons-and-actions) |
| 14 | a way to move between places | [Navigation](#14-navigation) |
| 15 | an avatar, image, or small signifier | [Identity, images, signifiers](#15-identity--images--small-signifiers) |

Closing sections: [Not a door for screen builders](#not-a-door-for-screen-builders) ·
[Real usage evidence](#real-usage-evidence--reading-zero-correctly) ·
[Two flagged drifts](#two-flagged-drifts-deliberately-unfixed) ·
[General rules](#general-rules-for-the-whole-table)

---

## 1. Surfaces WITH A LABEL — the `SurfaceCard*` family

All in one file: `composites/cards/SurfaceCard/SurfaceCard.tsx`. The label is drawn by the
**frame** via the `label` prop; the caller never builds the label itself with `Typography`.

The root deciding test, exactly two questions: **(1)** is my content ONE BLOCK or an ARRAY OF
UNIFORM ROWS? **(2)** if it's an array — does each row have a HIDDEN part, and is the row
PRESSABLE?

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| ONE free-form block: a paragraph, markdown, a JSX cluster I assembled myself | **`SurfaceCard`** | `children` / `body` (+ `header`, `footer`) | `SurfaceCardList` — an array of length 1 is the wrong concept at the DATA-SHAPE level |
| The whole block is PRESSABLE (a card that links somewhere) | **`SurfaceCard`** + `onPress` / `href` | `isPressable` is inferred automatically | don't look for `SurfaceCard.Pressable` — that export no longer exists |
| A FLAT array of rows, one row per line, usually pressable | **`SurfaceCardList`** | `items[]` — `title`/`subtitle`/`leadingIcon`/`metaText`/`trailingIcon`, or free-form `content` | `SurfaceCardAccordion` if the row doesn't expand; `ListLabeled` if a card surface is NOT needed |
| An array of EXPANDABLE rows (trigger + hidden body) | **`SurfaceCardAccordion`** | `items[]` — `id` · `title` (**plain string**) · `body` | `Disclosure` if there is only ONE collapsible region |
| An array of READ-ONLY rows carrying a check / cross / pending mark | **`SurfaceCardCrossList`** | `items[]` — `text` + `mark: check\|cross\|pending\|none` + `tone` | `SurfaceCardList` — the source states plainly *"Read-only; for CLICKABLE rows use SurfaceCardList"* |
| An array of sections, each with a multi-line BODY, needing a QUIET label bar INSIDE the frame | **`SurfaceCardNested`** | `items[]` — `eyebrow`/`title`/`content`, or `children` | `SurfaceCardList` — Nested deliberately has NO leading/meta/trailing/selected/verdict |
| A GRID of press-and-done tiles (rate a level, pick an entry point, a large-tile menu) | **`SurfaceCardPressableGroup`** | `items[]` + `onPress`/`href` + `ariaLabel` | `SurfaceCardSelectableGroup` if you don't need one-of-N selection rules |
| A GRID of tiles that is a real one-of-N selection CONTROL | **`SurfaceCardSelectableGroup`** | `items[]` + `value` + `onChange` + `ariaLabel` | `SurfaceCardPressableGroup` — a different **DOM contract**, not a different style |
| A dashed "create new" tile at the end of a card grid | **`SurfaceCardPlaceholder`** | `icon` + `label` + `onPress` (no children) | using it as an empty state is wrong — List/Accordion already have their own `emptyState` |

**A card sitting INSIDE another surface** (modal, drawer, panel, another card) ⇒ **don't change the
component**, just turn on `variant="nested"` — a border STANDS IN for the shadow, since the shadow
is invisible on the parent surface. `SurfaceCard`/`SurfaceCardList`/`SurfaceCardAccordion`/
`SurfaceCardCrossList` all already have this axis.

**Highlighting something on the screen** ⇒ the `isHighlight` prop of `SurfaceCard` itself, don't
wrap another layer around it.

### Forbidden in this section

- **`items` whose length is ALWAYS 1 ⇒ wrong family chosen.** A paragraph is not a one-element
  list. Anchored 2026-07-30 round-12 · `ChallengeBrief.tsx:240` — the hint went through THREE
  shapes in one day (`SurfaceCardAccordion` → `SurfaceCardList` → `SurfaceCard` + `label`). An
  always-length-1 array drags in a meaningless between-row divider and a meaningless `key`.
- **If the frame already has a `label`, don't build a second label inside it.** Same case as
  above: keeping the accordion and adding `label="Hint"` makes the label appear TWICE (the card
  header plus the trigger of the single item), because an accordion item is **required** to have a
  `title`.
- **`title` of `SurfaceCardAccordionItem` is a `string`, ABSOLUTELY PLAIN.** No markdown, not even
  backtick. Anchored 2026-07-30 round-2 (the teacher confirmed) — **reverses** the 2026-07-29
  decision, which had still left a `parseInlineCode` exception. A color icon goes into
  `titleStart`/`titleEnd` instead, because an icon placed inside `title` gets forced to
  `currentColor` (caught for real in `ChallengeDeliverableList.tsx`: a failed row turned the whole
  "1. Write the API" line red, following the icon).
- **A REPEATING frame takes `items`; `children` is FORBIDDEN** (the FRAME API rule, the teacher
  2026-07-25): applies to `SurfaceCardList` · `SurfaceCardAccordion` · `SurfaceCardCrossList` ·
  `SurfaceCardPressableGroup` · `SurfaceCardSelectableGroup`. `children` stays legal only on
  WRAPPING frames (`SurfaceCard`, `SurfaceCardNested`).
- **Don't stuff a block that already has its own card surface into the `content` slot of
  `SurfaceCardList`** — the slot already has its own `p-3` + hover + separator; adding `rounded-3xl
  shadow-surface` on top DOUBLES the chrome. Anchor: `ContentPager`, `QaQuestionThread`.
- **Skeleton trap to remember:** `isSkeleton` on `SurfaceCardList` **only** flows down the FIXED
  row path; the FREE-FORM path (`item.content`) is **skipped entirely**. Going the `content` route
  means you must build your own mirror (anchor: `ChallengeBrief.tsx:57` → `PlaygroundSetupSteps`
  duplicates the precedent).
- `isSkeleton` on a **pressable** card means something different from a regular card: pressable
  **fully replaces** children with a generic mirror tile; a regular card only shimmers the
  self-drawn frame parts (`label`/`description`).
- Old comments in `blocks/` still write `SurfaceCard.Pressable`, `SurfaceCard.List`. The namespace
  has been **fully flattened**; `.Pressable` was DELETED 2026-07-29 (the teacher: *"why is there
  still .Pressable, isn't it all just the isPressable prop now?"*). Read the comment for intent,
  but write code against the real export.

---

## 2. Rows and lists WITHOUT a card surface — the `List*` family

`composites/lists/List/List.tsx`. Same shape as the `SurfaceCard*` family above, differing on
**exactly one axis**: whether there's a `bg-surface` or not.

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| EXACTLY ONE GitHub-style row, placed into a frame I already have | **`ListRow`** | props `leading`/`title`/`subtitle`/`meta`/`trailing` (+ `href`/`onPress`) | don't `.map` it N times to fake a list |
| A label + an ARRAY of short rows (+ one button), placed somewhere that ALREADY has an outer surface | **`ListLabeled`** | `items[]` (= `ListRowProps` + `key`) + `label`/`icon`/`action`/`emptyState` | `SurfaceCardList` if this cluster needs its own surface |
| A few meta fragments on ONE line, joined with ` · ` | **`ListMeta`** | `chip?` + `items[]` — each element is one fragment | don't hand-type `·` + `mx-1` at the call site |
| A settings row: name + explanation + a switch | **`ListToggleRow`** | props `label`/`description`/`checked`/`onCheckedChange` | `ListRow` if the right side is a chip/number/caret, not a switch |
| Content authored by ONE PERSON: avatar + identity line + body/nested replies | **`IdentityContentRow`** | `byline` (node) + `children` (node); `nested` draws the indent guide | don't expect it to draw a card surface — wrap `SurfaceCard` if you need one |

### Forbidden in this section

- **An array of rows is DATA.** With a card surface ⇒ `SurfaceCardList`. Without a card surface ⇒
  `ListLabeled`. Never a hand-rolled `.map(ListRow)`: `ListRow` is `py-2`, no surface, no
  full-bleed separator.
- **Don't hand-roll a pressable row with `<button>` + flex/icon/chevron.** Anchor:
  `PersonalProjectTaskPage.tsx:88` states plainly *"THE SETTINGS SUMMARY ROW REUSES `ListRow`, not
  a hand-rolled button"* — the `src` version built its own, and that is exactly the mistake of
  *"reaching for the bare atom instead of the composite this system already owns"*.
- **Don't hand-build a check/cross list from icon + `MarkdownContent` inside `StackH` then `.map`.** Anchor
  for the CORRECT choice, `MockInterviewScorecard.tsx:42`: *"`SurfaceCardCrossList` REPLACES A
  HAND-ROLLED ROW LIST"* — hand-rolling it just rebuilds an existing composite, down to the
  divider and the skeleton row count.
- **There are TWO things named `ListRow`**: the public export in `lists/List/List.tsx` (`py-2`, no
  surface, `div role="button"`) and an **internal** component of the same name inside
  `SurfaceCard.tsx` that builds `SurfaceCardList` rows (`p-3`, full-bleed separator, a real
  `<button>`, has verdict/selected). Don't confuse them.
- **`ListLabeled` has ZERO real call sites** — every labeled list in practice ends up choosing
  `SurfaceCardList`. About to use `ListLabeled`? Check again: does that spot have a **real** outer
  surface?
- Lesson from `IdentityContentRow` (the teacher, 2026-07-29, revised **twice in one day**): the
  first call was *"all 3 seams tight"*, then after seeing the real render, the avatar↔column gap
  was changed to `grouped`. **A gap decision made before seeing the render is provisional** — don't
  treat the first call as the final one just because it was stated with confidence.

---

## 3. Hide/show on click — choose by NUMBER OF REGIONS, then by WHETHER THERE'S A BORDER

Two **independent** questions, asked in order: **(1)** count the number of collapsible regions.
**(2)** is there an outer background/border/radius/padding?

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| ONE collapsible region, NO border needed | **`Disclosure`** (`composites/layout/Disclosure`) | `title` (inline trigger label) + `body` / `children` | `SurfaceCardAccordion` — it's a real card surface; with one item the label says itself twice |
| ≥2 uniform regions, WITH a card surface | **`SurfaceCardAccordion`** | `items[]` + `label`/`description`/`emptyState` | `Disclosure` — it doesn't repeat, has no `items` |
| ≥2 uniform regions, NO card surface needed | **`Accordion`** (atom, `atoms/navigation/Accordion`) | `items[]` — `key`/`title`/`content` | `SurfaceCardAccordion` if you don't want a surface |
| Clicking opens a panel **OUTSIDE**, not an inline region | **`ListRow`** (pressable row) + **`DrawerShell`** | `ListRow` trailing caret; content lives in the drawer | `Disclosure` — the source names `TaskSubmissionPanel` as exactly this case |

### Forbidden in this section

- **Don't nest `SurfaceCardAccordion` inside itself just to get one trigger.** Anchored 2026-07-30
  round-4→5: doing this produces two nested card layers; the teacher caught it: *"can the feedback
  render as something other than a card?"* — the right case is `Disclosure`.
- **Don't rebuild `Disclosure` from the HeroUI headless `Disclosure` compound.** That compound
  defaults to a `justify-between` trigger + a TRAILING caret; our house shape is a LEADING caret +
  hug-width. It's deliberately hand-rolled, stated explicitly in the file.
- **`Disclosure` is a PRESENTATION decision, not a fabricated field.** Anchor
  `ChallengeDeliverableList.tsx:296` (the teacher confirmed round-10, held through round-13): the
  content inside is still exactly one real field (`shortFeedback`), just sitting behind a click
  because it's a secondary detail. The path to this shape was a chain of **removals**: removing
  the per-line finding list (measured against the real DB: one attempt reaching EIGHT findings × 3
  fields ⇒ burying the submission form under two dozen lines), removing recursive accordion +
  color-coded severity text (rounds 4-7, *"built before there was a real anchor"*).
- `SurfaceCardAccordion` opens/closes as **ONE group identity**, not N autonomous panels. Needing
  each panel to have its own independent two-way diff is a different case
  (`MockInterviewScorecard` cut its scope correctly for exactly this reason, not because it was
  used wrong).

---

## 4. Text — THREE STEPS by STRING SHAPE, not by length

The hard boundary between step 2↔3 is **block-level**: `MarkdownContent` emits block markup and
drives its own vertical rhythm, so it **cannot legally nest** inside a `<button>`/trigger/inline
label; `RichText` emits inline markup, so it can nest anywhere.

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| A PLAIN string, no markers at all | **`Typography`** (atom) | `text` (ReactNode) — **not children** | `RichText` — adds a pointless parsing layer |
| A string that may contain backtick, but MUST stay inline (inside a `<button>`, a trigger) | **`Typography`** + `parseInlineCode` | `text` | `MarkdownContent` — block-level markup inside a `<button>` is invalid HTML |
| A string carrying a small CLOSED set of markers: `code` · **bold** · _italic_ · `[link]()` · `\n` | **`RichText`** (`composites/viewers`) | `text: string` + `size`/`color` | `MarkdownContent` — this string has no block content at all |
| The string is a DOCUMENT: heading · bullet · table · fence · house directive | **`MarkdownContent`** | `source: string` + `measure: reading\|compact` | `RichText` — it doesn't emit block-level markup |
| A field schema declared as type "text" whose author typed markers into it anyway | **`stripMarkdown`** (`atoms/text/_markdown.ts`) then feed into `Typography` | parameter `markdown: string` → `string` | don't "clean it up" and still expect formatting to render — it STRIPS, it doesn't convert |
| A PAIR (or triplet) of text lines that read as ONE idea: title + subtitle (+ hint) | **`TitledText`** (`composites/text`) | props `title`/`subtitle`/`hint` + `size: row\|header\|stat` | don't stack two or three `Typography` next to each other by hand |
| ONE horizontal line: a leading icon + a label, the SAME tone | **`InlineIconLabel`** (`composites/text`) | `icon` (**bare** node) + `children` + `tone`/`size` | `Chip` if the value belongs to a CLOSED set; `TitledText` if the axis is VERTICAL |
| A NUMBER + unit in a trailing slot: "N points" | **`ScoreValue`** (`composites/text`) | `points: number` (+ `unit`) | **NEVER** `Chip` |

### Forbidden in this section

- **A TITLE/HEADLINE field is always at step 1.** At most backtick via `parseInlineCode`, **never**
  bold/italic/link. The teacher confirmed 2026-07-29, SSOT is
  `.artifacts/decompose/markdown-tier-rules.html` (*"markdown is only accepted in articles, and
  richtext is only for small text"*). The doc comment in `RichText.tsx:145` was edited to remove
  the word "titles" from its usage example.
  **The test:** strip all formatting and the reader can still tell "what am I looking at" ⇒ it's a
  title; if the formatting **CARRIES** information ⇒ it's small richtext.
- **THE TYPE MUST MATCH THE INTENT.** A prop named `title` declared as `ReactNode` is **inviting**
  the caller to stuff markdown/JSX into it. Anchor 2026-07-29: `SurfaceCardAccordionItem.title` was
  tightened `ReactNode → string` + `titleStart` added. The scan turned up 4 violations, 2
  unexpected; the worst was `SubmissionFindingsList.tsx` rendering **a full `MarkdownContent`
  right inside the trigger `<button>`**.
- **`ScoreValue` is never a `Chip`.** A Chip is a pill for values belonging to a **CLOSED set**; a
  rubric score is a free scalar number, not a classification of anything ⇒ it's TEXT. Anchor
  2026-07-29: the same info-type "N points" used to render as a Chip in
  `ChallengeBrief`/`TaskBriefBody`/`PersonalProjectTaskPage` but as bare text in
  `ChallengeDeliverableList` — one info-type, two elements. Round two, 2026-07-30: `color="accent"`
  was also removed, with `ChallengeHeader` kept muted as the control case, reasoning *"a raw
  number is not a classified fact"*.
- **"text" vs "body" is a DELIBERATE boundary at the content layer, not a minor detail.** Anchor
  2026-07-30 round-3 · `ChallengeBrief.tsx:190` (the teacher confirmed): `prerequisites`/`outputs`
  **were reverted** from markdown back to plain, undoing the round-2 decision that had matched
  `src/ChallengeView`. The measured reason: the backend content-authoring schema names the fields
  entirely differently — `outputs`/`prerequisites` are just `lang` + **TEXT**, while
  `requirements`/`steps` are `lang` + `title` + **BODY**. Blocked with `stripMarkdown` right at the
  render boundary, because authors still type backtick out of habit.
- **Don't pass JSX into an atom's `icon`/`prefixIcon` prop** — it takes a **COMPONENT REF**
  (`icon={TrayIcon}`), the atom forces its own scale + weight. And `InlineIconLabel` takes a
  **bare** icon; the call site is not allowed to set its own size (§5 icon-ownership).
- **Don't wrap `Typography` inside something that already wraps text itself.** `InlineIconLabel`
  always wraps its child in `HeroTypography` ⇒ nesting a link `Typography` inside it is
  text-inside-text (anchor `ProfileHero.tsx:70`: the social link uses `Typography isLink`, only
  the two non-link meta rows use `InlineIconLabel`). HeroUI's `Radio.Content` will **throw**.
- `Typography`: the `isSkeleton` branch must be checked **BEFORE** any `size` branch, otherwise
  `size="h3" isSkeleton` renders an EMPTY heading — a silent bug that `tsc`/eslint won't catch.
- `Typography` must OWN its own values defensively (AUDIT 2026-07-30 round-1/3/6): `weight` falls
  back to `font-normal` **explicitly** (because HeroUI's `.accordion__trigger { font-medium }`
  leaks in, measured as 500 on the DOM), and every branch reads `COLOR_CLS[color ?? "default"]`
  (because `.accordion__body-inner { color: var(--muted) }` leaks through any gap where color
  isn't declared).
- `MarkdownContent` **has NOT yet ported**: `arcSections`, `plain` mode ("render as raw text"),
  ```` ```mdx ```` live-render fence, ```` ```layout ```` fence. Need one of these four? **Don't pick it and
  assume it's there** — every gate here will let it through anyway.

---

## 5. Payload authored by a WRITER or decided by DATA — viewers

Common thread: **the shape is decided by the payload**, the component doesn't know in advance.

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| A markdown string with full block content (even if it's just a single fenced command) | **`MarkdownContent`** | `source: string` + `measure` | don't hand-build a `<pre>` — a ```` ```bash ```` fence already has its own copy button + mono chrome |
| A code block that **doesn't** come from markdown (API response, a hand-built snippet) | **`CodeToHtml`** | `code` + `language` + `theme` | don't call it when the code is already inside a fence — `map.tsx` already dispatches it |
| TWO already-rendered nodes: a demo + a source, flipping between them | **`CodePreviewTabs`** | `preview` + `code` (ReactNode) | don't call it when all you have is a markdown string containing `:::tab` |
| A mermaid diagram as TEXT, standing on its own | **`MermaidDiagram`** | `code: string` + UI labels passed via prop | don't call it when the mermaid is inside a document — it's already auto-dispatched, calling it by hand duplicates it |
| Graph DATA with ready-made nodes/edges, needing drag-zoom | **`FlowDiagram`** | `nodes[]` + `edges[]`; nodes use `FLOW_DIAGRAM_CARD_NODE_TYPE` | `MermaidDiagram` — it takes TEXT and outputs a static SVG |
| A path to a PDF file, viewed right on the page | **`PDFView`** | `src` + `title` | `MarkdownContent` — this is a binary file, not text content |

### Forbidden in this section

- **`map.tsx` is the ONE place in the entire blueprint where hand-written spacing is CORRECT.** A
  viewer never sees its children as a node (it only sees what the parser returns), so **there is
  no seam for a frame to own** — the same §13z exemption granted to the atom layer, for the same
  reason.
- **Parser glue is NOT a door for screen builders:** `buildMarkdownRenderers` · `TabsBlock` ·
  `TabPane` · `MarkdownTable` · `MarkdownTableHead`/`Body`/`Row`/`Column` ·
  `flattenMarkdownTableHeaderChildren` · `isMarkdownHeaderTableRowNode`. Touch these only when
  **editing markdown grammar**. My real DATA table ⇒ section 8 (`Table`).
- **Don't hand-build a parallel `ReactMarkdown` with its own separate map** — it splits the
  grammar into two versions.
- **Two skeleton layers, don't confuse them:** `isSkeleton` means *"the whole payload hasn't
  arrived yet"* (shimmer the full footprint, don't mount the heavy runtime). Entirely different
  from a partial internal shimmer (a PDF page not yet scrolled to, a code block not yet
  highlighted).
- `MarkdownContent` has only had `isSkeleton` **since 2026-07-29**; before that, call sites faked
  it with an unrelated `Typography isSkeleton`. `TabsExtended` **never** has one ⇒
  `PlaygroundSetupSteps` must build its own mirror, and **deliberately does not borrow** the real
  part's `data-anat-part` (borrowing it is a broken link in the anatomy panel).
- Operational note: `PDFView` loads the pdf.js worker from the unpkg CDN ⇒ its canvas needs
  NETWORK access in Storybook (only the `src=""` story runs offline). `MermaidDiagram`/
  `CodeToHtml` take UI labels via **prop** because this layer has no runtime i18n.

---

## 6. Classification labels · chips · tokens — four doors by DATA SHAPE

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| ONE short label with a FREE value (a lone tag, a color-dot chip) | **`Chip`** (atom, `atoms/chips/Chip/ChipBase.tsx`) | `text` (REQUIRED, children forbidden) + `icon` (component ref) or `dotColor`/`dotClassName` | `EnumChip` if there's a mapping table |
| N labels at the SAME LEVEL, same tone, needing an overflow `+N` cutoff | **`ChipGroup`** (atom) | `items[]` (`key`/`text`) + `maxVisible` + `tone` **shared across the whole row** | don't use it if each label has its own tone — a rainbow row |
| ONE value from a CLOSED set + a value→color/label mapping table | **`EnumChip`** (composite) | `value` + `map` (a missing entry **THROWS**, no silent fallback) | `Chip` — wherever there's a map, the color rule lives there |
| A NUMBER + unit printed INSIDE THE SAME pill ("24 Modules") | **`HighlightChip`** | `value` + `label` (+ `icon`) | `Chip` — it only takes a single `text` |
| ONE ALREADY-SELECTED item, a full-width bordered row, with a Change / × button | **`RemovableToken`** | `label` + `icon` (bare) + `onEdit`/`onRemove` | `Chip` + `onRemove` — that's a 24px pill; using it here blows out the row |
| A pure scalar/count ("482 students") | **muted text** (`Typography`) | | |
| NO chip, NO icon (README atom §1) | | | |

### Forbidden in this section

- **`EnumChip.icon` is a closed string selector `"check" \| "cross"`, NOT an icon reference.**
  Anchor 2026-07-30 round-2 (the teacher confirmed): icon-per-entry was added, but added in a way
  that **TIGHTENS** — *"narrowing down to a curated set is the entire point of a house-wide
  symbol"*. Open the union only when a **THIRD** symbol meets the bar — don't loosen the type.
- **Don't place two chips side by side stating the SAME fact.** If a verdict already has the tone
  + icon of a callout, a second chip is two signals competing — make the chip state a
  **DIFFERENT** fact.
- **Don't pass `size` to `Chip`** — there is exactly one size, HeroUI's native size. §4a forbids
  stepping it down to fix the look at one call site (anchor: a `md→sm` + `px-2` downgrade slipped
  in because the chip inside `PriceTag` looked too big).
- **Design-layer chips do NOT fold into this family:** `DifficultyChip` · `AiCategoryChip` ·
  `LanguageChip` · `HostPlatformChip` live one layer up — they are not members of the house chip
  family.
- **Color vocabulary is an ALIAS, not re-declared:** `EnumChipColor` = `ChipTone`,
  `HighlightChipTone` = `ChipTone` (the teacher confirmed 2026-07-29 — before that a
  `COLOR_TO_TONE` translator existed between two hand-copied versions; once it became an alias
  the translation was a no-op, so it was DELETED). But `ChipTone` **SPLIT FROM** `AlertStatus`
  2026-07-30 round-9, because `AlertStatus` added `"info"` while `HeroChip.color` has no such
  value ⇒ chip is left with 5 values, **no `info`**.
- The canonical name is the file name + its own story name (`EnumChip`/`HighlightChip`/
  `RemovableToken`); the aliases `ChipEnum`/`ChipHighlight`/`ChipRemovable` only exist in the
  merged gallery.
- `StatusChip` and `Chip.Dot` were **DELETED** 2026-07-26 (the dot became the `dotColor` prop;
  `StatusChip` only hardcoded `tone` and added no other behavior).

---

## 7. Measurements — bars · rings · stat tiles

Choose a bar with exactly one question: **"how many TOTALS?"** Choose a stat tile with: **"who
supplies the surface + what does the cell hold?"**

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| ONE ratio over ONE total, read as a thin horizontal bar | **`ProgressMeter`** (`composites/stats`) | `value` (+ `max`, `label`, `showValue`, `target`) | `SegmentBar` — that's multiple components |
| The same ratio but needs to be a round FOCAL block with a number in the middle | **`ProgressRing`** | `value` (+ `label`, `caption`, `size`) | `ProgressMeter` — different **placement**, not different data |
| MULTIPLE categories with the SAME unit sharing ONE common total | **`SegmentBar`** | `segments[]` + `ariaLabel` **required** | `CourseProgressBar` — equal-width lanes would lie about the composition |
| MULTIPLE dimensions, each with its OWN total, on different scales of unit | **`CourseProgressBar`** | `dims[]` (`completed`/`total`) + `ariaLabel` | `SegmentBar` — the JSDoc states plainly *"Deliberately NOT SegmentBar"* |
| A color-meaning key, with the colored shape living SOMEWHERE ELSE | **`Legend`** | `items[]` (`label`/`color`/`suffix`) | don't add it when SegmentBar/CourseProgressBar are already in use — they render their own Legend |
| A number+label pair, placed somewhere that ALREADY has a surface | **`StatPair`** | `value` + `label` + `valueType` | `MetricCard` — frame nested inside frame |
| ONE metric standing alone, needing its own card frame | **`MetricCard`** | `value` + `label` (+ `hint`) | don't line up N of them side by side to fake a ribbon |
| 3-4 numbers at the SAME LEVEL reading as ONE continuous ribbon | **`StatRibbon`** | `items[]` locked to `{value,label}` | `StatGridCard` if every cell really is just a number-label pair |
| MULTIPLE cells, each more complex than a number-label pair (icon + meter + multiple lines) | **`StatGridCard`** | `items[]` with **free-form** `content: ReactNode` | `StatRibbon` — its `items` is locked down |
| A task that's CURRENTLY RUNNING, ratio known or unknown | **`ProgressBar`** / **`ProgressCircle`** (atom) | `value` + `max` + `isIndeterminate` | `ProgressGauge` — it has no indeterminate state |
| A static, always-determinate MEASUREMENT (storage, battery, score) | **`ProgressGauge`** (atom) | `value` + `max` | `ProgressBar` — picking wrong makes the screen reader announce the wrong role (meter vs progressbar) |

### Forbidden in this section

- **`SegmentBar`'s width is a REAL ratio** (`flexGrow: value`, `flexBasis: 0`) — a commitment
  stated in the source: *"never relative-to-max"*. Slices sit flush against each other with no gap
  so the bar reads as ONE continuous line.
- **Don't duplicate the Legend.** `SegmentBar` and `CourseProgressBar` render their own `Legend`
  underneath (turn it off with `hideLegend`). `Legend` is also **not** `ChipGroup`: a color dot +
  muted text explaining a COLOR, not a row of token pills.
- **The target mark = `h-1 bg-muted rounded-none`, FLUSH with the track, label attached directly
  with no offset.** Anchored 2026-07-30 round-14 (the teacher: *"the mark's a bit too tall, the
  color doesn't make sense"*, *"make it rounded-none"*, *"why offset it? don't offset it"*). It
  used to be `h-5 w-1 bg-accent` — 5x taller than the thing it's marking, and the SAME tone as the
  fill, so one color was carrying two meanings ("achieved" vs "target needed"). `bg-muted` is
  deliberately outside the danger/warning/success set so the fill **alone** answers "pass or not".
- `ProgressMeterTargetMark` is almost **never called directly** — `ProgressMeter` builds it itself
  when `target` is passed. It's `absolute`-anchored to the bar's containing block; standing alone
  it will drift.
- **Skeleton is its own axis, not a variant:** everything in this section (except `StatGridCard`
  and `ProgressMeterTargetMark`) uses the union `{ isSkeleton: true; data? } | { isSkeleton?:
  false; data }` ⇒ building the resting state **needs no fabricated fake data**. Those two
  exceptions are the caller's own responsibility.
- `StatPair` has **no** `isSkeleton` of its own ⇒ anchor `ProfileFollowers`: the block **rejects**
  StatPair and goes straight to `Typography` (`size="h5" tabularNums` + `size="xs"` muted), because
  otherwise it would need to build a mirror right next to it — two shapes for one number.

---

## 8. Label-value pairs and tables

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| EXACTLY ONE "one name, one number" row (or one standalone TOTAL row) | **`KeyValueRow`** (`composites/data/KeyValue`) | `label` + `value` (+ `hint`, `emphasis`, `divider`) | don't `.map` it into N rows |
| MULTIPLE "one name, one number" rows of the same kind | **`KeyValueList`** | `items[]` + `gap` (`SeamScale`) + `divider` | `Table` — `columns` + a header is overkill for two columns |
| N records, each with ≥3 fields that need to LINE UP IN COLUMNS | **`Table`** (`composites/data/Table`) | `columns[]` + `items[]` + `ariaLabel` **required** | `KeyValueList` — it has no columns/header |

### Forbidden in this section

- **COMPOSITE API LAW, stated in the file:** a composite **does NOT format**
  money/dates/units/status — the consumer passes an **already-formatted** node (`"1,200,000 ₫"`,
  `<Chip/>`). A composite also **does NOT compute totals** itself; `emphasis` is purely visual
  STRESS. And `Table` does **NOT** sort/filter/paginate/select.
- **`Table`'s `ariaLabel` is REQUIRED** because react-aria's `Table` has no implicit label —
  without it the whole table reads out unnamed, and `tsc`/eslint **will NOT catch it**.
- §10a *"one seam, one owner"*: `KeyValueList` owns the divider decision — the LAST row gets no
  divider (`index < items.length - 1`), and the spacing above/below the divider shares the list's
  `gap`.
- `Table` alignment trap: `text-right` must be placed on the WRAPPING SPAN (`CellBox`), not on
  `<th>/<td>` — HeroUI's CSS `.table__column { text-align: left }` is **un-layered**, so it beats
  the Tailwind v4 utility inside `@layer utilities`.

---

## 9. Frames and rhythm — `frames/`

The axis is something I choose, not something the component guesses. Full decision tree:
[`principles/frame/context.md`](principles/frame/context.md).

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| Several DIFFERENT-KIND blocks stacked VERTICALLY | **`StackV`** | `children`; `gap` **REQUIRED** | `Flex direction="col"` — StackV already forwards `padding` and `as` |
| Several DIFFERENT-KIND things on ONE row | **`StackH`** | `children` (+ `wrap`) | `Cluster` if it's N elements of the same kind |
| An ARRAY of SMALL, SAME-KIND elements that wrap on their own (chips, tags, a row of buttons) | **`Cluster`** | `items[]` (`key`/`content`); `separator` turns on the `·` mark | `StackH` — the §13b test decides this, not the eye |
| An ARRAY of UNIFORM cells divided by COLUMN COUNT at container-query steps | **`Grid`** | `items[]` (+ `span?: 1\|2`); `columns` **REQUIRED** | `Cluster` if the cells keep their own intrinsic width |
| A row that needs to CHANGE DISPLAY TYPE by step (narrow grid → flex splitting width evenly) | **`ResponsiveRow`** | `items[]` + `columns` (cap `1\|2`) + `at` | `Grid` — its display is fixed, can't split evenly |
| EXACTLY TWO NAMED SIDES: leading ↔ trailing | **`Split`** | slot `start` / `end` (no children) | `StackH justify="between"` — only looks alike to the EYE |
| TWO PAGE-SIZE regions: a reading column + a 360px STICKY rail from `@app-xl` | **`SplitWorkspace`** | slot `main` / `aside` | `StackH wrap` + two `StackV` — that fake version is a BUG documented in the file |
| A region needing a READABLE WIDTH CAP | **`Container`** | slot `body` (`children` is shorthand) | `StackV` — it has no `max-w`/`mx-auto` |
| An internal flex box for the frame layer | **`Flex`** | | |
| **NEVER** call it from outside `components/frames/` | | | |
| Declaring `gap` | **`SeamScale`** | `flush` · `tight` · `related` · `grouped` · `section` · `page` (+ `baseline`) | don't hand-type `gap-4`/`gap-5`/`gap-1.5` — can't be typed |
| Declaring `padding` | **`InsetScale`** | `flush` · `snug` · `cozy` · `roomy` · `airy` | don't use `SeamScale`'s vocabulary for padding, and vice versa |

**Content contract per §13b, stated plainly:** a frame that **WRAPS** free-form content ⇒
`children` (`StackV`/`StackH`/`Container`/`Flex`). A frame that **REPEATS** a list ⇒ `items` DATA,
`children` **FORBIDDEN** (`Cluster`/`Grid`/`ResponsiveRow`). A frame with **MULTIPLE ROLES** ⇒
**NAMED** slots, no children (`Split` start/end · `SplitWorkspace` main/aside).

### Forbidden in this section

- **`Flex` is the ONLY PLACE in the entire blueprint allowed to write `flex` · `flex-col` ·
  `flex-wrap` · `items-*` · `justify-*` · `gap-*`.** And it itself is **INTERNAL to the frame
  layer**: the source states *"nothing outside `components/frames/` may call it"*; it's only
  exported because `Stack.tsx` imports it (verified: exactly ONE import, `Stack.tsx:6`). It
  follows that the composite/block/layout/page layers **hand-write no flex/gap at all, and never
  call `Flex`** — only `StackV`/`StackH`. The reason, stated in the source: *"A public frame that
  can do everything the constrained one can is not a second option, it is the way the constraint
  gets bypassed."*
- **Container queries, NOT viewport.** Every responsive step uses `@app-sm/md/lg/xl` because the
  app shell is split, and a docked AI rail can squeeze the column. Tailwind's built-in
  `@sm`/`@md`/`@lg` is a **DIFFERENT, HALF-SIZE** scale (`@sm`=24rem vs `@app-sm`=40rem) — using it
  by mistake **silently halves every breakpoint**. `Container` is the ONLY frame that opens
  `@container`; `Grid` deliberately does **not**.
- **Don't swap `max-w-app-*` for `max-w-3xl`/`5xl` to "tidy up"** — the numbers happen to match
  today but come from a DIFFERENT SOURCE; if the token changes, the width and the breakpoint drift
  apart silently, and no error catches it.
- **Don't try to cram a third thing into `Split`** — the two named slots exist to **close off** the
  question "which child goes where". Measured anchor: this row pattern appears **43×** across the
  app; `min-w-0` for start and `shrink-0` for end are applied in ONE place instead of at 43 call
  sites.
- **`SplitWorkspace` HARD-OWNS every measurement** (`gap-6/8`, `w-[360px]`, `top-24`,
  `max-h-[calc(100dvh-7rem)]`) — identical across both `src` sources. Only add a prop when a real
  **THIRD** consumer disagrees with one of the numbers. Anchor, the teacher 2026-07-29 (*"desktop
  should render as flex, right?"*): `main` has `min-w-0 flex-1`, so a fake version built with
  `StackH wrap` **almost never actually wraps** ⇒ split renders side-by-side at EVERY width,
  including mobile.
- **Don't let a child carry its own margin.** §10a: a seam has EXACTLY ONE owner, and the owner is
  the PARENT. Anchor: a hand-typed `mx-1` next to a `·` mark was caught by the `check-padding` gate
  2026-07-27 — the breathing room around `·` comes from whitespace in the STRING ITSELF.
- **The enforcement mechanism — this is the sole reason a frame owns `gap`:** `gap`/`padding` are
  union literals and `gap` is always REQUIRED ⇒ off-scale is a **`tsc` error at the call site**,
  not a finding discovered after review. The teacher, 2026-07-27: *"the caller picks a variant,
  not a step"* — 72% of call sites land on the two hardest-to-distinguish steps (50 spots at `3`,
  43 spots at `2`); a **number** lets the author pick whatever LOOKS right and the reasoning never
  makes it into the code; a **word** forces them to answer for it.
- The easiest pair to confuse, `related` ↔ `grouped`: swap the two items and the meaning doesn't
  change ⇒ they're peers ⇒ `related`. Order carries meaning, or each line is a different kind of
  thing ⇒ lines belonging to one facet ⇒ `grouped`.
- Lesson from `snug` (`_spacing.ts`): the first count only inspected the `padding` **prop**, so it
  concluded "nobody uses `p-2`" and shipped a 4-step scale — but 34 real call sites wrote `p-2` as
  a **class** and sailed straight past the very gate built to catch it. **A count that covers only
  ONE way of writing something will undercount, and any scale derived from it inherits the blind
  spot; a gate checking against the WRONG SCALE is worse than no gate at all, because silence
  reads as agreement.**

---

## 10. Page · region · overlay

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| Opening a ROUTE: breadcrumb · page name · description · trailing button · meta strip | **`PageHeader`** (`composites/layout/Page`) | `breadcrumb`/`title`/`description`/`actions`/`meta` + `size: page\|compact` | `SectionHeader` — it has no breadcrumb/meta |
| The heading of a REGION inside a page, needing to step down a level when nested | **`SectionHeader`** (`composites/layout/Section`) | `eyebrow`/`title`/`description`/`action` + `level: 1\|2\|3` | `PageHeader` — count how many appear on one page |
| "A region heading + one content block (+ a closing line)" stacked vertically at one rhythm | **`Section`** | `header` (props OR node) · `body` · `footer` · `gap` | `SectionCard` if you need a bordered SURFACE — Section is the frame AROUND a surface |
| A CTA row pinned to the bottom of the VIEWPORT | **`PageBottomBar`** | `body` (leading, usually a price) + `actions` | the shell's `footer` — that anchors to a dialog |
| A short self-contained flow that needs to block the screen, width set by `size` | **`ModalShell`** | `title`+`description` OR `header` (node) · `body` · `footer` | `DrawerShell` — it has `placement`, not `size` |
| A LONG panel sliding in from the EDGE of the screen | **`DrawerShell`** | same as above + `placement` + `contentClassName` | `ModalShell` — a drawer runs full-bleed along the edge |
| Content that is exactly "one question + its consequence + two buttons" | **`FeedbackConfirm`** (`composites/feedback`) | `title`/`description`/`confirmLabel`/`cancelLabel`/`tone`/`isConfirming` | `ModalShell` — but the moment you add ANYTHING beyond those three things, switch to ModalShell |

The label row above a card is already a frame prop (`label`/`labelEnd`/`onSeeMore`/`action` —
`SurfaceCard`/`SurfaceCardList`/`SurfaceCardAccordion` all `extends SurfaceLabelProps`).
`SurfaceCardHeader` is almost **never called directly**.

### Forbidden in this section

- **Don't hand-roll `<div className="flex justify-end gap-2">` inside a Modal/Drawer's `body`** —
  that's exactly what `footer` is for, and `Modal.Footer`/`Drawer.Footer` already have their own
  `justify-end gap-2`. Pass **BARE** buttons.
- **THE PARENT KEEPS THE RHYTHM** (the teacher confirmed 2026-07-27): `gap-3` on `Modal.Dialog`
  decides the seam; the child only uses `mt-0!` to **TURN OFF** the margin HeroUI ships by
  default. ONE seam, ONE owner (§10a).
- **A FRAME MAY NOT ASK WHAT KIND OF CONTENT IS INSIDE IT.** Anchored in the same round: the
  `bodyStartsWithTabs` prop was **DELETED** — it forced the caller to declare *"my body opens with
  tabs"* so the frame could subtract 4px; that 4px is `Tabs`'s own geometry, and `Tabs` itself
  must own it (§13z).
- **Don't hand-build a `header` node for `Section`/`SectionHeader` when all you have is
  title/description/action** — pass PROPS and let the frame build it. The node is an **escape
  hatch** for an unusual header (a toolbar row), not the main path.
- **Don't expect `FeedbackConfirm` to close itself after confirming** — the caller must call
  `onOpenChange(false)` once the action resolves. And it **does not expose `children`**: there is
  no door to stuff extra content in.
- `PageHeader.anatPart` exists so the **PARENT can name it as ONE node** (§11a.1) — without this
  prop the parent is forced to pass `showAnatomy` down, cracking open the child's insides and
  letting the grandchild leak out as if it were a sibling. That is the **ROOT** of an entire class
  of bug, not a symptom (deep-scan 2026-07-27).
- A real bug fixed with TWO NESTED divs (the teacher, 2026-07-29): `@container` measures **its own
  content-box, MINUS its own padding** ⇒ putting `p-*` on the same div as `@container` silently
  shrinks the measured width; at `size="xl"` the cap lands on exactly the same token, so
  `@app-xl` **never fires**, confirmed live: `SplitWorkspace` inside `Container size="xl"` got
  stuck at `flex-col` even at a 1920px window. Now the OUTER div holds `@container` + `max-w` (no
  padding), the INNER div holds the padding.
- `Page.Container` was moved over to `frames/Container/Container` as of 2026-07-26 (§13c: a
  duplicate frame gets deleted — the old version only had right-padding, no `mx-auto`/`max-w`).
  `Container`'s `Section` `header`/`footer` slots were also DELETED 2026-07-27 for being a weaker
  copy of `StackV`; the correct pairing is **`Container` > `StackV`**.

---

## 11. Async · notifications · empty holes

Two questions: **(1)** the shape of the PLACEMENT — a strip inside a surface, or a centered hole?
**(2)** HEIGHT — is this an async region or not?

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| A data-loading region that needs all four branches in ONE place, and I'm at the **BLOCK** layer | **`AsyncContent`** (`composites/async`) | `content` (`children`) · `skeleton` (node) · `emptyContent`/`errorContent` (**PROPS**, not a node) + `isLoading`/`isEmpty`/`error` | don't use it at the **SCREEN** layer |
| "Nothing here yet" + at most one way out | **`AsyncContentEmpty`** | props `title`/`description`/`icon` (component ref)/`action`, or `onRetry`+`retryLabel` | bare `FeedbackEmpty` if that region is an async region |
| "Fetching data failed, try again" | **`AsyncContentError`** | same as above; usually declared as `const errorContent: AsyncContentErrorProps = {…}` | rendering it directly at the screen layer |
| An EMPTY HOLE where I want to CHOOSE the size myself (compact one-liner / default / a 404 page with a `code`) | **`FeedbackEmpty`** | `code`/`icon`/`title`/`description`/`body`/`action` + `size`/`tone` | `AsyncContentEmpty` if it isn't an async region |
| A toned note sitting INSIDE a surface, CTA is a text label | **`FeedbackCallout`** | `status`/`title`/`description`/`body` + `actionLabel`+`onAction` | bare `Alert` — Callout already picked `tone="soft"` + builds its own button |
| Need the exact house alert SURFACE, and decide placement myself | **`Alert`** (atom) | `status`/`tone`/`title`/`description`/`body`/`action` (node) | don't `import { Alert } from "@heroui/react"` |
| A FLOATING result notification | **`Toast`** (atom) | `status` (picks its own icon) + `title` + `description` + `action` | `Popover` — that's a click-to-open panel |
| Just need to say "running", no ratio at all | **`Spinner`** (atom) | `size` + `tone` (`current` follows the parent's text color) + `label` | `isSkeleton` if the loading shape should MIRROR the frame about to appear |
| Shimmer for the shape a component draws itself | **that component's own `isSkeleton`** | a prop, flowing straight down to the atom | there is no shared skeleton component (§12c) |

### Forbidden in this section

- **`AsyncContent` is NOT used at the SCREEN layer.** Anchor `PlaygroundPreparePage.tsx:35` —
  *"CORRECTING THE PLANNER'S TREE — NO `AsyncContent.Base` AT THIS TIER"*: the planner proposed
  wiring the screen straight into a four-branch switch, exactly the mistake of *"rebuilt a worse
  version from a bare part instead of reusing the whole thing"*. Every screen was scanned before
  writing this: no screen imports `AsyncContent`/`AsyncContentError`. `QuizPage` states the rule
  outright: *"a screen calls blocks and frames, never a composite directly"*. More evidence: none
  of the five blocks on that screen has an `error` prop ⇒ fabricating one at the screen layer is
  fabricating a state that no part can even express.
- **THE ONE DOCUMENTED EXCEPTION:** `AsyncContentEmpty` is imported at the screen layer
  (`CourseContents`, `ModulePage`, `FoundationResourcePage`, `QuizPage`, `PlaygroundPreparePage`)
  — and **only when it replaces the ENTIRE BODY of the screen**, not as a node for one phase.
- **Don't wrap `AsyncContent` around a frame that ALREADY has its own `isSkeleton` +
  `emptyState`.** The deciding test: *does this region have one bounded surface that must persist
  through EVERY state?* Yes ⇒ use the frame's own axis; no ⇒ use the switch. Anchor for two
  different choices made **on the same screen**, with the reasoning documented:
  `SubmissionFindingsList` takes `SurfaceCardAccordion`'s own `isSkeleton`/`emptyState` axis (the
  "Feedback" section must read as the same bounded surface whether shimmering/empty/erroring/
  full), while `SubmissionAttemptSelector` **does** wrap `AsyncContent` (a chip strip has no frame
  to lose).
- **PARTIAL reuse is legitimate:** `SubmissionFindingsList` judgement 3 — *"ERROR STILL REUSES
  `AsyncContent` — just its MESSAGE frames, not its switch"*: `AsyncContentError` is passed in as
  the accordion's `emptyState` (with `items=[]`) so the retry message renders **bounded** inside
  the same card surface; error still beats `isLoading`, mirroring the correct priority order.
- **Don't hand-build a `Button` for `FeedbackCallout`'s CTA** — pass `actionLabel`+`onAction`, the
  frame builds the button itself and applies the status-based skin automatically
  (`CALLOUT_ACTION_CLASS` is INTERNAL, the teacher confirmed 2026-07-25, exactly so the screen
  never has to touch an atom).
- **`Alert` is the ONLY GATE down to HeroUI's Alert.** Before 2026-07-25 each side imported it
  independently and kept its own color table/close logic, so "fix one, fix all" applied. And
  `Alert` **has no `children`**: free-form content only goes through `body` (§12b).
- **`AsyncContent`'s CONTRACT TRAP, invisible unless you read the source:** leaving `errorContent`
  empty ⇒ the error branch **DOES NOT ACTIVATE**, the frame falls through to loading/empty/content
  (deliberate, preserving the old contract). Leaving `emptyContent` empty ⇒ the empty branch
  renders `null`, the region **HIDES ITSELF** (a "silent empty branch").
- **`FeedbackEmpty size="compact"` SILENTLY drops** `icon`/`description`/`body`/`action`/`code` —
  pass them in and they still won't render, leaving only a dim title. `size="page"` does **not**
  wrap its own surface.
- The three message families form a **COMPOSITION CHAIN**, not three parallel choices: `Alert` →
  (`FeedbackCallout` = Alert + soft + builds its own CTA from text) and (`Toast` = Alert + plain);
  `FeedbackEmpty` → (`AsyncContentEmpty`/`AsyncContentError` = a THIN layer that only adds a
  default Tray/Warning glyph, forces duotone, and wraps `onRetry` into a button).
- `Alert.status` gained `"info"` 2026-07-30 round-9 — a neutral tone DIFFERENT from `accent` (the
  brand's pink active-state). Gotcha: `HeroAlert.status` is a CLOSED union that never had `info` ⇒
  `"default"` gets passed down to the vendor, and the atom's three info-aware tables decide the
  real color via className.

---

## 12. Inputs and forms

Form atoms **CARRY THEIR OWN** `label`/`hint`/`errorMessage`/`isRequired` (the teacher confirmed
2026-07-25 — the old `Field.*` layer has been **DELETED**, §12e/§13c). There is no component for
"wrapping a label around a field".

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| A SHORT one-line string | **`InputText`** | `value` + `onValueChange` | `InputSearch` if it's a query |
| A LONG multi-line block of text | **`InputTextarea`** | `value` + `rows` | `InputText` |
| A countable NUMBER, with a stepper | **`InputNumber`** | `value: number` + `min`/`max`/`step` | `InputCurrency` if it's money |
| A MONEY amount the user enters | **`InputCurrency`** | `value: number` + `currency` | `PricePoint` — that's a display atom |
| A DATE (segments + a calendar popover) | **`InputDate`** | `value: DateValue\|null` | `InputTime` |
| A TIME of day, no calendar | **`InputTime`** | `value: TimeValue\|null` | `InputDate` |
| A QUERY string, with results shown SOMEWHERE ELSE | **`InputSearch`** | `value` + `onValueChange` | `SelectCombobox`/`SearchAutocomplete` if you need a dropdown |
| A SECRET string, masked characters + an eye toggle | **`InputPassword`** | `value` | `InputText` |
| A verification code typed one character per box | **`InputOtp`** | `value: string` + `length` | `InputNumber` |
| An ARRAY of FREE labels the user makes up themselves | **`InputTags`** | `value: string[]` | `SelectMulti` if the set is fixed |
| A FIXED option set, picking EXACTLY ONE, collapsed into a compact trigger | **`SelectSingle`** | `options[]` + `value` | `ChoiceRadioGroup` if there are 2-4 choices that need to all stay visible |
| A fixed option set, choosing MULTIPLE | **`SelectMulti`** | `options[]` + `value: string[]` | `InputTags` if there's no fixed list |
| A long list that's ALREADY on the client, type to filter then pick one | **`SelectCombobox`** | `options[]` + `value`; react-aria **filters on its own** | `SearchAutocomplete` — it does NOT filter |
| Suggestions FETCHED per keystroke, each row has a description, needs a spinner | **`SearchAutocomplete`** | `inputValue` + `items[]` + `onSelect` + `isLoading`; **the parent handles filtering/fetching** | `SelectCombobox` — it filters locally on its own |
| A BOOLEAN the user checks before submitting | **`ChoiceCheckbox`** | `isSelected` + `label` | `ChoiceSwitch` |
| 2-5 MUTUALLY EXCLUSIVE choices, all visible at once | **`ChoiceRadioGroup`** | `options[]` + `value` + `groupLabel` | `ButtonRadioGroup` if it's a row of config buttons |
| A toggle setting that takes effect IMMEDIATELY | **`ChoiceSwitch`** | `isSelected` + `label` | `ChoiceCheckbox` |
| ANY file of any type, I declare the mime + size myself | **`Dropzone`** | `file` + `acceptedMimeTypes` + `maxSizeInBytes` + `hint` | `ImageDropzone` if it's definitely an image |
| An IMAGE file, the image rules already known in advance | **`ImageDropzone`** | `onFile` + `label` + `hint` + `icon` (component) | `Dropzone` — it makes you re-declare the rules |
| A field cluster that needs Enter-to-submit + locking the whole cluster while submitting | **`Form`** | `body` (`children`) + `actions` + `gap` + `onSubmit` | don't expect it to handle validation |
| A long form needing field GROUPS with a title | **`FormSection`** | `title` + `description` + `body` | using it as a display card — it has no surface |
| The final button row of a form, needing right-alignment or sticking to a modal's bottom | **`FormActions`** | `items[]` (same shape as `ButtonGroup`) + `align` + `sticky` | `ButtonGroup` if the button row sits in the middle of the content |
| Writing a NEW FORM ATOM | **`FieldFrame`** | `label`/`hint`/`errorMessage` + `children` (control) | don't use it at the block/page layer |

### Forbidden in this section

- **Don't wrap an extra label frame around a form atom** — the atom already carries its own,
  wrapping another is **two layers of label** (§12e).
- **`Form.*` handles LAYOUT ONLY.** No validation, no values, no field errors: the
  label-description-error belongs to the atom, business rules belong to the block layer.
- **`ChoiceRadio` cannot stand alone** — the source states: *"a lone radio can't stand on its own
  — description · error · required are the GROUP's business"*. Need a whole group ⇒
  `ChoiceRadioGroup` + `options`.
- **`SearchAutocomplete` does NOT filter locally** — the prop doc states plainly *"this block does
  NOT filter locally"*; the parent is responsible for filtering/fetching. This is the sole
  boundary with `SelectCombobox`.
- **`items` is required for every REPEATING list** in this section: `FormActions` ·
  `ChoiceRadioGroup` · `Select*`. `children` is only valid on `FieldFrame` (wrapping a control)
  and the wrapping frames `Form`/`FormSection`.
- `ImageDropzone` exposes `isDragActive?: boolean` (2026-07-26) to pin the drag state from
  outside — that state normally only lives inside `useDropzone`, so a story couldn't force it
  otherwise.

---

## 13. Buttons and actions

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| EXACTLY ONE action the user clicks to do | **`Button`** (atom) | `label` (children forbidden) + `prefixIcon`/`suffixIcon` (**component**) + `onPress` | `ButtonGroup` if there are N actions on the same row |
| A button with only an icon | **`Button`** + `isIconOnly` | `prefixIcon` + `ariaLabel` (both required), omit `label` | don't look for `Button.Icon` — DELETED 2026-07-26 |
| A row of 2-3 SEPARATE actions side by side (Cancel · Save) | **`ButtonGroup`** | `items[]` + `size` at the CLUSTER level | `ButtonRadioGroup` if the row carries a SELECTED state |
| A row of CONFIG/FILTER buttons, press-to-SELECT, wraps onto new lines | **`ButtonRadioGroup`** | `items[]` + `value`/`onChange` (or `values`/`onToggle`) + `itemAction` | `ChoiceRadioGroup` if this is a field with a label/error |
| A ROW of same-shaped suggestion buttons (sample-question chips, quick-ask) | **`ChipButtonList`** (`composites/buttons`) | `items[]` + `direction: wrap\|column` | `ButtonGroup` — this is a uniform row, not 2-3 different roles |
| A FLOATING round button in the bottom-right corner that opens an overlay | **`FloatingActionButton`** | `icon` (bare) + `ariaLabel` + `onPress` | `Button isIconOnly` — a FAB hardcodes fixed + shadow + z-index |
| A box that LOOKS like a field but clicking opens a command palette | **`InputButtonLike`** | `placeholder` + `icon` + `suffix` + `onPress` | `InputSearch` — this one holds no value at all |
| "See more →" / "Continue →" next to a group heading | **`LinkSeeMore`** (atom) | `label` + `onPress`/`href` + `decorative` | `Button` — this is a text-link, not a button |
| EXACTLY ONE way back, in the top-left corner | **`LinkBack`** (atom) | `label` or `target` + `onPress` | `Breadcrumbs` if you need the full ancestor trail |

### Forbidden in this section

- **`ButtonRadioGroup` absolutely forbids `primary`** — selected = NEUTRAL `tertiary`, unselected
  = `ghost`. A config row usually sits on the same surface as the page's **single accent CTA**.
- **`ButtonGroup` ≠ `ButtonRadioGroup` is a REAL DIFFERENCE IN FORM, not just a new prop:** Group
  = N separate stateless actions (just `onPress`); RadioGroup = one STATEFUL CONTROL
  (`role="group"` + `aria-pressed`).
- **Don't hand-roll a suggestion chip row again** — `ChipButtonList` was consolidated from 4
  nearly-identical call sites inside `ContentAiChat`; anywhere that shape is needed, compose THIS
  composite.
- **Don't let `LinkSeeMore` render its own `<a>` when it sits INSIDE a card that's already
  pressable as a whole block** — turn on `decorative` instead of nesting two press targets.
- **react-aria's `isPending` does NOT draw a spinner on its own** — the atom renders it by hand.
  Anchor: this is a recurring trap; a button with it always needs `{isPending ? <Spinner/> :
  <Icon/>}`.
- Button variant has **7** values (`button-tokens.ts`, §15, added 2026-07-29): `tertiary` is a
  SECONDARY action and is the **MOST used** variant in real `src` (77 call sites), but the atom
  didn't have it before; `outline` is rare (6 call sites).
- Outstanding debt: `ChipButtonList` and `FloatingActionButton` still import `Button` from
  `_legacy/designs/buttons/Button/Button`, not the current atom.

---

## 14. Navigation

Four rungs of **the same** tab problem: pure-data `items` → the caller builds the tree when each
tab needs its own chrome → a row with TWO tab groups on either side → that row sitting inside a
card surface.

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| 2-5 panels at the SAME LEVEL, tabs only need text (+ icon/count) | **`Tabs`** (atom) | `items[]` + `selectedKey` + `ariaLabel` | `TabsExtended` if the tabs don't need their own chrome |
| Tabs where EACH tab carries its own surface details (muted tone, hidden label on mobile) | **`TabsExtended`** (atom) | `children` = the tree `Tabs.ListContainer > Tabs.List > Tabs.Tab` | `Tabs` — `TabItem` can't carry the caller's three axes |
| TWO tab groups at either end of one row (+ an action cluster) | **`Toolbar`** (`composites/navigation`) | `leftTabs`/`rightTabs` (data) + `leftEnd` (node) | don't expect a background/border/radius from it — it's a BARE flex row |
| That tab row LIVES INSIDE a card surface | **`DoubleTabsCard`** | same as Toolbar + `children` is the card body | don't hand-assemble `SurfaceCard` + `Toolbar` yourself |
| The ANCESTOR chain root → current, clickable back up | **`Breadcrumbs`** (atom) | `items[]` + `maxItems`/`collapseOnMobile`/`collapseFrom` | `LinkBack` if you only need ONE destination to go back to |
| A paginated list, TOTAL PAGE COUNT known | **`Pagination`** (atom) | `currentPage` + `totalPages` + `siblings` | `Stepper` — that's an ordered flow |
| A sequential multi-STEP flow, showing which step you're on | **`Stepper`** (`composites/navigation`) | `steps[]` + `currentIndex`; `onStepPress` only on steps ALREADY DONE | `Tabs` — steps don't switch freely |
| A single numbered step badge sitting alone inside content | **`StepBadge`** (atom) | `number` + `state: done\|active\|muted` | `Badge` — that's an unread count hanging off a corner |
| A set of separate ACTIONS collapsed into a trigger button | **`Menu`** (atom) | `items[]` or `sections[]` + `onAction` + `triggerLabel` | `Popover` if what opens is a content panel |
| A secondary content block that only shows on CLICK | **`Popover`** (atom) | `content` (node) + `heading` + `triggerLabel` | `Tooltip` — that's hover, doesn't accept interaction |
| A short annotation on HOVER/focus over an existing element | **`Tooltip`** (atom) | `children` = TRIGGER + `label` | `Popover` — tooltip is max-width 260px |

### Forbidden in this section

- **`Toolbar` has NO background/border/radius/padding.** The old name `TabsCard` was **renamed
  2026-07-25** precisely because it was a lie: there's no card in it at all.
- **Don't force `Tooltip` into a `triggerLabel`** — react-aria must attach hover/
  `aria-describedby` directly onto the exact element the caller supplies. `Tooltip` and `Badge`
  are the **ONLY TWO atoms** allowed to keep `children`.
- **Don't use `Tabs` when the items are ordered STEPS (`Stepper`) or an ancestor path
  (`Breadcrumbs`).** Picking wrong makes the entire navigation structure misstate the relationship
  between items.
- `TabsExtended` **is not §12b debt** but a **named exception** (re-reviewed 2026-07-26): forcing
  it into `items` would cram the caller's three axes into the atom — a violation in the opposite
  direction, and a worse one.
- `TabsExtended variant="secondary"` depends on the **GLOBAL** class `.extended-tabs` in
  `src/app/globals.css` ⇒ changing its look means going over to `src` (§0 `boundary.md`).
- `StepBadge` anchor 2026-07-26 — a case **OPPOSITE** the usual mistake: `weight="bold"` used to
  be hardcoded across both sizes, making the `md` step **bolder** than every other `size-5` glyph.
  Scanning in the "missing bold" direction wouldn't have caught it.
- Markdown's `::::accordion` used to go through the **`Accordion` atom** — the wrong primitive,
  with no hook for surface chrome; now it uses the HeroUI Accordion compound directly with
  `variant="default"` to keep the full-bleed separator.
- `InfoTooltip` was **REMOVED** from the Feedback family under §13c — use the `Tooltip` atom
  directly; the dashed-underline convention for terms is a component at the **design layer** (like
  `GlossaryTerm`).

---

## 15. Identity · images · small signifiers

| I have | Choose | Content entry point | Don't choose |
|---|---|---|---|
| The face of ONE person, image not guaranteed | **`Avatar`** (atom) | `src` + `seed`/`name` + `icon`; fallback chain image→DiceBear→initials→icon | `UserCell` if you need the whole row of name + handle |
| MULTIPLE overlapping faces + an overflow count | **`AvatarGroup`** (atom) | `items[]` + `max` + `total`; `size` at the CLUSTER level | don't set `size` on each item (§12d) |
| An identity ROW for one person in a list (+ a button/chip on the right) | **`UserCell`** (atom) | `username` + `displayName`/`avatar`/`handle` + `trailing` | `Avatar` if all you need is the face |
| An image URL that might be missing/broken, needing shimmer + fallback | **`Image`** (atom) | `src` + `alt` + `ratio` + `fallbackSrc` | `CoverImage` if it's definitely a 16:9 cover |
| The COVER image of an entity, house-standard frame | **`CoverImage`** (atom) | `src` + `alt` (hardcoded 16:9 + `rounded-2xl`) | `Image` — CoverImage doesn't accept `ratio`/`fallbackSrc` |
| A tinted square signifying a TYPE/topic | **`IconTile`** (atom) | `icon` (component) or `src` + `tone` + `size` | `Avatar` if it's a human face |
| A string payload that needs to be phone-scannable | **`QRCode`** (atom) | `data` + `size` + `icon` | a bitmap generated by an external CDN, requiring NETWORK access |
| The StarCi brand mark | **`Logo`** (atom) | only `className` (size + position) | don't pass color/variant — there is exactly one color |
| An unread count / presence dot hanging off the corner of an element | **`Badge`** (atom) | `children` (the element it hangs off of) + `count`/`dot` + `placement` | `StepBadge` — that's a stateful STEP number |
| A dividing line between two blocks (or an "OR" line) | **`Divider`** (atom) | `label` (optional) + `orientation` | `ThreadConnector` if it's a curved line connecting avatars |
| A curved path connecting a parent avatar down to a reply row | **`ThreadConnector`** (atom) | only `className` (position); height hardcoded to `h-4` | don't change it to `self-stretch` |
| A short line that needs a quick copy (a command, an API key) | **`SnippetIcon`** (atom) | `copyString` + `isCopied` (pinned) | don't use it inside a multi-line code block — that needs a Toast |
| The price of a PACKAGE/TIER, already formatted | **`PricePoint`** (atom) | `amount` + `original` + `period` + `size` | `InputCurrency` — that's an input field |
| A cluster that is NOT a `SurfaceCard` and needs a sweeping highlight ring | **`HighlightCard`** (composite) | `children` (wraps a whole already-built tree) | if what I'm wrapping IS a `SurfaceCard` ⇒ the `isHighlight` prop |

### Forbidden in this section

- **A SIGNAL FROM DATA vs DECORATION — don't swap them.** The 2px LEFT-edge band
  (`verdictBandClassName`, `withVerdict` — used on `SurfaceCardList` items and
  `SurfaceCardPressableGroup` tiles) is a signal **FROM DATA**. The sweeping highlight ring
  (`isHighlight`/`HighlightCard`) is **purely decorative**, and must not be used as a signal.
- **Don't wrap `HighlightCard` around a `SurfaceCard`** — the teacher, 2026-07-26 *"just add
  isHighlight"*: wrapping two layers for one job is wrong, and filing a decorator into the Cards
  family files it under the wrong family. And **don't highlight two cards on the same surface** —
  two highlights cancel each other out.
- **Don't open a backdoor letting the caller smear a class onto an atom's internal icon** —
  anchor 2026-07-26: `SnippetIcon`'s `classNames.copyIcon`/`checkIcon` were deleted, violating §4.
- The `isHighlight` effect lives in the **GLOBAL** class `.highlight-card-sweep` in
  `src/app/globals.css` ⇒ changing the effect means going over to `src`. `isSkeleton=true`
  **TURNS OFF** the sweep layer (a skeleton has no verdict yet, so it must not read as
  highlighted). Anchor, the teacher 2026-07-29: the non-pressable branch was missing `relative`,
  so the sweep covered OVER the content, cutting across the CTA button.
- **`Avatar` must listen to `onLoadingStatusChange`, not `onError`** — HeroUI only mounts the
  `<img>` **after** loading finishes, so `onError` never fires. `UserAvatar` was merged into
  `Avatar` 2026-07-26; DiceBear is the DEFAULT face.
- `IconTileTone` is an **ALIAS** of `AlertStatus` (the neutral case is called `default`, not a
  separately declared `neutral`) — the teacher confirmed 2026-07-29. Same rule applies to
  `InlineIconLabel.tone` and `SurfaceCardListItem.leadingIconColor`.
- `Divider` and `ThreadConnector` have **no** `isSkeleton` — they're static lines. `Spinner`
  doesn't either, because it **IS ITSELF** the loading indicator.
- Note that `href` vs `onPress` are **two different hover languages** (the teacher, 2026-07-29):
  `href` = LINK (just `.group` + underline-on-group-hover, NO ripple/press-scale); `onPress` =
  ACTION (ripple + `active:scale-[0.97]`).

---

## Not a door for screen builders

Has an export name but is **only touched when editing that exact layer**. Choosing one of these
at the block/page layer means you're routing around a constraint:

| Name | Belongs to | Only touch when |
|---|---|---|
| `Flex` | frame | editing `frames/Stack` |
| `SurfaceCardHeader`, `surfaceFrame`, `surfaceSectionGap` | composite | hand-building a non-card cluster that still must match the label row |
| `FieldFrame` | atom | writing a NEW FORM ATOM |
| `ProgressMeterTargetMark` | composite | hand-building a different track that needs the exact target mark |
| `buildMarkdownRenderers`, `TabsBlock`, `TabPane`, `MarkdownTable*`, `flattenMarkdownTableHeaderChildren`, `isMarkdownHeaderTableRowNode` | composite | editing markdown GRAMMAR in `map.tsx` |
| `MarkdownMeasure`, `FLOW_DIAGRAM_CARD_NODE_TYPE`, `FlowDiagramCardNodeData` | type/constant | declaring a prop or building data — **don't hardcode a string** in their place |

---

## Real usage evidence — reading zero correctly

File count with an import in `components/starci/{blocks,pages,overlays,layouts}`:

`Typography` 93 · `SurfaceCard` 54 · `MarkdownContent` 19 · `SurfaceCardList` 17 · `AsyncContent` 13
· `EnumChip` 11 · `AsyncContentEmpty` 7 · `ListRow` 6 · `SurfaceCardAccordion` 4-6 · `Disclosure` 4
· `SurfaceCardPressableGroup` 3 · `SurfaceCardCrossList` 1 · `ListMeta` 1 · `RichText` 1.

**ZERO real call sites:** `SurfaceCardNested` · `SurfaceCardSelectableGroup` ·
`SurfaceCardPlaceholder` · `ListLabeled` · `ListToggleRow`.

The first three have a clear reason (nested goes through the `variant` prop; Selectable/Placeholder
are rare cases). `ListLabeled`/`ListToggleRow` are a region no screen has needed yet. **Don't read
zero as "wrong component"** — but also **don't pick them without re-checking the deciding test** in
sections 1 and 2.

---

## Two FLAGGED drifts, deliberately unfixed

Written down here so no one "fixes it for us" thinking they're clearing debt, and so no one copies
them as a template:

1. **`SurfaceCardSelectableGroup`** calls HeroUI's `Radio`/`RadioGroup` DIRECTLY instead of going
   through the `ChoiceRadio`/`ChoiceRadioGroup` atoms — the only member of the family that reaches
   straight down into HeroUI. The teacher said to leave it as-is this pass.
2. **`ListToggleRow`** — the real branch uses a bare HeroUI `Switch`, while the `isSkeleton` branch
   goes through the `ChoiceSwitch` atom: two branches of **the same row** go through two different
   doors. No comment flags this yet.

Same category: `HighlightChip` calls HeroUI's `Chip` directly with `size="sm"` and hand-draws its
own `h-6 w-20` skeleton, instead of going through the `Chip` atom the way `EnumChip` does.
`MetricCard` has an internal COPY named `SectionCard` at the top of the file, with a TODO to switch
to the real local version once the cards batch finishes porting.

---

## General rules for the whole table

1. **LOOK UP THIS TABLE BEFORE BUILDING**, not after building and then auditing afterward. No row
   matches ⇒ only then consider extending the component set, and that is **the teacher's
   decision** (`boundary.md` §2.3).
2. **DATA SHAPE decides the component, not the specific content.** "A paragraph" and "a 200-line
   markdown article" both pick `SurfaceCard`; "one line" and "eight lines" both pick
   `SurfaceCardList`. Choose by **the test**, not by eye — `SurfaceCardList` and
   `SurfaceCardAccordion` share the same skin (same `surfaceFrame` + full-bleed dividers + outer
   label/description), so a screenshot can't tell them apart: a hidden `body` means Accordion.
3. **THE COMPONENT NAME MUST MATCH THE CONCEPT BEING RENDERED.** An always-one-element `items` ·
   `List` for a single paragraph · `Accordion` for something that doesn't need to open · `Chip`
   for a free number · `Toolbar`'s old name `TabsCard` with no card in sight at all — every one of
   these is the wrong concept **right at the data-shape level**, even though the render still
   "looks fine" and every gate stays green.
4. **THE TYPE IS AN INVITATION.** A prop named `title` declared as `ReactNode` is inviting the
   caller to stuff markdown into it; `items` opening up `content: ReactNode` is inviting a loss of
   control. Tightening the type is the cheapest way to block it, and tightening requires checking
   the real cases currently in use (3/3 cases stuffing an icon into `title` ⇒ add `titleStart`,
   don't keep `ReactNode`).
5. **EVERY NEW ROW MUST CARRY AN ANCHOR** (date + file + the teacher's own words if there are
   any). One example is not a rule: promoting it to a general rule requires **two independent
   sources**, otherwise state plainly that it's anchored to that one specific case
   (`principles/INDEX.md`).
