# Every interactive element needs a hover state and `cursor-pointer` — STRICT

Read from the "Cài đặt chấm điểm" summary row, which opened a drawer but had no hover affordance:
it looked static, so nobody discovered it was clickable. An element that does something and shows
nothing on hover is indistinguishable from text.

Which KIND of hover — underline, opacity, or fill — is decided in
[[hover-style-matches-clickable-nature]]. This file only says that there must be one.

## The rules

**Anything clickable, openable or navigable gets a hover response AND a hand cursor.** Buttons,
rows that open a drawer, links, clickable chips. A native `<button>` does not carry
`cursor-pointer` on its own, so add it.

**The hover is triggered by the WHOLE element, not by the text.** Wrap the element in `group` and
put child effects on `group-hover:*`, so the pointer anywhere inside the element fires the effect.
Putting `hover:*` directly on each text child means the effect only appears when the pointer happens
to land on a glyph:

```tsx
// The row is the trigger; the label reacts
<div className="group flex cursor-pointer items-center justify-between gap-2">
  <span className="group-hover:underline">Cài đặt chấm điểm</span>
  <CaretRightIcon className="text-muted" />
</div>

// Wrong: only underlines when the pointer is on the word itself
<span className="hover:underline">Cài đặt chấm điểm</span>
```

**A row or block acting as a LINK underlines its label** rather than recolouring the whole block —
the go-there mode in [[hover-style-matches-clickable-nature]]. The read-only preview sitting beside
it (for example "TypeScript · main" plus the caret) stays `text-muted` and does NOT react to hover,
because it is not the thing being clicked.

**The caret and meta of a row sit right**, via `justify-between`, separated from the label by at
least `gap-2` — never flush against it.
