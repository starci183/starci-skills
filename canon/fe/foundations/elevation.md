# Elevation (shadow)

There are three real shadow tiers, and none of them is an app token — all three are baked in
`@heroui/styles/dist/themes/default/variables.css`. The app adds exactly one inversion on top, for
`Card`.

## 1. Three tiers, chosen by ROLE

- `--surface-shadow` / `shadow-surface` — a card or surface at rest.
- `--field-shadow` / `shadow-field` — an input or field at rest. Practically the same weight as
  `shadow-surface` (blur around 4px).
- `--overlay-shadow` — a popover, dropdown, tooltip or modal content: three layers, blur up to 28px,
  plus one negative "throw" layer. This is the highest tier.

Choose by what the element is doing, not by how much lift you want: standing at rest on the page
takes surface or field, floating above everything else takes overlay. That is what keeps two
unrelated popovers reading as the same kind of thing.

## 2. In dark mode the resting shadows are invisible — nested surfaces need a BORDER

In `.dark`, both `--surface-shadow` and `--field-shadow` are `0 0 0 0 transparent inset`. A card
nested inside a card, or a field inside a card, therefore cannot be separated by shadow at all in
dark mode.

This is the origin of the "surface inside surface uses a border, never a second fill" rule recorded
in [[card]] §0/§4 and [[input]] §8b. It is not a stylistic preference — the shadow is literally not
rendered.

`--overlay-shadow` changes strategy in dark rather than disappearing: a faint white inset highlight
replaces the drop shadow, so a floating layer in dark mode is lit at its edge instead of casting.

## 3. Top-level takes shadow, nested takes border

App override, 2026-06-30 ([[card]] §0): `globals.css` declares `.card { border: none !important }`.
A top-level `Card` uses `shadow-surface` as its only elevation and carries no border.

Nested surfaces still need the border, for the reason in §2. So the choice is mechanical:

- top-level surface: shadow, no border
- nested surface: border, no second fill

Two stacked fills is never the answer in either mode.

## 4. Do not invent a shadow

A block that wants to "lift" reaches for one of the three utilities above by role. A hand-rolled
`shadow-[...]` adds a fourth tier that no other component shares, and the shadow language stops
being readable as soon as there are two of them.

Source: `@heroui/styles/dist/themes/default/variables.css` (`--surface-shadow`, `--field-shadow`,
`--overlay-shadow`, light versus `.dark`) and `globals.css` (`.card { border: none !important }`,
`.card--transparent`).

## Related

[[card]] §0 (the border-to-shadow inversion) · [[input]] §8b (a field nested in a card drops its
shadow) · [[radius]] (concentric radius, the same "nested surface" family).
