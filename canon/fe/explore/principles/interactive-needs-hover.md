# Every interactive element needs a hover state and `cursor-pointer` — STRICT

An element that does something and shows nothing on hover is indistinguishable from text. Nielsen
Norman's work on perceived affordance is blunt about the cost: users do not hunt for hidden controls,
they conclude the control is not there. A summary row that opens a settings drawer but reacts to
nothing looks static, so nobody discovers it.

Which KIND of hover — underline, opacity, or fill — is decided in
[[hover-style-matches-clickable-nature]]. This file only says that there must be one.

## The rules

**Anything clickable, openable or navigable gets a hover response AND a hand cursor.** Buttons, rows
that open a drawer, links, clickable chips. A native `<button>` does not carry `cursor-pointer` on
its own, so add it.

**The hover is triggered by the WHOLE element, not by the text.** Wrap the element in `group` and put
child effects on `group-hover:*`, so the pointer anywhere inside the element fires the effect.
Putting `hover:*` directly on each text child means the effect only appears when the pointer happens
to land on a glyph — and it shrinks the effective target far below the size Fitts's Law says you are
paying for:

```tsx
// The row is the trigger; the label reacts
<div className="group flex cursor-pointer items-center justify-between gap-2">
  <span className="group-hover:underline">Notification settings</span>
  <CaretRightIcon className="text-muted" />
</div>

// Wrong: only underlines when the pointer is on the word itself
<span className="hover:underline">Notification settings</span>
```

**A row or block acting as a LINK underlines its label** rather than recolouring the whole block —
the go-there mode in [[hover-style-matches-clickable-nature]]. A read-only preview sitting beside it
(for example "Weekly digest, Mondays" next to the caret) stays `text-muted` and does NOT react to
hover, because it is not the thing being clicked. Anything that lights up under the pointer is
promising a click, so a decorative value that lights up is lying.

**The caret and meta of a row sit right**, via `justify-between`, separated from the label by at
least `gap-2` — never flush against it.
