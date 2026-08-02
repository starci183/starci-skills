# Gap and vertical rhythm

One scale covers all spacing — gap and padding alike. Refactoring UI puts it first among its layout
chapters for a reason: the difficulty in spacing is never picking a good value, it is picking the
same good value twice, and a scale is the only mechanism that makes that automatic.

## 1. A five-step scale, not a continuum

Written in a system where one unit is 4px, the steps are `0 · 2 · 3 · 6 · 8`:

- **`0`** — glued together: a number and its unit, an eyebrow sitting tight against the title it
  belongs to.
- **`2`** (8px) — a sub-cluster, two things that are really one thing: title and description, price
  and its discount badge, icon and label, chip and chip. Also item-to-item inside a dense list of
  short muted rows, and a label sitting directly above a single text input.
- **`3`** (12px) — within one block: label to content, rows inside a card, sibling sub-blocks at the
  same level. Also a label above a card, a radio group, or a cluster of controls, which need more
  air than a label above one input and therefore step up from `2`.
- **`6`** (24px) — between two regions with different jobs: section to section, the two halves of a
  split. **Only for genuinely large clusters.** Several small components stacked inside a dialog — a
  summary, a list of payment methods, a link, a reassurance line — stay at `3`. The step is chosen
  by the SIZE of the blocks, not merely by the fact that they do different things.
- **`8`** (32px) — a wider separation when a cluster genuinely needs a larger beat.

Anything off the scale — 1, 1.5, 5, 7, 9 — is out, except the named exceptions below. The point of a
five-step scale is that a reader can infer the relationship between two elements from the gap alone,
which is the Gestalt law of proximity doing the work the markup cannot. A sixth value nobody can
name destroys that inference for every element on the page, not just the one it was added for.

## 2. Two named exceptions, and why they are named

**A page header to the content below it takes a step above the top of the scale** — 40px is a
reasonable value. The header cluster (breadcrumb, title, description, status chips) earns one large
breath before the page's content starts, and this is the only place in an application that uses it.

**On a marketing page, a section heading to its content takes more still** — around 64px. Marketing
pages breathe differently from applications: the reader is scrolling, not working, and the rhythm
that reads as generous on a landing page reads as broken on a settings screen. Where a section has
several content blocks, wrap them so that heading-to-content keeps the large value while the
content's own internal rhythm stays on the ordinary scale.

An exception that is written down, named, and given a reason is a scale with two tiers. An exception
that is merely used is a scale with a hole in it.

## 3. A divider inside a card or a stack takes the small gap on both sides

When two blocks are separated by a rule inside one card, the space above and below that rule is the
`3` step, not the `6`. The divider is already doing the separating; paying 24px on each side as well
reads as a gulf, and the reader starts to wonder what is missing between them.

Implement it symmetrically — the container's own gap supplies the space above, the lower block's
padding-top supplies the space below — so that both sides are provably equal rather than
coincidentally equal. Each block keeps its own internal rhythm; only the band around the divider is
pinned.

Same spirit as preferring whitespace to dividers in the first place: if whitespace can do the
separating, do not draw a line, and if you do draw one, do not also pay for the whitespace.

## 4. In a vertical stack, the large gap DIVIDES and the small gap GROUPS

The large step marks the boundary between two regions with different jobs; everything inside one
region uses the small step. Spreading the large gap evenly over every stacked block leaves a page
that is thin and shapeless — a list of things with no structure. Forcing everything to the small gap
erases the region boundaries entirely. Group into small-gap clusters first, then spend the large gap
on the one line that actually divides them.

A documentation reader is the worked example. Region A is identity and action: breadcrumb, title,
and the resume control with its progress meter, internally at `3`. Region B is browsing: the search
field and the index tree, internally at `3`. Between A and B, `6`. One large gap on the whole page,
and the page has a shape.

The resume control and its meter stay **flat on the page background, not wrapped in a card**. It is
the primary action with a meter attached; wrapping it produces a box inside a box, and a card is for
a bounded object rather than for anything the author wants to emphasise.

The loading skeleton mirrors the same structure and the same rhythm — large dividing, small
grouping — so that nothing shifts position when the data lands.

## 5. Scrolling does not compress the header

While the page scrolls, the header cluster keeps its gaps unchanged. The content below scrolls; the
header's rhythm does not shrink into a denser version of itself. A header that collapses as you
scroll is a separate design decision with its own cost, not a free improvement, and it should never
happen by accident. See [[sticky]].

## 6. Reading the scale back

Each pair of elements picks its step from the relationship between them: glued (0), sub-cluster (2),
within a block (3), between blocks (6), between wide regions (8), header to content (the named
exception).

Card padding is a separate decision, owned by the card rather than by this scale. Read it from the
card's own rule rather than quoting a number from here, because the two scales are allowed to move
independently and the day they do, a number copied across is silently wrong.
