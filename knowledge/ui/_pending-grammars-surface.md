> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> anatomy, not an application decision. Its SURFACE-n and BOUNDARY-n identifiers are superseded by
> knowledge/ui/presentation/, which now owns those prefixes for app-owned token selection. Do not
> load this file as runtime authority.
# Surface

`ui.surface` owns reusable region anatomy, material-boundary placement, depth, state, action, scroll,
and responsive continuity. Classify findings with the [canonical verdict model](INDEX.md#canonical-verdict-model).
Source proves the Common API and slot owner; computed geometry, final pixels, interaction, and the
accessibility tree prove the render. A family may change scoped paint but not Common semantics or
metrics. The application owns purpose, content, data, effects, page canvas, and legitimate placement.

## SURFACE-1 — One Common compound-card anatomy

### When

A reusable region needs one labelled or self-named surface with one content owner. A product-only
layout wrapper without reusable region semantics does not select this anatomy.

### Apply

- Use Common `SurfaceCard`; its installed HeroUI 3.2.4 anatomy is `Card.Root` with optional `Card.Header` and exactly one `Card.Content`.
- Keep `Card.Root variant="transparent"`, the section owner, and Common's published surface anchors; application code must not import the vendor card.
- Prove one `data-slot="card"`, zero or one `card-header`, exactly one `card-content`, and one accessible region name.
- Families may paint published anchors; applications supply props/content and place the complete component without copying its DOM.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A labelled `SurfaceCard` renders one card, one header, and one content slot. | `PASS` | Common owns the complete compound region. |
| An app imports HeroUI `Card` to match the surface. | `APP_REIMPLEMENTATION` · `VENDOR_LEAK` | Use Common `SurfaceCard`; vendor anatomy is internal implementation. |
| Common emits two `card-content` slots for one surface. | `COMMON_IMPLEMENTATION_GLITCH` · `DOUBLE_OWNER` | Repair the Common renderer to restore one content owner. |

## SURFACE-2 — Family chooses where the one material is painted

### When

The same bounded Common surface must adopt a family's material language while retaining identical
props, content geometry, semantics, and state behavior.

### Apply

- Keep the Common DOM and use only scoped family selectors on published surface/frame/label anchors.
- Paint exactly one material boundary: Core may paint the labelled root; Heritage/Offset Pop may paint the bounded content slot while the root stays transparent.
- Prove one visible edge/background/shadow owner, unchanged content metrics, and the label still inside the Common region/accessibility owner.
- Families may change paint location among published anchors; applications may style surrounding canvas but not surface slots.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Core paints a labelled root and leaves its content slot transparent. | `PASS` | One material contains both label and content without a second card. |
| Heritage keeps the root transparent and paints the bounded content slot once. | `PASS` | Material changed while Common anatomy and metrics stayed intact. |
| Root and content both have background, border, and shadow. | `FAMILY_OVERRIDE_GLITCH` · `DOUBLE_OWNER` | Remove one painted layer and recheck every edge. |
| App CSS reaches `[data-slot="card-content"]` to change the family. | `APP_OVERRIDE` · `WRONG_OWNER` | Select or repair the family; the app may not patch Common slots. |

## SURFACE-3 — Frame, depth, composition, measure, and height remain closed props

### When

Content is top-level or nested, already owns a boundary, contains touching child bands, uses a form
measure, or must stretch with peer surfaces.

### Apply

- Use only current Common props: `depth="top|nested"`, `frame="bounded|frameless"`, `composition="single|joined"`, `measure="content|form|formCompact"`, and `height="auto|fill"`.
- Expect frameless to remove paint/inset, joined content to use zero body inset, and fill to stretch the complete surface anatomy.
- Prove prop values, computed frame/inset/overflow, content measure, and equal outer heights; count one owner for every edge and inset.
- Families may repaint the closed geometry; applications may use public placement/width hooks but not descendant selectors or compensating wrappers.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Touching plan bands use `composition="joined"` and the Common body computes to zero inset. | `PASS` | Child bands own their seams while Common owns outer clipping. |
| Media already has a boundary, so the surface uses `frame="frameless"`. | `PASS` | Common keeps the semantic owner without drawing another shell. |
| An app adds negative margin to cancel Common surface padding. | `APP_WORKAROUND` · `DOUBLE_OWNER` | Select the right closed prop or add a missing Common capability. |
| `height="fill"` stretches only an inner body, not the card root. | `COMMON_IMPLEMENTATION_GLITCH` | Repair the complete Common height chain. |

## SURFACE-4 — State, whole action, scroll, and highlight keep one owner

### When

A surface is pending, unavailable, outcome-bearing, interactive as one target, internally scrollable,
or the one approved highlighted surface.

### Apply

- Use `SurfaceCard state`, `wholeAction`, `scroll="page|contained"`/`isScrollable`, and `isHighlight`; keep state values within `PresentationState`.
- Pending/unavailable removes the whole action from operation, contained scroll creates one vertical owner, and pending suppresses highlight.
- Prove one native link/button overlay, one same-axis scroll owner, disabled focus behavior, no pending highlight, and stable outer geometry across states.
- Families paint emitted state/highlight anchors; applications supply verified state/effects and may not copy overlays, scroll shadows, or sweep layers.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A whole-card link becomes unfocusable while its surface is pending. | `PASS` | State and interaction share the Common owner. |
| A contained surface has both page-axis and nested vertical scrollbars. | `APP_OVERRIDE` · `DOUBLE_OWNER` | Keep one same-axis scroll owner and remove the app overflow wrapper. |
| Highlight still animates during pending. | `COMMON_IMPLEMENTATION_GLITCH` · `STATE_OR_VIEWPORT_DRIFT` | Common must suppress the decorative sweep in pending state. |
| App adds a second absolute link over `wholeAction`. | `APP_REIMPLEMENTATION` · `DOUBLE_OWNER` | Remove the duplicate action overlay. |

## SURFACE-5 — Heading ownership is a current exact Common gap

### When

A labelled surface appears under different outline parents or beside another labelled Common
compound. A self-named surface with no visible label does not need a generated heading.

### Apply

- Inspect the actual label renderer: `SurfaceCard`, `SurfaceListCard`, and `SurfaceAccordionCard` currently emit Common `Label as="h3"`.
- Require a typed Common level or labelled-by capability whenever the correct contextual level is not `h3`.
- Prove the page outline, region name relationship, and absence of duplicate hidden headings before any pass.
- Families may style the existing label; applications must not add local headings or slot CSS to repair the gap.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A surface correctly belongs at level 3 and its label names the content. | `PASS` | The current fixed Common output matches this context. |
| A surface directly under `h1` needs an `h2` label. | `COMMON_CAPABILITY_MISSING` | Common cannot select the required level; add a typed capability. |
| Two peer surfaces both need levels derived from different parents. | `COMMON_CAPABILITY_MISSING` | Fixed `h3` cannot represent both contexts safely. |
| App places an `h2` before the surface and hides its built-in label. | `APP_WORKAROUND` · `DOUBLE_OWNER` | Remove the duplicate and resolve heading ownership in Common. |
