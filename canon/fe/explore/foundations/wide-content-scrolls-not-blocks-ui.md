# Wide content SCROLLS, it does not block the UI

A block that can be wider than the column containing it gets `overflow-x-auto`; a flex chain that
contains one gets `min-w-0`. The heuristic belongs to the `responsives/*` family — how things shrink
and overflow with the viewport.

Read out of the mermaid case in the lesson reader and the hero, 2026-06-27: a wide mermaid SVG kept
the reading column from shrinking as the browser narrowed, and overflowed the whole page
horizontally. The ruling was that content which cannot shrink should scroll on its right, rather
than block the UI.

## 1. The rule (STRICT)

**Any block that can exceed its containing column is wrapped in `overflow-x-auto`** — scrolling
horizontally INSIDE its frame — instead of widening the column or the page. That covers mermaid
SVGs, tables, code and `<pre>` with long lines, iframes and embeds, fixed-size images and diagrams,
and sandboxes.

Content is never allowed to break the layout. Scrolling is the lesser cost.

## 2. The flexbox min-content trap

A flex item does NOT shrink below its content width unless it has `min-width: 0` (`min-w-0`); the
default is `min-width: auto`. So one wide child — an SVG, a `<pre>`, a table — forces the entire
column to stay wide. The fix has two layers:

1. **`min-w-0` on the CHAIN of flex items** (shell content column, then reader, then wrapper) so
   they are allowed to shrink.
2. **`overflow-x-auto` on the wide block itself.** This is the part that actually fixes "the page
   will not get smaller": a scroll container has `min-content = 0`, so its flex ancestors become
   free to shrink — and the wide content scrolls in its box instead of spilling out of `body`.

## 3. A utility class does not beat a third-party library's INLINE style

Mermaid v11 stamps `style="max-width: Npx"` inline on the `<svg>`. That BEATS a class such as
`[&_svg]:max-w-full` (`max-width: 100%`), because inline style outranks any class — so the class is
dead code and the SVG stays N wide.

The right handling, in order:

- **Prefer wrapping in `overflow-x-auto`.** Safest: whatever width the SVG claims, it cannot break
  the layout, and it still scales to fit when there is room.
- Or force it with `!important` (`[&_svg]:!max-w-full`) when you genuinely want fit-without-scroll.
  For diagrams the settled choice is scrolling, which keeps the diagram legible instead of squeezing
  it to nothing.

## 4. Diagnosing "the page will not shrink / it overflows sideways"

It is usually not the parent component — those normally already have `min-w-0`. Look at the WIDEST
CHILD (mermaid, table, `pre`) and check two things: does it have `overflow-x-auto`, and does the
flex chain above it have `min-w-0`. One block missing its overflow is enough to hold the whole page
open.

## 5. Neighbouring cases, deliberately different

- **Wide content that must keep its size to stay readable** (diagram, table, code) —
  `overflow-x-auto`.
- **A rail or panel too long VERTICALLY** — `ScrollShadow`, with a faded edge
  ([[sticky-rail-overflow-wrap-scrollshadow]]). Different axis, same family: contain the overflow
  rather than letting it spill.
- **Jitter from the vertical scrollbar appearing and disappearing** —
  `html { overflow-y: scroll; scrollbar-gutter: stable }` ([[scrollbar-gutter]]).

## First applied 2026-06-27

`MarkdownContent/MermaidDiagram`: the div wrapping the SVG had `[&_svg]:h-auto [&_svg]:max-w-full`
and gained `overflow-x-auto`. A wide diagram now scrolls inside its figure, the reading column
shrinks normally, and `body` no longer overflows. Code blocks and tables in `MarkdownContent`
already scrolled on their own — mermaid was the one block missing its overflow.

## Related

[[scrollbar-gutter]] · [[sticky-rail-overflow-wrap-scrollshadow]] (vertical overflow of a rail) ·
[[gap]] · [[three-tier-page-layout]] (the reading column at `max-w-3xl` with `min-w-0`).
