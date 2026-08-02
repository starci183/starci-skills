# Sticky

Default behaviour for a rail, a summary panel, or any element that holds its place while the page
scrolls.

## 1. Pin at the element's RESTING position, not flush to the header

A sticky element — an order summary in a checkout's right column, a sub-header, a tab strip — should
pin exactly where it already sits. Done right it looks as though the element simply STOPPED, with no
visible jump at the moment it becomes sticky.

The offset is arithmetic, not taste:

```
top = header height + the containing column's padding-top
```

A 64px fixed header above a column with 24px of top padding gives 88px. Pin there, pair it with
`align-self: start` so the element does not stretch to the row's height, and the panel does not move
at all as scrolling begins. A column with 32px of padding recomputes to 96px.

Where the computed value is not on the spacing scale, write it as an explicit arbitrary value rather
than reaching for the nearest scale step that happens to be close. The number is derived from two
other numbers, and spelling it out is what makes that visible to the next reader.

## 2. Pinning HIGHER than the resting position is the actual bug

If the offset is smaller than the resting position — pinning at the header height when there is
column padding above the element — the element visibly jerks upward and slams against the header
edge the instant the page moves. It is the single most common sticky defect, and it only appears
once you scroll, which is why it survives a static review.

The header-height offset is correct for exactly one case: an element that genuinely touches the edge
already, full-bleed, with no padding above it.

## 3. The outer container owns POSITION; overflow is wrapped separately

Put `position: sticky` and its offset on the container. Content that outgrows the viewport is then
wrapped in its own scroll container with a max height and a faded edge, never left to overflow raw.
Two jobs, two elements: a sticky element that is also its own scroller behaves differently in every
browser you did not test.

## 4. Scrolling does not compress the header

While the page scrolls, the header cluster keeps its gaps. Only the content below moves. The sticky
element grips its edge; the header's rhythm is untouched. See [[gap]].

## 5. Sticky, not fixed

`position: sticky` stays in the document flow, which is exactly why it is the default for a rail or
a sub-header: the layout above it still reserves its space, and nothing has to be compensated for
with padding elsewhere. Nielsen Norman's work on sticky headers is worth reading alongside this —
their finding is that persistent navigation is measurably faster to use, and that the cost is
vertical space, which is a cost worth paying only for chrome the user actually returns to.

`position: fixed` is for the things that genuinely leave the flow: the top-level header and
overlays. Content rails are not among them.

An identity block — a profile summary at the top of a sidebar — is usually NOT sticky. It is the
thing you look at once. What deserves to persist is what the user reaches for repeatedly: the
navigation, the summary they are checking their work against, the action they will eventually take.
