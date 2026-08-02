# Accessibility

The a11y rules were scattered — a paragraph in the colour file (§5), a paragraph in the icon file,
another in `status-icon-overrides-base`. They are collected here as one baseline so that a **new**
component is checked against all of it, not only against the parts that happened to live near
whatever it was copied from.

## The test

**Every affordance must work without seeing colour, work from the keyboard, and not be silent to a
screen reader.**

## The rules

- **Contrast.** Text at 4.5:1 or better, icons and secondary marks at 3:1 or better. Coloured text
  on a light tint — `text-accent` on `bg-accent/10` is the case that actually occurs — has to be
  measured, not assumed. The StarCi accent is light, around 70% lightness, so this pairing misses
  AA more often than it looks like it should.
- **Focus.** Every interactive element carries a visible `focus-visible:ring`, distinct from its
  hover style. A keyboard user has to be able to see where they are without moving a mouse.
- **Icon-only controls require `aria-label`.** And when the icon *changes meaning* with state — a
  lock replacing a puzzle piece once the item is locked — the label changes with it. Keeping the
  old label is worse than having none, because it now describes something else.
- **Colour is never the only channel.** Any status or category expressed in colour also carries an
  icon or a word: done is `text-success` **and** `CheckCircleIcon`, not green alone.

Already applied in: the colour rule §5 (contrast, and colour is not the only channel);
`status-icon-overrides-base` (an icon that changes meaning changes its `aria-label` too);
`interactive-needs-hover.md` (a focus ring is mandatory on everything interactive).

Related: `interactive-needs-hover.md`, and the disable-versus-lock rule, which gives the two reasons
an item can be unavailable two different icons — the same principle of not leaning on colour.
