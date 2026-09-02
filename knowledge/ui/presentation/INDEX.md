# UI presentation

Presentation is the last UI decision layer:

```text
business
-> composition chooses the DOM structure, layout and Grammar objects
-> presentation resolves CSS values on app-owned boundaries
-> rendered UI
```

Rules in this folder are conditionally mandatory: when a rule's `When` matches, the presentation
must use that rule or preserve an equivalent value already supplied by the public Grammar API.

## Authority

Presentation may:

- set relationships between already-chosen Grammar objects;
- style an app-owned page, section, container or content-region boundary;
- choose public `Text` and `Heading` hierarchy props from business information rank;
- resolve wrapping, measure and overflow for app-owned content.

Presentation must not:

- choose or rebuild the DOM structure, flex/grid layout or Grammar component;
- add padding, typography or paint inside `Card`, `Input`, `Button` or another Grammar object;
- reach through a Grammar component with selectors or consumer classes;
- decide responsive transformation, CTA priority, state, focus or motion; those belong to other
  knowledge groups.

Layout classes may appear in examples because composition has already chosen them. Their presence
is context, not a presentation recommendation.

## Catalog

| Knowledge | Properties it decides | Rules |
| --- | --- | --- |
| [Gap](gap.md) | `gap`, `row-gap`, `column-gap` between Grammar objects | GAP-0 to GAP-6 |
| [Padding](padding.md) | Inset of app-owned pages, sections, and containers | PADDING-0 to PADDING-8 |
| [Margin](margin.md) | External offset and auto placement, as a named exception; gap comes first | MARGIN-0 to MARGIN-6, MARGIN-AUTO |
| [Font](font.md) | `font-size`, `font-weight`, `line-height`, `letter-spacing` by title, body, and meta rank | FONT-1 to FONT-6, plus weight |
| [Tone](tone.md) | Default, muted, and accent by information rank; never a raw colour | TONE-1 to TONE-3 |
| [Surface](surface.md) | Which semantic surface an app-owned region takes, with its paired foreground | SURFACE-1 to SURFACE-6 |
| [Boundary](boundary.md) | Which separator or border draws an app-owned edge, and which edge drops it | BOUNDARY-1 to BOUNDARY-6 |
| [Measure](measure.md) | `width`, `height`, and their minima and maxima for app-owned regions | MEASURE-1 to MEASURE-7 |
| [Text flow](text-flow.md) | `text-align`, wrapping, `white-space`, truncation, line clamping | FLOW-1 to FLOW-5 |
| [Overflow](overflow.md) | Scroll, clip, and containment boundaries owned by the app | OVERFLOW-1 to OVERFLOW-5 |

Gap, padding, and margin share `COMMON_SPACING_SCALE`, so their rule numbers are ordinal positions on
that one closed scale. Font and tone have their own closed scales. Measure, surface, boundary, text
flow, and overflow have no value ramp, so their numbers address constraint kinds instead, and each
file says so.

## Rule shape

`GAP-1`, `FONT-1`, and the other `PREFIX-n` names are stable ordinal addresses on their topic's closed
value scale. `GAP-1` is the first gap value, not a severity, component variant, or Tailwind step. The
ID and the class agree only while the scale and the Tailwind steps happen to run together; where they
diverge, the ID keeps counting and the class does not. Every heading therefore prints both, as
`## GAP-5 — gap-6 / 1.5rem`, and every topic opens with a scale table mapping rule to class to value,
naming the classes that fall outside the scale.

A rule is one value. Its cases are the situations that resolve to it, selected by an observable
property of the already-rendered tree. Two cases never describe the same situation.

Every rule contains its heading, one line naming the relationship the value expresses, and one table:

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | The concrete condition that selects this value. | Who owns the distance. | Inline TSX, or nothing when a component owns it. |

The owner cell is one of three values, and every topic states them once near the top:

- `App`, so the application writes the class on its own container.
- A Common component name, so the distance already lives inside that component. The application
  passes a prop and writes no class. Writing it anyway is `APP_REIMPLEMENTATION`.
- `—`, so Common exposes no public path. The class is a recorded workaround linked to
  `COMMON_CAPABILITY_MISSING`.

Each topic also carries one table of the relationships Common already owns, mapping component to
internal value to rule, so a reader can rule out writing anything before reaching the cases. Those
claims must resolve to current source.

A case belonging to a neighbouring value is not a table row. It goes on one line after the table, as
`Not this rule: <condition> uses GAP-n`.

Add `Case 2`, `Case 3`, and further rows only for materially different situations governed by the same
value. Code stays in the table. Do not add `Why`, `When not to use`, detached code blocks, audit
verdicts, imagined APIs, placeholder examples, or paragraphs about values that are not on the scale.
