# One quantity, one shared render component — STRICT

## The rules

**A quantity displayed in several places — price, progress, status, rating — has exactly ONE shared
component that renders it.** When the same thing (say "discounted price = new price, struck-through
original, and the percentage off") appears on two or more surfaces, extract it into a single block,
`PriceTag`, and import that everywhere. Do not copy the markup plus its computation — the display
gate, the percentage, the formatting — into each feature.

**Why:** N copies means N versions of the logic to keep in sync by hand. Fix one, forget the others,
and the surfaces drift silently. The classic failure looks like this: the price appears in the cart,
the checkout summary, the paywall and the order receipt, each written separately; the
`discountPercent > 0` gate is correct in one of them and inverted in the rest, so the discount is
applied to the charge but never shown to the buyer. Nothing crashes, no type is wrong, and the bug is
reported as "the discount doesn't show" months later.

**The block/feature boundary:** the block owns PRESENTATION — formatting, the display gate, the type
size. The feature owns COMPUTATION — choosing which price applies, currency conversion, where the
data comes from — and passes the already-computed numbers down. Business logic does not go into the
block; only the result does. That split is what lets one render component serve surfaces whose
pricing rules genuinely differ.

**The signal that it is time to extract:** you are copying a cluster of "render X" markup plus a few
lines of computation into a second file. Stop and extract the block. This matters most for things
with rules that are easy to get subtly wrong — a discount gate, percentage rounding, currency and
date formatting, a plural — where one wrong copy is a silent lie rather than a crash.

The end state is worth naming: the feature passes `discountedAmount`, `originalAmount` and `percent`;
the block decides what a reader sees. One fix, correct everywhere.
