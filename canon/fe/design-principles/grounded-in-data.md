# Grounded in real data

The cross-cutting kernel of `landing-marketing.md` §1, which was written for the landing surface
only. It applies to **every** surface, not just marketing.

## The test

**Build the interface for the data that actually exists — including the nulls and blanks that are
common — not for the ideal schema nobody has ever filled in.**

## The rules

- **A field that exists in the schema but is always null or empty in real content must not be
  designed against.** The layout has to look right when the field is absent; render it when it
  happens to be there, but never require it. A null cover image means a text-first layout, not an
  image grid full of sad empty boxes.
- **Read the seed and the real data before choosing a pattern.** Few items, as at an early stage,
  calls for one featured anchor rather than N thin, half-empty sections. If most groups are still
  empty, "a section per group" is the wrong pattern.
- **Never invent a number or a label for the interface.** No count from the back end means no "N
  bài" stuffed into a chip; no author means no byline; no real track in the curriculum means it is
  not advertised.
- **When the real content has collapsed onto one shape** — every lesson turns out to be the same
  kind, for instance — the positioning, taxonomy and labels follow the real content, rather than
  keeping the original generic frame and waiting for content to fill it.

Already applied in: `landing-marketing.md` §1-2 — the landing case of this rule: a null field is not
depended upon, the taxonomy is reframed to match the real content, and filters pointing at empty
buckets were killed.

Related: the labelled-section rule (empty still renders meaningfully rather than self-hiding), the
meter rule (a meter needs a real denominator to run), and `affordance-and-feedback.md` (empty is one
of the three async states that must be handled).
