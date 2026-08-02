# One quantity, one shared render component — STRICT

Read from the course price, which was rendered in four places with drifting logic and produced the
"the discount doesn't show" bug (2026-06-24).

## The rules

**A quantity displayed in several places — price, progress, status, rating — has exactly ONE shared
component that renders it.** When the same thing (say "discounted price = discounted + struck-through
original + −%") appears on two or more surfaces, extract it into a single block, for example
`PriceTag`, and import that everywhere. Do not copy the JSX plus its computation (the gate, the
percentage, the formatting) into each feature.

**Why:** N copies means N versions of the logic to keep in sync by hand. Fix one, forget the others,
and the surfaces drift silently. That is exactly what happened with the price: the
`discountPercent > 0` gate was right in one place and wrong — hiding the discount — in the other
three, because each site had written its own. One block means one fix, correct everywhere.

**The block/feature boundary:** the block owns PRESENTATION (formatting, the display gate, the type
size). The feature owns COMPUTATION (choosing loyalty versus phase pricing, currency conversion,
where the data comes from) and passes the already-computed numbers down. Business logic — loyalty,
USD, phase — does not go into the block; only the result does.

**The signal that it is time to extract:** you are copying a cluster of "render X" JSX plus a few
lines of computation into a second file. Stop and extract the block. This matters most for things
with rules that are easy to get subtly wrong — a discount gate, percentage rounding, currency
formatting — where one wrong copy is a silent bug rather than a crash.

## First applied 2026-06-24

The course price was rendered in `PaymentModal`, `PremiumGateModal`, `PremiumPaywall` and
`CoursePricingRail`; all four were collapsed into the `PriceTag` block. The gate now keys on the real
difference between the two prices rather than on a loyalty flag, which ended the "discount doesn't
show" bug. The feature passes `discountedVnd` / `originalVnd` / `percent`; the block renders them.
