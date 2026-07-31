# Traps, per section

Not a lookup table — open this only when a row is picked and something still feels off, or when
auditing a screen someone else built. `node scripts/search.mjs traps <section>` prints one block
without loading the rest.

Every entry is anchored: a date, a file, and the teacher's own words where there were any. An
entry with no anchor is a claim, not a rule.


---

## surface-card

> Surfaces WITH A LABEL — the `SurfaceCard*` family — section 1 of the source table.

**A card sitting INSIDE another surface** (modal, drawer, panel, another card) ⇒ **don't change the
component**, just turn on `variant="nested"` — a border STANDS IN for the shadow, since the shadow
is invisible on the parent surface. `SurfaceCard`/`SurfaceCardList`/`SurfaceCardAccordion`/
`SurfaceCardCrossList` all already have this axis.

**Highlighting something on the screen** ⇒ the `isHighlight` prop of `SurfaceCard` itself, don't
wrap another layer around it.

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

## list

> Rows and lists WITHOUT a card surface — the `List*` family — section 2 of the source table.

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

## disclosure

> Hide/show on click — choose by NUMBER OF REGIONS, then by WHETHER THERE'S A BORDER — section 3 of the source table.

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

## text

> Text — THREE STEPS by STRING SHAPE, not by length — section 4 of the source table.

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

## viewer

> Payload authored by a WRITER or decided by DATA — viewers — section 5 of the source table.

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

## label

> Classification labels · chips · tokens — four doors by DATA SHAPE — section 6 of the source table.

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

## measure

> Measurements — bars · rings · stat tiles — section 7 of the source table.

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

## pair

> Label-value pairs and tables — section 8 of the source table.

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

## frame

> Frames and rhythm — `frames/` — section 9 of the source table.

**Content contract per §13b, stated plainly:** a frame that **WRAPS** free-form content ⇒
`children` (`StackV`/`StackH`/`Container`/`Flex`). A frame that **REPEATS** a list ⇒ `items` DATA,
`children` **FORBIDDEN** (`Cluster`/`Grid`/`ResponsiveRow`). A frame with **MULTIPLE ROLES** ⇒
**NAMED** slots, no children (`Split` start/end · `SplitWorkspace` main/aside).

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

## page

> Page · region · overlay — section 10 of the source table.

The label row above a card is already a frame prop (`label`/`labelEnd`/`onSeeMore`/`action` —
`SurfaceCard`/`SurfaceCardList`/`SurfaceCardAccordion` all `extends SurfaceLabelProps`).
`SurfaceCardHeader` is almost **never called directly**.

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

## async

> Async · notifications · empty holes — section 11 of the source table.

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

## form

> Inputs and forms — section 12 of the source table.

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

## button

> Buttons and actions — section 13 of the source table.

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

## nav

> Navigation — section 14 of the source table.

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

## identity

> Identity · images · small signifiers — section 15 of the source table.

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
