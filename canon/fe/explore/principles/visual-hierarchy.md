# Visual hierarchy

Rank is the job of TYPOGRAPHY and COLOUR, not of adding another frame or box. Refactoring UI states
the same rule from the other end — when something is competing for attention, de-emphasise its
neighbours rather than shouting louder — and Material's emphasis levels are that idea encoded as
tokens.

## The rule of thumb

**At most one MAIN action per screen; rank between elements comes from SIZE, WEIGHT and COLOUR inside
one system — never from adding a border, a background or a new box to "emphasise" something.**

## The rules

**One `primary` (solid accent) per surface.** Every other action drops to `secondary`, `tertiary` or
`ghost`. A second solid button beside the first is a second voice at the same volume: the hierarchy
is gone and the reader cannot tell what to press first. The Von Restorff effect only pays out when
one thing differs; two focal points cost the attention of one and buy nothing.

**A secondary label or identifier** — an ordinal, an eyebrow, a piece of meta, a count — always ranks
BELOW the title it belongs to: smaller and dimmer (`text-xs text-muted`), never larger, bolder or
more saturated. An inverted rank, where the secondary outshouts the primary, is a defect to fix
rather than a successful emphasis; a card whose loudest element is its category tag is a card whose
name nobody read.

**Rank within a group of text is size, weight and colour token** — not a chip or a border drawn
around the part you want noticed. Jewellery that does not correspond to real rank is read as noise,
and once a surface has taught the reader that its boxes mean nothing, the box that does mean
something is invisible too.

**Accent is one of the tools of hierarchy, not all of them.** Use it only for the roles
[[accent-system]] defines; do not paint something accent-coloured simply to emphasise it. Most rank
problems are solved a step earlier, by making the neighbours quieter.

## Related

[[accent-system]] · [[design-restraint]].
