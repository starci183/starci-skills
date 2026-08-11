# input

## Definition

An input is a control drawn on a ground. Its variant states its relationship to that ground; it is
not decoration and it is not a caller-owned preference.

## Rules

**INPUT-1 · An input inside a bounded surface uses HeroUI `secondary`.**

A dialog, card, drawer, or popover already supplies the bounded ground. The default input appearance
draws another competing field surface inside it; `secondary` keeps the control distinct without
claiming a second container.

**INPUT-2 · The house Field owns the choice.**

Callers receive no `variant` slot. `Field` maps the house relationship to the vendor once, and a new
ground relationship requires a named semantic leaf or variant rather than a raw HeroUI value.

The mechanical fence is `field-input-uses-secondary-variant` in
[`sources/fe/vendor-boundary.mjs`](../../sources/fe/vendor-boundary.mjs).

## Forbidden

| Never | Why | Instead |
|---|---|---|
| Default HeroUI Input inside a bounded surface | It draws a second surface inside the first | House `Field`, fixed to `secondary` |
| Public `variant` prop carrying HeroUI names | It makes every caller a second visual owner | A named semantic distinction inside the leaf |
