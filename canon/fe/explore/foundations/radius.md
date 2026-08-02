# Radius

The radius scale has ONE root token and every other step is a multiple of it — not a set of loose
values chosen by hand.

Source: `globals.css` (`--radius`, `--field-radius`) and `@heroui/styles` heroui.min.css, where
`--radius-xs/xl/2xl/3xl/4xl` derive from `--radius` and `--field-radius: calc(var(--radius) * 1.5)`.

## 1. `--radius: 0.5rem` (8px) is the only source

`@heroui/styles` derives the scale from it: `radius-xs` is 0.25x (2px), `xl` is 1.5x (12px), `2xl`
is 2x (16px), `3xl` is 3x (24px), `4xl` is 4x (32px).

`sm`, `md` and `lg` keep their Tailwind defaults and are NOT multiplied by `--radius` — worth
knowing before you assume a step is on the derived scale.

## 2. `--field-radius: 0.75rem` is its own token

It is fixed, and it happens to equal `radius-xl` (1.5x). It exists separately because inputs,
selects and button fields are a family that may move independently of the card scale; the utility is
`rounded-field`. Writing `rounded-xl` on a field because the number currently matches is a
coincidence that will break the day the field family moves.

## 3. Concentric — an inner radius is exactly one step below its container

This is already the pattern throughout the app:

```
card          rounded-3xl
 media/block  rounded-2xl
  input/field rounded-xl
   chip/avatar/switch pill  rounded-full
```

The step follows the DEPTH of nesting. Do not skip a step, and do not pick a radius for a new block
by eye — a mismatched inner corner reads as a rendering bug rather than a style choice. See
[[card]] (the render gotcha, and inner media radius) and [[input]] §2.

## 4. `rounded-*` in a className does nothing to an UNLAYERED HeroUI component

`.card`, `.accordion--surface`, `.modal__dialog` and friends bake their radius in unlayered CSS. A
Tailwind utility lives in `@layer utilities`, which LOSES to unlayered CSS regardless of
specificity — so the className is silently ignored. No error, no change, just a class that looks
like it is doing something.

If a HeroUI component's corner has to change, change it at the token or the component's own
variable, not from the outside. See the render gotcha in [[card]].

## Related

[[card]] · [[input]] · [[gap]] (the parallel spacing scale, on the same "one root, multiplied
steps" logic).
