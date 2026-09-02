# Boundary presentation

This file answers one question: given an edge the application owns, which separator or border draws
it, and which edge in a repeating set drops it?

The theme publishes two hairline tokens and they mean different things: `--separator` draws the line
between things, and `--border` draws the outline of one thing. A boundary inside a Grammar component
is that component's, never the application's, and no application edge may be drawn with a raw colour
value.

## Catalog

Boundaries have no value ramp, so the rule ID is an address over edge kinds rather than a position on
a scale. Prefer the earliest rule that works: one seam before a per-row seam, a per-row seam before a
parent declaration, a hairline before an outline.

| Rule | Edge kind | Draws |
| --- | --- | --- |
| BOUNDARY-1 | One seam | The single line between two stacked bands |
| BOUNDARY-2 | Per-row seam | Each row's own trailing line, dropped on the last row |
| BOUNDARY-3 | Set seam | One declaration on the parent for every line inside a set |
| BOUNDARY-4 | Inline seam | The line between columns of a grid or a split region |
| BOUNDARY-5 | Outline | The border enclosing one object |
| BOUNDARY-6 | No border | An object separated by elevation instead of a line |

A repeating set has one line fewer than it has rows. Whichever rule draws the set, the outer edge of
the last row is closed by the surface itself, so a set that renders a trailing line at its own edge
has one boundary too many.

## Owner

Each case names who owns the edge. The owner decides whether the application writes a class at all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The edge belongs to the application | The class |
| A component name | Common already draws this edge inside that component | Nothing. Pass the prop |
| `—` | Common exposes no public path for this edge | The class, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Writing one where the owner
is `—` stays linked to `COMMON_CAPABILITY_MISSING`. Adding an application line beside one a component
already draws is `DOUBLE_OWNER`, and it renders as a visible double hairline.

## Boundaries Common already owns

Check this table before writing any border. If the edge appears here, the application composes the
component and writes nothing.

| Common component | Edge it draws | Rule |
| --- | --- | --- |
| `SurfaceListCard` rows | A separator above every row after the first | BOUNDARY-3 |
| `SurfaceAccordionCard` rows | A separator above every row after the first | BOUNDARY-3 |
| `NavigationFeatureNav` | A separator along its block end | BOUNDARY-1 |
| `Subnav` | A separator along its block end | BOUNDARY-1 |
| `ChatWorkspace` composer | A separator along its block start | BOUNDARY-1 |
| `ChatWorkspace` rail-trigger boundary | A separator along its block end | BOUNDARY-1 |
| `WorkspaceShell` compact navigation | A separator along its block start | BOUNDARY-1 |
| `WorkspaceShell` leading rule | A `1px` separator column in the grid track | BOUNDARY-4 |
| `MarkdownArticle` rule | A separator across the article measure | BOUNDARY-1 |
| `MarkdownArticle` table cells | A separator under every cell | BOUNDARY-3 |
| `MarkdownArticle` quote | A `3px` border on the inline start, on `--border` | BOUNDARY-5 |
| `MediaFrame` viewport | A `1px` border on `--border` | BOUNDARY-5 |
| `FencedCodeBlock` and `MarkdownTableFrame` | A `1px` border on `--border` | BOUNDARY-5 |
| `SurfaceCard` at `depth="nested"` | A `1px` border on `--border` | BOUNDARY-5 |
| `SurfaceCard` at `depth="top"` | No border; a surface shadow instead | BOUNDARY-6 |
| `Divider` | A labelled hairline pair on `--border` | BOUNDARY-5 |

`Divider` is a labelled alternative boundary, not a plain rule: it renders a visible word between two
hairlines and carries `role="separator"`. An unlabelled line between two bands is BOUNDARY-1.

## BOUNDARY-1 — `border-t border-separator` / `--separator`

One seam between two stacked bands inside a flush surface. The bands touch, and the line is what
tells them apart.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Two app-owned bands stacked inside one joined card | `—` | `<div aria-hidden className="border-t border-separator" />` between them |
| Case 2 | A band that carries its own leading seam rather than a separate element | `—` | `<div className="min-w-0 border-t border-separator">` on the band itself |
| Case 3 | A card's closing action band, separated from the content above it | `—` | `<div className="border-t border-separator px-4 pb-4 pt-3">` |
| Case 4 | The block edge of page chrome against the content below it | `Subnav`, `NavigationFeatureNav` | Compose the component; no border class |

Not this rule: three or more rows of the same kind. Use BOUNDARY-2 or BOUNDARY-3.

A separator element is decorative and takes `aria-hidden`; the bands it divides carry the meaning.

## BOUNDARY-2 — `border-b border-separator last:border-b-0` / `--separator`

A repeating set where every row draws its own trailing line, and the last row drops it because the
surface's own edge already closes the set.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Rows of one collection rendered edge to edge inside a joined card | `—` | `<li className="border-b border-separator px-4 py-3 last:border-b-0">` |
| Case 2 | The same set where the trailing row also opens up to the card's outer inset | `—` | The same class plus `last:pb-4` |
| Case 3 | A grid of the same rows, where the last full row of the set drops the line | `—` | `sm:[&:nth-last-child(-n+2)]:border-b-0` on a two-column set |

Not this rule: a set whose rows carry no class of their own. Use BOUNDARY-3.

`last:border-b-0` is the whole point of this rule, not an embellishment. Without it the set renders a
line against the surface edge and the card reads as unfinished. Case 3 exists because in a two-column
grid the last row is the last two children, so `last:` alone drops one line and leaves its neighbour.

## BOUNDARY-3 — `divide-y divide-separator` / `--separator`

One declaration on the parent draws every line inside a set. The rows say nothing, so no row can be
missed and no row can render a line the set did not intend.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A list whose rows are uniform and need no per-row exception | `—` | `<ul className="m-0 list-none p-0 divide-y divide-separator">` |
| Case 2 | A grid of peer measures stacked on one axis | `—` | `<div className="grid min-w-0 grid-cols-1 divide-y divide-separator">` |
| Case 3 | A list or disclosure whose rows Common already separates | `SurfaceListCard`, `SurfaceAccordionCard` | Compose the card; no divide class |

Not this rule: a set where individual rows need a different edge. Use BOUNDARY-2.

Common draws Case 3 with an adjacent-sibling rule rather than a parent declaration. Both mean the same
thing, one line between consecutive rows and none at either outer edge, so both satisfy this rule.

## BOUNDARY-4 — `border-l` / `divide-x` / `--separator`

A seam on the inline axis, between columns of a grid or between the two halves of a split region. It
appears only at the width where the columns exist.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A set that stacks on narrow widths and becomes columns on wide ones | `—` | `divide-y divide-separator lg:divide-y-0 lg:divide-x` on the parent |
| Case 2 | A two-column grid where only the starting column carries the column seam | `—` | `sm:[&:nth-child(odd)]:border-r` on the row class |
| Case 3 | A panel that becomes a side region and needs one seam against the primary column | `—` | `lg:border-l lg:border-separator` on the panel |
| Case 4 | A shell whose leading rail is separated from the primary region by a rule | `WorkspaceShell` | Compose the shell; no border class |

Not this rule: the block-axis lines of the same set. Those stay BOUNDARY-2 or BOUNDARY-3, and the two
axes each name their own case.

The `nth-child` selector in Case 2 is what keeps the trailing column from drawing a line against the
surface edge. It is the inline-axis form of `last:border-b-0`.

## BOUNDARY-5 — `border` / `--border`

The outline enclosing one object, rather than a line between two. Every case belongs to a Grammar
component, because the objects that need an outline are Grammar's.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A card nested inside another bounded surface | `SurfaceCard` | `depth="nested"` already draws the outline |
| Case 2 | A framed media viewport | `MediaFrame` | Compose the frame; no border class |
| Case 3 | A code block or a table frame inside article content | `FencedCodeBlock`, `MarkdownTableFrame` | Compose the block; no border class |
| Case 4 | A labelled boundary offering an alternative between two paths | `Divider` | `<Divider label="or" />` |

Not this rule: the line between two touching bands. That is a hairline on `--separator`, so use
BOUNDARY-1.

## BOUNDARY-6 — no border / `--shadow-surface`

An object separated from the page by elevation rather than by a line. This is the default face of a
top-level card, and it is a boundary decision even though it draws no border.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A top-level card sitting directly on the page canvas | `SurfaceCard` | `depth="top"` already clears the border and applies the shadow |
| Case 2 | The same card once it is nested inside another surface | `SurfaceCard` | `depth="nested"` replaces the shadow with BOUNDARY-5 |

Not this rule: adding an outline to a top-level card. The border and the shadow are alternatives, and
drawing both is `DOUBLE_OWNER`.

`--shadow-surface` is a theme hook rather than a fixed value, and a theme may resolve it to no shadow
at all. A top-level card is then separated by its face against the page canvas alone, which is a
surface decision and belongs to [Surface](surface.md).

## What this file does not decide

Which face sits on either side of an edge is [Surface](surface.md). The space between an edge and its
content is [Padding](padding.md), and a boundary drawn by a line rather than by space is why a
separator-facing side takes less inset than an outer edge. Distance between siblings that need no line
is [Gap](gap.md), and the clipping that keeps a full-bleed band inside its card is
[Overflow](overflow.md).
