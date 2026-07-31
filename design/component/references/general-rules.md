# Rules over the whole table

Read when a row has been picked and you want to know why the table is shaped this way, or when
proposing a new row. Not needed for an ordinary lookup.

## The five

1. **Look the table up BEFORE building**, not after building and then auditing. No row matches ⇒
   only then consider extending the component set, and that is **the teacher's decision**. Draw the
   proposed entry as a widget and let the teacher rule on it.

2. **DATA SHAPE decides the component, not the specific content.** "A paragraph" and "a 200-line
   markdown article" both pick `SurfaceCard`; "one line" and "eight lines" both pick
   `SurfaceCardList`. Choose by **the test**, not by eye — `SurfaceCardList` and
   `SurfaceCardAccordion` share the same skin (same `surfaceFrame`, full-bleed dividers, outer
   label and description), so a screenshot cannot tell them apart. A hidden `body` means Accordion.

3. **The component name must match the concept being rendered.** An always-one-element `items` ·
   `List` for a single paragraph · `Accordion` for something that never opens · `Chip` for a free
   number · a name with "Card" in it and no card in sight — every one of these is wrong **right at
   the data-shape level**, even though the render still looks fine and every gate stays green.

4. **The type is an invitation.** A prop named `title` declared `ReactNode` invites the caller to
   stuff markdown into it; `items` opening up `content: ReactNode` invites a loss of control.
   Tightening the type is the cheapest way to block it — and tightening requires checking the real
   cases in use (3 of 3 cases stuffing an icon into `title` ⇒ add `titleStart`, do not keep
   `ReactNode`).

5. **Every new row carries an anchor** — a date, a file, and the teacher's own words if there were
   any. One example is not a rule. Promoting it to a general rule takes **two independent sources**;
   otherwise say plainly that it is anchored to that one case.

## Reading a zero correctly

Import count in `components/starci/{blocks,pages,overlays,layouts}` at the last measurement:

`Typography` 93 · `SurfaceCard` 54 · `MarkdownContent` 19 · `SurfaceCardList` 17 · `AsyncContent` 13
· `EnumChip` 11 · `AsyncContentEmpty` 7 · `ListRow` 6 · `SurfaceCardAccordion` 4–6 · `Disclosure` 4
· `SurfaceCardPressableGroup` 3 · `SurfaceCardCrossList` 1 · `ListMeta` 1 · `RichText` 1.

**Zero real call sites:** `SurfaceCardNested` · `SurfaceCardSelectableGroup` ·
`SurfaceCardPlaceholder` · `ListLabeled` · `ListToggleRow`.

The first three have a reason — nested goes through the `variant` prop, and Selectable and
Placeholder are rare cases. `ListLabeled` and `ListToggleRow` cover a region no screen has needed
yet. **A zero does not mean the wrong component** — but it also does not license picking one
without re-checking the deciding test of its section.

## Drifts flagged on purpose, left unfixed

Written down so nobody "clears the debt" without asking, and so nobody copies them as a template.

1. **`SurfaceCardSelectableGroup`** calls the vendor's `Radio`/`RadioGroup` directly instead of
   going through the `ChoiceRadio`/`ChoiceRadioGroup` atoms — the only member of the family that
   reaches straight down into the vendor. The teacher said to leave it this pass.
2. **`ListToggleRow`** — the real branch uses a bare vendor `Switch` while the `isSkeleton` branch
   goes through the `ChoiceSwitch` atom. Two branches of **the same row** through two different
   doors. Nothing flags this in the source yet.

Same category: `HighlightChip` calls the vendor `Chip` directly with `size="sm"` and hand-draws its
own `h-6 w-20` skeleton instead of going through the `Chip` atom the way `EnumChip` does.
`MetricCard` holds an internal copy named `SectionCard` at the top of its file, with a TODO to
switch to the real local version once the cards batch finishes porting.

## Names that are not doors

`data/not-a-door.csv` — exports that exist but are only touched when editing that exact layer.
Reaching for one at the block or page layer means routing around a constraint.
`node scripts/search.mjs used-by <Name>` says so when you ask about one.
