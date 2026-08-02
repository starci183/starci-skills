# Wide content SCROLLS, it does not block the UI

A block that can be wider than the column containing it gets its own horizontal scroll; a flex chain
that contains one gets `min-width: 0`. Content is never allowed to break the layout — scrolling is
the lesser cost, and it is the only cost the reader can recover from.

The case that establishes it: a wide diagram inside a reading column keeps the column from shrinking
as the browser narrows, and eventually overflows the whole page sideways. Every symptom points at
the page layout; the cause is one child that was never told it may scroll.

## 1. The rule (STRICT)

**Any block that can exceed its containing column is wrapped in a horizontal scroll container**, so
it scrolls inside its own frame rather than widening the column or the document. That covers
generated SVG diagrams, data tables, preformatted code with long lines, embedded frames, fixed-size
images, and anything rendered by a third party.

## 2. The flexbox min-content trap

A flex item does NOT shrink below its content width unless it is given `min-width: 0`; the initial
value is `auto`, and `auto` means "no smaller than my content". This is specified behaviour, not a
browser quirk, and it is the single most common cause of a layout that will not get smaller.

So one wide child — an SVG, a `<pre>`, a table — forces the entire column to stay wide, and the
column forces its parent, and so on up to the document. The fix has two layers:

1. **`min-width: 0` on the CHAIN of flex items** — shell, content column, reader, wrapper — so they
   are permitted to shrink at all.
2. **The horizontal scroll on the wide block itself.** This is the part that actually resolves it: a
   scroll container has a min-content contribution of zero, so its flex ancestors become free to
   shrink, and the wide content scrolls in its box instead of spilling out of the document.

Either layer alone leaves the bug in place. That is why it is usually diagnosed twice.

## 3. A utility class does not beat a third-party library's INLINE style

Libraries that generate SVG commonly stamp `style="max-width: Npx"` on the element they produce.
An inline style beats any class, whatever its specificity, so a `max-width: 100%` utility written
against it is dead code that looks alive.

The right handling, in order:

- **Prefer the scroll wrapper.** Whatever width the generated element claims, it cannot break the
  layout, and it still scales down to fit when there is room.
- Force it with `!important` only when you genuinely want fit-without-scroll, and accept what that
  means: at narrow widths a complex diagram squeezed to fit is legible to nobody.

## 4. Diagnosing "the page will not shrink"

It is rarely the parent component — those usually already carry `min-width: 0`, because somebody hit
this before. Find the WIDEST CHILD and check two things: does it have its own overflow, and does the
flex chain above it permit shrinking. One block missing its overflow is enough to hold the entire
page open, and the block will look completely innocent.

## 5. Neighbouring cases, deliberately different

- **Wide content that must keep its size to stay readable** — a diagram, a data table, a code block:
  horizontal scroll.
- **A rail or panel too long VERTICALLY** — a bounded max height with a faded edge, so the cut is
  visibly a cut rather than an accident. Different axis, same family: contain the overflow rather
  than letting it spill.
- **Jitter from the vertical scrollbar appearing and disappearing** — see [[scrollbar-gutter]].

## Related

[[scrollbar-gutter]] · [[gap]] · [[region-model]] (the reading column, and why its measure belongs to
the column rather than to the renderer).
