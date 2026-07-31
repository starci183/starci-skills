# composite — in a real system

A reusable shape, assembled from atoms inside frames, that knows no domain.

The rule is in [`../elements/composite.md`](../elements/composite.md). This is one system obeying it,
named so every row can be checked.

## cards · lists · layout

| Component | Renders | Why this tier |
|---|---|---|
| `SurfaceCard` | a labelled card surface with header, body, footer | props are **slots**, not fields — it will hold a course, an invoice or a ticket unchanged |
| `HighlightCard` | a card that stands out from its neighbours | prominence is a shape decision, not a domain one |
| `List` | uniform rows without a card surface | takes `items` of one shape |
| `IdentityContentRow` | a face beside a block of content | a pairing, still no entity |
| `Section` | a region heading plus one content block | arrangement plus a heading slot |
| `Page` | the page-level heading and its actions | chrome for a page; the page itself is a tier up |
| `Disclosure` | one collapsible region | one region — the *array* version is a card family |
| `ModalShell` · `DrawerShell` | the covering surface, focus trap included | shell only; the overlay tier places it |

## stats · data · text · viewers

| Component | Renders | Why this tier |
|---|---|---|
| `ProgressRing` | a ratio as a ring with a number inside | takes a number and a label; does not know what is measured |
| `ProgressMeter` | the same ratio as a bar | different **placement**, same data — that is why both exist |
| `SegmentBar` | several totals in one bar | the bar-with-one-total is a different component on purpose |
| `MetricCard` · `StatPair` · `StatGridCard` | a number with its label, alone or in a grid | shapes for numbers, no unit logic |
| `CourseProgressBar` | a bar with a target mark | borderline: the name carries a domain word the props do not |
| `Legend` | a colour-to-meaning key | a closed list of pairs |
| `KeyValue` · `Table` | label-value pairs, and rows of one record | the two shapes data takes when it is read, not acted on |
| `TitledText` · `InlineIconLabel` · `ScoreValue` | text with a title, with an icon, as a score | text shapes — the atom renders the string, these arrange it |
| `MarkdownContent` | authored markdown with block-level markup | cannot nest inside a button — that boundary is why it is not `RichText` |
| `RichText` | inline markup only | nests anywhere; the same reason, inverted |
| `FlowDiagram` · `PDFView` | a payload whose shape the data decides | the component does not know the shape in advance |

## async · chips · buttons

| Component | Renders | Why this tier |
|---|---|---|
| `AsyncContent` | the empty, loading and error holes | the shapes a region takes when it has no content — the *decision* is a block's |
| `EnumChip` | one value from a closed set, mapped to a colour | the map is passed in; a missing entry throws rather than guessing |
| `RemovableToken` | an already-chosen item with a remove control | a full-width row, which is why it is not a chip |
| `ChipButtonList` | a row of same-shaped suggestion buttons | uniform row ⇒ `items`, not `children` |
| `Toolbar` · `Stepper` · `DoubleTabsCard` | tab rows and step rails | navigation shapes with no destination knowledge |

## Roughly as many composites as atoms

The two tiers grow together, and that is the healthy signal: each new shape gets named once, here,
instead of being re-assembled at each call site. When composites pull far ahead, shapes are being
rebuilt out of raw parts.

---

Read from a live tree with `scripts/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
