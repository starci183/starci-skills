# Grounded in real data

A layout designed against a schema is designed against a promise. A layout designed against the
records that exist is designed against the thing readers will actually meet — which usually has
fewer fields filled in, fewer rows, and more blanks than the mock did. Designing with real content
is old advice and still the one most often skipped, because placeholder text and stock imagery make
every layout look finished.

## The test

**Build the interface for the data that actually exists — including the nulls and blanks that are
common — not for the ideal schema nobody has ever filled in.**

## The rules

- **A field that exists in the schema but is always null in real records must not be designed
  against.** The layout has to look right when the field is absent; render it when it happens to be
  there, but never depend on it. Missing cover images mean a text-first layout, not an image grid
  full of empty frames. Baymard's product-listing research makes the same point from the commerce
  side: sparse records break grid layouts that assume a complete one.
- **Read the real data before choosing a pattern.** Few records — an early catalogue, a new
  workspace, a fresh account — calls for one featured anchor rather than N thin, half-empty
  sections. If most groups are still empty, "a section per group" is the wrong pattern regardless of
  how well it will work later.
- **Never invent a number or a label for the interface.** No count from the server means no count in
  a chip; no author means no byline; a category with nothing in it is not advertised. An invented
  figure survives exactly until someone checks it, and then it costs more than the empty space it
  was hiding.
- **When the real content has collapsed onto one shape** — every record turns out to be the same
  kind, every document the same length — the positioning, the taxonomy and the labels follow the
  real content, rather than keeping a generic frame and waiting for variety that has not arrived.

## One worked example

A documentation index designed for four content types — guides, references, tutorials, changelogs —
where three of the four have one entry each. The schema-shaped version renders four labelled
sections, three of which are a heading above a single row. The data-shaped version leads with the
one populated type, lists the rest as a flat set of links, and grows a section per type when a
section's worth of content exists. Nothing was removed from the schema; the layout stopped
pretending the schema was full.

Related: `affordance-and-feedback.md` (empty is one of the four states every data-backed region must
handle, and it is often empty because the data is), and the meter rule — a meter needs a real
denominator before it can run at all.
