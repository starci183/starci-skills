# Gap presentation

This file answers one question: given a container the application already decided to render, which
gap value does it get?

Composition has already chosen the DOM tree, the flex or grid direction, and the Grammar objects. Gap
presentation resolves only the distance between those objects, and only where the application owns
the container. Distances inside a Grammar object belong to Grammar.

## Scale

`COMMON_SPACING_SCALE` is closed. The rule ID is the ordinal position on that scale. It is not the
Tailwind step number, and the two diverge from GAP-5 onward.

| Rule | Class | Value | Common token |
| --- | --- | --- | --- |
| GAP-0 | `gap-0` | `0` | none |
| GAP-1 | `gap-1` | `.25rem` | none |
| GAP-2 | `gap-2` | `.5rem` | `--grammar-inline-gap` |
| GAP-3 | `gap-3` | `.75rem` | `--grammar-row-gap` |
| GAP-4 | `gap-4` | `1rem` | `--grammar-section-gap` |
| GAP-5 | `gap-6` | `1.5rem` | `--grammar-region-gap` |
| GAP-6 | `gap-8` | `2rem` | none |

The rem values resolve to `0 / 4 / 8 / 12 / 16 / 24 / 32` CSS pixels only at a computed root of
`16px`. Runtime checks use `expectedPx = remFactor * observedRootFontPx`.

## Owner

Each case names who owns the distance. The owner decides whether the application writes a class at
all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The container belongs to the application | The class |
| A component name | Common already applies the gap inside that component | Nothing. Pass the prop |
| `—` | Common exposes no public path for this relationship | The class, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Writing one where the owner
is `—` stays linked to `COMMON_CAPABILITY_MISSING`.

## Gaps Common already owns

Check this table before writing any gap. If the relationship appears here, the application composes
the component and writes nothing.

| Common component | Internal gap | Rule |
| --- | --- | --- |
| `Text` with `startContent` | `.5rem` | GAP-2 |
| `MediaFrame` | `.5rem` | GAP-2 |
| `SurfaceCard` label row | `.5rem` | GAP-2 |
| `Tabs` tab content | `.5rem` | GAP-2 |
| `SurfaceCopyGroup` | `.5rem`, or `.75rem` at `density="comfortable"` | GAP-2, GAP-3 |
| `StaticStateRow` | `.5rem` between row parts, `.25rem` inside its copy | GAP-2, GAP-1 |
| `SectionHeader` | `.75rem` | GAP-3 |
| `SurfaceAccordionCard` | `.75rem` | GAP-3 |
| `Subnav` | `.75rem` | GAP-3 |
| `EmptyNotice` | `.75rem` | GAP-3 |
| `Sidebar` and `NavigationFeatureNav` | `.75rem` primary, `.5rem` actions | GAP-3, GAP-2 |
| `MarkdownArticle` | `1rem`, or `.75rem` at compact measure | GAP-4, GAP-3 |
| `Rail` | `1rem` | GAP-4 |
| `PrimaryRailLayout` | `1.5rem` | GAP-5 |
| `WorkspaceShell` | `1.5rem` | GAP-5 |
| `ChatWorkspace` | `1.5rem` | GAP-5 |

## GAP-0 — `gap-0` / `0`

Adjacent faces meet with no space because another element already owns the seam.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Stacked bands whose boundary is drawn by a separator | `App` | `<div className="flex flex-col gap-0">` with `<Divider />` between bands |
| Case 2 | A list whose rows are separated by a border, not by space | `SurfaceListCard` | Compose the card; no gap |
| Case 3 | Joined faces inside one surface | `SurfaceCard` | `composition="joined"` already sets `0` |

## GAP-1 — `gap-1` / `.25rem`

Two stacked lines that read as one identity. The second line qualifies the first rather than
starting a new item.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A title and the short qualifier bound to it, such as a name under its category | `—` | `<div className="flex flex-col gap-1">` with two `<Text>` |
| Case 2 | A value and the unit or timestamp bound to it | `—` | Same container |
| Case 3 | The copy pair inside a status row | `StaticStateRow` | Compose the row; no gap |

Not this rule: two separately readable items, even short ones, use GAP-3.

## GAP-2 — `gap-2` / `.5rem`

Inline companions inside one control, or two compact items that act as one unit.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An icon beside its label inside one control | `Text` | `<Text startContent={<Icon source={check} />}>Active</Text>` |
| Case 2 | A title with its explanation inside a surface | `SurfaceCopyGroup` | `<SurfaceCopyGroup>` at default density |
| Case 3 | Two adjacent inline actions in an app-owned row | `App` | `<div className="flex items-center gap-2">` with two `<TextAction>` |
| Case 4 | A row of badges or short status chips | `App` | `<div className="flex flex-wrap gap-2">` with `<Badge>` children |

## GAP-3 — `gap-3` / `.75rem`

Peer items in one row or one tightly related group. Each item is read on its own, but they belong
together.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A field and the action that submits it, side by side | `App` | `<div className="flex items-end gap-3">` with `<Input>` and `<Button>` |
| Case 2 | A title and its explanation that need more air than the compact default | `SurfaceCopyGroup` | `<SurfaceCopyGroup density="comfortable">` |
| Case 3 | Two peer controls sharing one decision, such as a pair of filters | `App` | `<div className="flex gap-3">` |
| Case 4 | An eyebrow, title, and description above a section | `SectionHeader` | Compose the header; no gap |

Not this rule: blocks that each carry their own heading use GAP-4.

## GAP-4 — `gap-4` / `1rem`

Sibling blocks inside one section. Each block is a separate piece of content, but the section still
reads as one group.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Stacked content blocks under one section heading | `App` | `<section className="flex flex-col gap-4">` |
| Case 2 | Cards in a grid belonging to one collection | `App` | `<div className="grid grid-cols-2 gap-4">` with `<SurfaceCard>` children |
| Case 3 | A form's field groups within one step | `App` | `<div className="flex flex-col gap-4">` with `<Input>` children |
| Case 4 | Prose blocks inside rendered article content | `MarkdownArticle` | Compose the article; no gap |

## GAP-5 — `gap-6` / `1.5rem`

Regions of a page. Each region has its own purpose and its own heading, and the reader moves between
them rather than through them.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Two page regions with distinct purposes, such as a summary above a history list | `App` | `<main className="flex flex-col gap-6">` with two `<section>` |
| Case 2 | The standing rhythm between top-level sections of a dashboard | `App` | `<div className="flex flex-col gap-6">` |
| Case 3 | The primary column beside its rail | `PrimaryRailLayout` | Compose the layout; no gap |
| Case 4 | Shell regions around routed page content | `WorkspaceShell` | Compose the shell; no gap |

Not this rule: blocks that share one heading and one purpose use GAP-4.

## GAP-6 — `gap-8` / `2rem`

A named major transition. The strongest break the scale offers, used only when the ordinary region
rhythm fails to separate two parts of the page.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A page whose halves serve unrelated tasks, where `1.5rem` reads as one continuous column | `—` | `<main className="flex flex-col gap-8">` |
| Case 2 | A marketing surface whose sections are deliberately spacious | `—` | Same container |

Not this rule: applying it to every region uniformly removes hierarchy. Use GAP-5.

## Axis variants

`gap-x-*` and `gap-y-*` are not separate rules. They apply an existing rule to one axis when the two
axes carry different relationships, most often on a wrapping or grid parent.

| Axis | Class | Meaning |
| --- | --- | --- |
| Inline | `gap-x-*` | The chosen rule applies between columns only |
| Block | `gap-y-*` | The chosen rule applies between rows only |

A wrapping list whose columns are inline companions and whose rows are peers is `gap-x-2 gap-y-3`,
which is GAP-2 on the inline axis and GAP-3 on the block axis. Each axis names its own case.

## What this file does not decide

Padding inside an app boundary is [Padding](padding.md). External offsets are [Margin](margin.md).
Which DOM structure, flex direction, or Grammar object to render was decided before this file is
read, and no gap value can repair a wrong composition.
