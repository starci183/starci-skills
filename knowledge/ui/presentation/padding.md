# Padding presentation

This file answers one question: given a boundary the application owns, how much space separates that
boundary from its content?

Composition has already chosen the DOM tree and the Grammar objects. Padding presentation resolves
the inset of application-owned pages, sections, and containers only. The inset inside a card, input,
button, or any other Grammar object belongs to Grammar.

## Scale

`COMMON_SPACING_SCALE` is closed. The rule ID is the ordinal position on that scale. It is not the
Tailwind step number, and the two diverge from PADDING-5 onward.

| Rule | Class | Value | Common token |
| --- | --- | --- | --- |
| PADDING-0 | `p-0` | `0` | none |
| PADDING-1 | `p-1` | `.25rem` | none |
| PADDING-2 | `p-2` | `.5rem` | none |
| PADDING-3 | `p-3` | `.75rem` | none |
| PADDING-4 | `p-4` | `1rem` | none |
| PADDING-5 | `p-6` | `1.5rem` | none |
| PADDING-6 | `p-8` | `2rem` | none |

Common publishes no padding token. The internal insets below are reached through the components that
own them, not through a variable the application may set.

The page inset is the one exception and is not on this scale: `--grammar-page-inset` resolves to
`clamp(1rem, 3vw, 2rem)`, a responsive value owned by `PageContainer`. An application never
reproduces it with a fixed class.

The rem values resolve to `0 / 4 / 8 / 12 / 16 / 24 / 32` CSS pixels only at a computed root of
`16px`. Runtime checks use `expectedPx = remFactor * observedRootFontPx`.

## Owner

Each case names who owns the inset. The owner decides whether the application writes a class at all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The boundary belongs to the application | The class |
| A component name | Common already applies the inset inside that component | Nothing. Compose it |
| `—` | Common exposes no public path for this boundary | The class, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Reaching into a Grammar
component with a selector or a passed class to change its inset is `APP_OVERRIDE`.

## Padding Common already owns

Generated from `@grammar/core` claims by `scripts/generate-presentation-owned.mjs`; edit the component, not this table.

| Component | Element or condition | Rule |
| --- | --- | --- |
| `ChatWorkspace` | drawer body, hasRail, isCompactRail | PADDING-0 |
| `ChatWorkspace` | overlay rail, hasRail, isCompactRail | PADDING-4 |
| `ChatWorkspace` | overlay rail, hasRail, not isCompactRail | PADDING-4 |
| `ChatWorkspace` | rail trigger boundary, hasRail, isCompactRail | PADDING-2 |
| `ChatWorkspace` | rail trigger boundary, hasRail, isCompactRail | PADDING-4 |
| `ChatWorkspace` | rail trigger, hasRail, isCompactRail | PADDING-3 |
| `EmptyNotice` | root | PADDING-4 |
| `HorizontalScrollRegion` | root | PADDING-1 |
| `NavigationFeatureNav` | primary | PADDING-3 |
| `OtpInput` | root | PADDING-1 |
| `Rail` | body, inset="content" | PADDING-3 |
| `Rail` | body, inset="content" | PADDING-5 |
| `Sidebar` | footer, not (collapsed || footer == null) | PADDING-0 |
| `Sidebar` | footer, not (collapsed || footer == null) | PADDING-3 |
| `Sidebar` | group label, group.label!=undefined, not collapsed | PADDING-1 |
| `Sidebar` | group label, group.label!=undefined, not collapsed | PADDING-2 |
| `Sidebar` | group label, group.label!=undefined, not collapsed | PADDING-3 |
| `Sidebar` | header, not (collapsed || header == null) | PADDING-3 |
| `Sidebar` | icon button wrapper, canToggle | PADDING-2 |
| `Sidebar` | list box item, not collapsed | PADDING-2 |
| `Sidebar` | list box item, not collapsed | PADDING-3 |
| `Sidebar` | list box, collapsed | PADDING-2 |
| `Sidebar` | list box, not collapsed | PADDING-3 |
| `StaticStateRow` | root | PADDING-4 |
| `Subnav` | root | PADDING-3 |
| `SurfaceAccordionCard` | accordion body | PADDING-8 |
| `SurfaceAccordionCard` | accordion body wrapper | PADDING-0 |
| `SurfaceAccordionCard` | accordion trigger | PADDING-4 |
| `SurfaceCard` | card content, composition!="joined" | PADDING-4 |
| `SurfaceCard` | card content, composition="joined" | PADDING-0 |
| `SurfaceListCard` | root | PADDING-0 |
| `Tabs` | hero tabs tab | PADDING-3 |
| `Tabs` | root, inset="page" | PADDING-5 |
| `TextAction` | root, appearance="choice" | PADDING-1 |
| `TextAction` | root, appearance="choice" | PADDING-2 |
| `TextAction` | root, appearance="route" | PADDING-2 |
| `TextAction` | root, appearance="route" | PADDING-3 |
| `TextAction` | root, appearance="section" | PADDING-2 |
| `TextAction` | root, appearance="section" | PADDING-3 |
| `TextAction` | root, appearance="tab" | PADDING-3 |
| `Tooltip` | content | PADDING-1 |
| `Tooltip` | content | PADDING-2 |

## Side contact

A boundary does not always take one value on all four sides. When a surface is flush and its child
bands own their own inset, each side takes its value from what that side touches.

| What the side touches | Value | Rule |
| --- | --- | --- |
| The outer edge of the surface | `1rem` | PADDING-4 |
| A separator between bands | `.75rem` | PADDING-3 |
| Nothing, because a child owns the edge | `0` | PADDING-0 |

A separator already draws the boundary, so the side meeting it needs less clearance than a bare outer
edge. Inline sides of a band always meet the outer edge, so they stay at `1rem`.

For a stack of bands this resolves to `px-4` throughout, `pt-4` on the first band, `pb-4` on the last,
and `.75rem` on every side that meets a separator. A band between two separators is `px-4 py-3`.

Common owns the flush surface itself through `composition="joined"`, which sets the content inset to
`0`. It exposes no path for the band insets, so those remain an application workaround.

## PADDING-0 — `p-0` / `0`

The boundary contributes no space, because the content or a child already owns its own edge.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A container that only groups children which each carry their own boundary | `App` | `<section className="p-0">` |
| Case 2 | Surface bands that must run flush to the card edge | `SurfaceCard` | `composition="joined"` already sets `0` |
| Case 3 | A list whose rows own their own inset | `SurfaceListCard` | Compose the card; no padding |

Not this rule: the one boundary protecting readable content keeps its inset. Use PADDING-4.

## PADDING-1 — `p-1` / `.25rem`

The smallest equal inset, for a deliberately tiny container whose content nearly fills it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A compact marker or key floating over an app-owned canvas | `App` | `<aside className="p-1">` with `<Text size="xs">` |
| Case 2 | A scroll region reserving room so focus rings are not clipped | `HorizontalScrollRegion` | Compose the region; no padding |
| Case 3 | A short hint attached to a control | `Tooltip` | Compose the tooltip; no padding |

## PADDING-2 — `p-2` / `.5rem`

A compact app-owned container that needs clear but economical edge space.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A small auxiliary strip whose four sides share one inset | `App` | `<aside className="p-2">` with `<Text size="sm">` |
| Case 2 | A compact bar of controls above app-owned content | `App` | `<div className="flex items-center gap-2 p-2">` |

Not this rule: separation between siblings inside the container belongs to the parent gap, not to
padding. Use the matching GAP rule.

## PADDING-3 — `p-3` / `.75rem`

A dense but readable inset for a compact app-owned section or nested container.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A nested app container that owns a boundary distinct from its parent's | `App` | `<aside className="p-3">` inside a `p-4` section |
| Case 2 | The inline inset of a tab strip or secondary navigation | `Tabs`, `Subnav` | Compose the component; no padding |
| Case 3 | A band side that meets a separator inside a flush surface | `—` | `<div className="px-4 py-3">` between two separators |
| Case 4 | The separator-facing side of a metric cell or list row | `—` | `<div className="p-4 pb-3">`, or `pt-3` when the separator is above |

Not this rule: nesting the same inset for the same boundary and purpose doubles it. Parent and child
padding add along the path from outer border to final content.

## PADDING-4 — `p-4` / `1rem`

The standard equal inset for readable content inside one app-owned boundary.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An app section that owns the full distance from its border to its content | `App` | `<section className="p-4">` with `<Heading level={2}>` |
| Case 2 | Content inside a card | `SurfaceCard` | Compose the card; no padding |
| Case 3 | A disclosure trigger and its expanded panel | `SurfaceAccordionCard` | Compose the card; no padding |
| Case 4 | An empty-state notice | `EmptyNotice` | Compose the notice; no padding |
| Case 5 | A fenced code block | `FencedCodeBlock` | Compose the block; no padding |
| Case 6 | A band side that meets the outer edge of a flush surface | `—` | `pt-4` on the first band, `pb-4` on the last |
| Case 7 | The inline sides of any band inside a flush surface | `—` | `px-4` on every band, unchanged by position |

## PADDING-5 — `p-6` / `1.5rem`

A substantial app-owned section that is intentionally more spacious than the standard inset.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A section whose four sides share one deliberately generous boundary decision | `App` | `<section className="p-6">` |
| Case 2 | A tab frame carrying the page-level inline inset | `Tabs` | `inset="page"` already sets `1.5rem` |

Not this rule: distance between child sections is a gap, not an inset. Use GAP-5.

## PADDING-6 — `p-8` / `2rem`

A deliberately generous frame around a large, low-density app region.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A page region that needs strong equal clearance on every side | `App` | `<section className="p-8">` |
| Case 2 | An empty or waiting region occupying most of the viewport | `App` | `<section className="p-8">` with `<EmptyNotice>` |

Not this rule: as a default for ordinary containers it wastes the viewport. Use PADDING-4.

## Composite insets

`PADDING-0` through `PADDING-6` are the scale: one rule, one value. From `PADDING-7` onward the rules
are named recipes whose sides deliberately take different values. The number keeps counting, but it
stops meaning a position on the scale, so a composite rule never appears in the scale table and never
introduces a value of its own. Every side of a composite resolves to a base rule.

Append the next number when a genuinely new asymmetric pattern appears. State the reason each side
differs; a recipe without one is a product decision, not a rule.

## PADDING-7 — Inset step at the wider breakpoint

One boundary keeps its meaning across widths but takes more room once the width allows it. The
compact value and the wide value are adjacent rules, never a jump of two steps, and the block axis
follows only where the boundary itself is the owner.

Composed from: inline sides of the surface `1rem` → `1.5rem` (PADDING-4 → PADDING-5); a block side
meeting the outer edge `1rem` → `1.5rem` (PADDING-4 → PADDING-5); a block side meeting a separator
`.75rem` at both widths (PADDING-3).

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A decision surface whose inline inset opens up on a wider viewport | `—` | `<div className="px-4 sm:px-6">` |
| Case 2 | The same surface's outer-edge block sides, stepping with it | `—` | `<div className="px-4 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-6">` |
| Case 3 | A separator-facing side inside that surface | `—` | `pt-3` stays `.75rem` at both widths |

Not this rule: a separator side does not step, because the separator draws the same line at every
width.

## PADDING-8 — Subordinate content indented at the inline start

Content that belongs under the row above it, rather than beside it, indents one step at the inline
start. Only the start edge carries the hierarchy. The end edge has no such meaning, so it stays
aligned with its parent and the reading measure is not squeezed from both sides.

Composed from: inline start one step above the surface inset, `1.5rem` against a `1rem` surface
(PADDING-5); inline end the surface inset, unchanged (PADDING-4); block sides whatever each side
meets, by the side-contact rule (PADDING-3, PADDING-4).

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A disclosure body that reads as the answer belonging to the trigger above it | `—` | `<div className="ps-6 pe-4 py-3">` |
| Case 2 | A nested group whose rows belong to a named parent row | `—` | Same recipe, one step per level of nesting |

Not this rule: indenting both sides, which centres the content and reads as a separate inset block
rather than as subordinate content.

Common's disclosure currently applies `1rem` on both inline sides, so the indented form has no
published path. Repairing it belongs to the disclosure component, not to an application override.

## PADDING-9 — Block inset of a routed block at the wider breakpoint

A routed block gives its own `main` a vertical inset that steps up once the width allows it, while
the inline inset stays with `PageContainer` (`--grammar-page-inset`). The two values are adjacent
rules on the scale, never a jump of two steps, and only the block axis is written here.

Composed from: block sides of the routed block `1.5rem` → `2rem` (PADDING-5 → PADDING-6); inline sides
none, because `PageContainer` owns them (MEASURE-1).

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | The `main` of a routed block that sits directly under the page shell | `App` | `<main className="py-6 sm:py-8">` |

Evidence, four blocks writing the same pair: `blocks/commerce/ProSubscriptionBlock/classNames.ts`
(`proPageClassName`), `blocks/learn/CoursePlaygroundCatalog/classNames.ts`,
`blocks/learn/PlaygroundSession/classNames.ts`, `blocks/learn/PlaygroundSetup/classNames.ts`.

Not this rule: an inline inset on the same element, which duplicates the page inset the container
already draws. Use MEASURE-1 and leave the inline sides alone.

## Axis variants

`px-*` and `py-*` are not separate rules. They apply an existing rule to one axis when the two axes
carry different boundary decisions.

| Axis | Class | Meaning |
| --- | --- | --- |
| Inline | `px-*` | The chosen rule applies to logical start and end only |
| Block | `py-*` | The chosen rule applies to block start and end only |
| One side | `pt-*`, `pb-*`, `ps-*`, `pe-*` | The chosen rule applies to that side only |

Per-side classes are what the side-contact rule needs, because the two block sides of one band often
take different values. `px-4 pt-4 pb-3` is PADDING-4 on three sides and PADDING-3 on the side meeting
a separator, and every side still names its own case.

On the same element the narrower class wins the sides it names rather than adding, so `p-4 pb-3`
resolves to `1rem` on three sides and `.75rem` at the bottom. Between nested elements padding does
add, which is why a wrapper introduced only to change one side produces an inset nobody intended.

## What this file does not decide

Distance between siblings is [Gap](gap.md). External offsets are [Margin](margin.md). The page inset
belongs to `PageContainer` and is not an application decision.
