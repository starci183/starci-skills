# Accessibility

Accessibility rules decay when they live scattered — a paragraph in the colour rule, a sentence in
the icon rule, a note attached to one component. Collected as one baseline, they can be applied to a
**new** component in full, rather than only in the parts that happened to sit near whatever it was
copied from.

## The test

**Every affordance must work without seeing colour, work from the keyboard, and not be silent to a
screen reader.**

## The rules

- **Contrast.** Text at 4.5:1 or better (WCAG 2.2, 1.4.3), icons and other non-text marks at 3:1 or
  better (1.4.11). Coloured text on a tint of the same colour — accent text on a ten-percent accent
  wash is the pairing that actually occurs — has to be measured, not assumed. A light, high-chroma
  brand colour, anywhere near 70% lightness, misses AA in that pairing far more often than it looks
  like it should; the tint raises the background luminance and the text barely moves.
- **Focus.** Every interactive element carries a visible focus ring, distinct from its hover style
  (2.4.7 Focus Visible), and it must not be hidden behind a sticky header or a floating bar (2.4.11
  Focus Not Obscured). Someone driving the page from the keyboard has to see where they are without
  moving a mouse.
- **Icon-only controls carry an accessible name.** A button whose whole content is a glyph is
  nameless to assistive technology unless it is labelled. And when the icon *changes meaning* with
  state — a lock replacing an open padlock once the row becomes unavailable — the label changes with
  it. Keeping the old label is worse than having none, because it now describes something else.
- **Colour is never the only channel** (1.4.1 Use of Color). Any status or category expressed in
  colour also carries an icon or a word: a completed row is the success colour **and** a check mark,
  not green alone. Roughly one man in twelve cannot separate the two colours a red-green status
  column relies on.

The reason to state all four together is that they fail together. A control with no hover state
usually also has no focus ring; a status column that leans on colour usually also fails contrast,
because the colour was chosen to be pleasant rather than to be legible.

Related: `interactive-needs-hover.md`, and the rule that gives "disabled" and "locked" different
icons, which is the same principle of not leaning on colour applied to two states that look alike.
