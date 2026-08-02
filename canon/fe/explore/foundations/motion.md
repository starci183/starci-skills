# Motion

Motion in an interface is either information or decoration. Information — a spinner, a progress bar,
the shift that shows a row was removed — must survive every accessibility setting the user has.
Decoration must not survive `prefers-reduced-motion`. Almost everything below follows from that one
division.

## 1. Transition the property, not everything

Hover and focus change colour, so a colour-only transition dominates real usage in any product; a
fade transitions opacity; a caret rotating or an arrow sliding transitions transform. Naming the
property is not pedantry — the browser can composite opacity and transform on the compositor thread
without touching layout, and a transition that names them stays smooth under load.

`transition: all` is only for the case where two properties from different groups genuinely need to
animate together, and that case has been confirmed rather than assumed. As a default it animates
everything the browser can, including properties nobody intended, and it costs more to composite
than the two it was meant to cover.

## 2. Durations sit in a narrow band

Material's motion durations are a good public reference point: short in the 50-200ms region, medium
250-400ms, long 450-600ms, with anything longer reserved for something entering or leaving the whole
screen. Read back out of real usage, most products end up using four values — 150, 200, 300 and 500
milliseconds — and nothing else.

150-300ms covers micro-interaction: hover, focus, a state change on a control. 500ms is for a larger
fade, a page-level transition, an entry animation. Below roughly 100ms the motion is not perceived as
motion, and above roughly 500ms the user is waiting for the interface rather than using it.

## 3. `prefers-reduced-motion` is MANDATORY for every decorative animation

It does not apply to essential feedback such as a loading indicator, where removing the motion
removes the information. Everything else — ambient backgrounds, parallax, scroll-driven scenes,
entrance animations, a bounce on a reaction — must have a reduced branch. WCAG 2.3.3 makes this a
requirement for motion triggered by interaction, and vestibular disorders make it a requirement in
practice for the rest.

Two mechanisms, chosen by where the animation lives:

- **CSS keyframes** — guard them inside `@media (prefers-reduced-motion: reduce)` in the same file
  as the animation itself, so the guard cannot be separated from the thing it guards.
- **JavaScript-driven motion** — read the same query through the animation library's reduced-motion
  hook and switch the interpolation off, falling back to a hard cut. A hard cut is a correct
  reduced-motion answer; a slower version of the same animation is not.

## 4. Keyframes live in ONE book

No loose keyframes in a component-scoped stylesheet or an inline style block. One place for the
whole product means a duplicate is visible before it ships, and the reduced-motion guard in the
previous section has a single surface to cover rather than a search to perform.

Keep a transform used for entrance separate from a transform used for hover by putting them on
different elements — the entrance on the wrapper, the hover scale on the inner span. Two animations
writing `transform` on the same element overwrite each other, and the loser is decided by whichever
rule the cascade happens to resolve last.

## 5. Skeletons share one animation

Every skeleton in the product uses the same shimmer, at the same speed, in the same direction. Two
shimmer styles on one page reads as two different kinds of loading, and that is a claim the
interface is not actually making. It is also the cheapest possible thing to get wrong, because each
one looks fine in isolation.

## 6. Decide the tooltip delay deliberately

Component libraries commonly ship a long hover delay before a tooltip opens — a second and a half is
typical — and a shorter one before it closes. Whether that hesitation is right depends on how
information-dense the surface is: on a toolbar of icon-only buttons it is an obstacle, and setting
both delays to zero makes the labels feel like part of the interface rather than a reward for
waiting. On text peppered with definitions it is what stops the page flickering as the pointer
crosses it.

The rule is not a number. It is that the number is chosen once, at the theme level, rather than
inherited by default and then patched at three call sites.

## 7. The loading tiers are their own concept

A cold-load splash, a navigation progress bar, and a region skeleton answer three different
questions about three different waits. That is a larger idea than motion alone.

## Related

[[z-index]] (a splash and a top progress bar belong to the same layering system).
