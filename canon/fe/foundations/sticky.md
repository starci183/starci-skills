# Sticky

Settled 2026-06-24. Default behaviour for a rail, a panel, or any element that holds its place while
the page scrolls.

## 1. Pin at the element's RESTING position, not flush to the navbar

A sticky element — the purchase card in the right column, a sub-header, a tab strip — should pin
where it already sits. Done right, it looks like it simply STOPPED, with no visible jump.

The standard offset is `sticky top-[88px]`: navbar `h-16` (64px) plus the column's `py-6` padding
top (24px) equals 88px, which is exactly where the element rests. Pin there and the card does not
move at all as scrolling begins. Pair it with `self-start`.

`top-22` would also be 88px, but 22 is not on the default Tailwind scale, so the arbitrary
`top-[88px]` is the honest spelling here.

The formula is `top = navbar height + the containing column's padding-top`. A page with different
padding recomputes it — a column at `py-8` pins at `top-[96px]`.

## 2. `top-16` is banned for anything with column padding above it

Pinning HIGHER than the resting position makes the element visibly jerk upward against the navbar
edge as soon as the page moves. Rejected 2026-06-24. `top-16` is correct only for an element that
genuinely touches the edge already — full-bleed, no padding above it.

## 3. The outer container owns POSITION; overflow is wrapped

`sticky top-[88px] self-start` goes on the container. Content that outgrows the viewport is wrapped
in `ScrollShadow` (a `max-h` plus overflow), never left to overflow raw. See
[[sticky-rail-overflow-wrap-scrollshadow]].

## 4. Scrolling does not compress the header

While the page scrolls, the header cluster at the top — breadcrumb, title, description, chips —
keeps its gaps. Only the content below moves. The sticky element grips its edge; the header's rhythm
is untouched. See [[gap]].

## 5. Sticky, not fixed

`position: sticky` stays in flow, which is why it is the default for a rail or a sub-header. Do not
use `position: fixed` for content rails — only the navbar and overlays are fixed, because they are
the only things that genuinely leave the document flow.

The sidebar identity block (the profile) is NOT sticky. A horizontal tab strip or sub-header at the
top of a page is sticky at `top-20` by default; `top-16` applies only when that element touches the
edge with no padding above it.
