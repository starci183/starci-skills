# Overflow presentation

This file answers one question: when content exceeds its region, which boundary owns that, and what
does it do?

Composition has chosen the tree and [Measure](measure.md) has bounded the region. Overflow resolves
what happens at the edge of a boundary the application owns. Clipping and scrolling inside a card,
rail, table frame, or shell belong to Grammar.

## Catalog

| Rule | Boundary behaviour | Content beyond the edge |
| --- | --- | --- |
| OVERFLOW-1 | Visible | Escapes the boundary and remains readable |
| OVERFLOW-2 | Clipped | Is cut and unreachable |
| OVERFLOW-3 | Scrolls on one axis | Is reachable by scrolling that axis |
| OVERFLOW-4 | Scrolls when needed | Is reachable only when it exists |
| OVERFLOW-5 | Contained | Scrolls without handing the gesture to the page |

Exactly one boundary owns each axis. Two nested scrollers on the same axis trap the reader between
them, and neither reaches the end reliably.

## Owner

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The boundary belongs to the application | The class |
| A component name | Common already owns this boundary | Nothing. Compose it |
| `—` | Common exposes no public path | The class, recorded as a workaround |

A scroll boundary is never written alone. It travels with a bound from [Measure](measure.md), because
a region with no height cap never overflows and its scroll class does nothing.

## Overflow Common already owns

Generated from `@grammar/core` claims by `scripts/generate-presentation-owned.mjs`; edit the component, not this table.

| Component | Element or condition | Rule |
| --- | --- | --- |
| `ChatWorkspace` | conversation | OVERFLOW-4 |
| `ChatWorkspace` | conversation | OVERFLOW-5 |
| `ChatWorkspace` | drawer body, hasRail, isCompactRail | OVERFLOW-2 |
| `ChatWorkspace` | overlay rail, hasRail, isCompactRail | OVERFLOW-4 |
| `ChatWorkspace` | overlay rail, hasRail, isCompactRail | OVERFLOW-5 |
| `ChatWorkspace` | overlay rail, hasRail, not isCompactRail | OVERFLOW-4 |
| `ChatWorkspace` | overlay rail, hasRail, not isCompactRail | OVERFLOW-5 |
| `FencedCodeBlock` | root | OVERFLOW-4 |
| `HorizontalScrollRegion` | root | OVERFLOW-5 |
| `HorizontalScrollRegion` | root, overflow!="needed" | OVERFLOW-3 |
| `HorizontalScrollRegion` | root, overflow="needed" | OVERFLOW-4 |
| `IconTile` | root | OVERFLOW-2 |
| `MarkdownTableFrame` | root | OVERFLOW-4 |
| `MediaFrame` | root | OVERFLOW-2 |
| `OtpInput` | root | OVERFLOW-3 |
| `OtpInput` | root | OVERFLOW-5 |
| `Rail` | body, height!="fill" | OVERFLOW-3 |
| `Sidebar` | root | OVERFLOW-2 |
| `SurfaceAccordionCard` | accordion shell | OVERFLOW-2 |
| `SurfaceAccordionCard` | accordion shell, not bounded | OVERFLOW-1 |
| `SurfaceCard` | card content, frame!="frameless" | OVERFLOW-2 |
| `SurfaceCard` | card content, frame="frameless" | OVERFLOW-1 |
| `SurfaceListCard` | root | OVERFLOW-2 |
| `VerticalScrollRegion` | root, isScrollable | OVERFLOW-3 |
| `WorkspaceShell` | floating layer, hasFloatingLayer | OVERFLOW-4 |

## OVERFLOW-1 — Visible

The boundary does not clip, because something must be allowed to cross it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A region whose child carries a focus ring, shadow, or badge that sits outside the box | `App` | No class. Visible is the default |
| Case 2 | A surface that must not clip its own highlight | `SurfaceCard` | The frameless variant already stays visible |

Not this rule: leaving a bounded region visible to avoid deciding. Content that escapes silently
overlaps whatever follows it.

## OVERFLOW-2 — Clipped

Content is cut at the boundary and cannot be reached.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A rounded region whose children must stay inside the radius | `SurfaceCard` | Compose the card; it already clips |
| Case 2 | A media viewport that crops its image to a fixed frame | `MediaFrame` | Compose the frame; it already clips |
| Case 3 | An app-owned decorative region whose overflow carries no information | `App` | `overflow-hidden` |

Clipping content the reader needs is silent data loss. It looks correct in a screenshot at one width
and fails at another, which is why it is the hardest overflow defect to find.

Not this rule: text that does not fit. That is [Text flow](text-flow.md), and it truncates visibly
rather than disappearing.

## OVERFLOW-3 — Scrolls on one axis

The boundary always scrolls one axis, because its content is expected to exceed it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A row of items intentionally wider than the viewport | `HorizontalScrollRegion` | Compose the region |
| Case 2 | A bounded panel or list whose content grows | `VerticalScrollRegion` | Compose the region |
| Case 3 | A rail body that scrolls while its shell stays put | `Rail` | Compose the rail |

The other axis stays clipped or visible on purpose. A region that scrolls both axes hides content in
a direction the reader has no reason to look.

Not this rule: a region whose content usually fits. Use OVERFLOW-4 so the bar appears only when it
means something.

## OVERFLOW-4 — Scrolls when needed

The boundary scrolls only when content actually exceeds it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A wide table inside a narrower column | `MarkdownTableFrame` | Compose the frame |
| Case 2 | Long code lines that must not wrap | `FencedCodeBlock` | Compose the block |
| Case 3 | A tab strip that exceeds its width only in some languages | `Tabs` | Compose the tabs |
| Case 4 | An app-owned bounded region whose content sometimes exceeds it | `App` | `overflow-auto` with the matching height cap |

Not this rule: an always-visible bar on a region that usually fits, which reads as a defect the first
time a reader sees it empty.

## OVERFLOW-5 — Contained

Scrolling stops at this boundary instead of continuing into the page behind it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A scrolling panel, drawer, or overlay above page content | `—` | `overscroll-contain` with the scroll rule |
| Case 2 | A horizontal row inside a vertically scrolling page | `HorizontalScrollRegion` | Compose the region; it already contains the inline axis |

Without containment, reaching the end of the inner region hands the gesture to the page and the
reader loses their place. On a touch device the effect is worse, because the page moves under a
finger that was scrolling something else.

Not this rule: containment on the page's own scroller, which would trap the reader.

## What this file does not decide

How large the region is, and whether it has a height cap at all, is [Measure](measure.md). What text
does when it does not fit is [Text flow](text-flow.md).
