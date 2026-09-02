# Measure presentation

This file answers one question: how much room does an application-owned content region take?

Composition has already chosen the DOM tree and the Grammar objects. Measure resolves width and
height constraints on regions the application owns. The internal dimensions of a card, input, control,
or shell belong to Grammar.

## Catalog

Width and height have no closed value scale, so the rule ID is an address over constraint kinds
rather than a position on a ramp. Prefer the earliest rule that works: fluid before fitted, fitted
before capped, capped before fixed.

| Rule | Constraint | Decides |
| --- | --- | --- |
| MEASURE-1 | Page measure | Which packaged width a routed page adopts |
| MEASURE-2 | Fluid width | A region follows the width it is given |
| MEASURE-3 | Content width | A region grows only as far as its content |
| MEASURE-4 | Capped width | A fluid region stops widening past a readable bound |
| MEASURE-5 | Minimum height | A region reserves a floor and grows past it |
| MEASURE-6 | Inherited height | A region fills a height its host already defines |
| MEASURE-7 | Capped height | A region stops growing and hands scrolling to a boundary |

A fixed width or height is absent from this catalog on purpose. A region whose size cannot respond to
its content or its viewport is a layout decision made before presentation, and it is reported rather
than written here.

## Owner

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The region belongs to the application | The class |
| A component name | Common already constrains this dimension | Nothing. Pass the prop |
| `—` | Common exposes no public path | The class, recorded as a workaround |

Every region that can receive long content also carries `min-w-0`. Without it a flex or grid child
refuses to shrink below its content and pushes its neighbours out of the viewport. Common applies it
throughout its own renderers; an application region that wraps text must do the same.

## Measure Common already owns

Generated from `@grammar/core` claims by `scripts/generate-presentation-owned.mjs`; edit the component, not this table.

| Component | Element or condition | Rule |
| --- | --- | --- |
| `NavigationFeatureNav` | root | MEASURE-2 |
| `PageContainer` | root | MEASURE-1 |
| `Progress` | root | MEASURE-2 |
| `Rail` | body, height="fill" | MEASURE-6 |
| `Sidebar` | root, presentation!="drawer" | MEASURE-6 |
| `Sidebar` | root, presentation="drawer" | MEASURE-2 |
| `TextAction` | root | MEASURE-3 |
| `WorkspaceShell` | layout | MEASURE-1 |

## MEASURE-1 — Page measure

A routed page adopts one packaged width instead of inventing its own.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A page of continuous prose that must stay readable | `PageContainer` | `<PageContainer measure="reading">` |
| Case 2 | An ordinary product page of cards, tables, and controls | `PageContainer` | `<PageContainer>`, the product default |
| Case 3 | A page whose content genuinely spans the viewport, such as a board or canvas | `PageContainer` | `<PageContainer measure="full">` |

Not this rule: recreating the page width with a cap and a centring margin. That reproduces a
component the page already has.

## MEASURE-2 — Fluid width

The region takes the width it is given and stays responsive.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A region that should follow the width supplied by its layout host | `App` | `<section className="w-full">` |
| Case 2 | A control or field that must span its column | `App` | `w-full` on the app-owned wrapper, never inside the control |

Not this rule: forcing a child past its parent's intended measure.

## MEASURE-3 — Content width

The region grows only as far as its content needs.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A compact region whose width should follow its own content | `App` | `<aside className="w-fit max-w-full">` |
| Case 2 | Row content inside a horizontal scroll region | `HorizontalScrollRegion` | Compose the region; children already take `max-content` |

Always pair `w-fit` with `max-w-full`. Without the cap, content longer than expected widens the
region past its container and creates page-level horizontal scrolling.

Not this rule: long prose, or a region that must fill its host.

## MEASURE-4 — Capped width

A fluid region stops widening once further width stops helping the reader.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A prose region whose line length needs a readable upper bound | `App` | `<article className="max-w-[65ch]">` |
| Case 2 | A content region that loses its grouping past a known width | `App` | `<main className="w-full max-w-6xl">` |

Character-based caps follow the text itself and belong to prose. Length-based caps belong to mixed
content. Neither applies to tables, media, or code, which have their own intrinsic width.

Not this rule: adding a cap because a screenshot looks sparse.

## MEASURE-5 — Minimum height

The region reserves a floor and still grows with its content.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A region needing a stable canvas before its content height is known | `App` | `<section className="min-h-[24rem]">` |
| Case 2 | A region whose empty and populated states must not shift the page | `App` | The same floor on both states |

Not this rule: reserving space for content that is absent by design. An empty state occupies its own
region rather than a held-open gap.

## MEASURE-6 — Inherited height

The region fills a height its host already defines.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A region inside a host that supplies a definite height | `App` | `<section className="h-full">` inside a sized parent |
| Case 2 | A rail that must run the full height of its shell | `Rail` | `height="fill"` on the rail |

`h-full` resolves against a definite parent height and does nothing without one. In an indefinite
chain it silently has no effect, which reads as a styling bug rather than a missing height.

Not this rule: stretching ordinary document content.

## MEASURE-7 — Capped height

The region stops growing, and something inside it scrolls.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A list or panel that must not push the page beyond the viewport | `VerticalScrollRegion` | Compose the region; it owns the boundary |
| Case 2 | An app-owned region with a bounded height and its own scroll | `App` | `max-h-*` together with the matching overflow rule |

A capped height without a scroll owner clips content silently. The two decisions travel together.

Not this rule: capping a region to hide content the reader still needs.

## What this file does not decide

Which boundary scrolls or clips is [Overflow](overflow.md). How text behaves inside the region is
[Text flow](text-flow.md). Space around and inside the region is [Gap](gap.md) and [Padding](padding.md).
