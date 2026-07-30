---
name: radius
tier: foundations
admitted: 2026-07-30
---

# Radius

## Role

The corner-rounding scale. One root token; every other step is a multiple of it. It governs how
round a corner is — not which surface gets a border or a shadow, which is the `surface` axis.

## Source of truth

`--radius: 0.5rem` (8px) in `globals.css` is the **only** hand-set value. `@heroui/styles` derives
the rest of the scale from it. `--field-radius` is set separately as `calc(var(--radius) * 1.5)`.

Read from `globals.css` and `heroui.min.css`, not from Tailwind's defaults — three of the steps do
not match Tailwind at all.

## Scale

| Step | Value | Derived as | Means |
|---|---|---|---|
| `rounded-xs` | 2px | 0.25 × root | hairline rounding, rarely reached for directly |
| `rounded-sm` · `md` · `lg` | Tailwind defaults | **not derived** | these three keep Tailwind's own values and do **not** scale with the root |
| `rounded-xl` | 12px | 1.5 × root | fields |
| `rounded-2xl` | 16px | 2 × root | media, nested blocks |
| `rounded-3xl` | 24px | 3 × root | the outer card surface |
| `rounded-4xl` | 32px | 4 × root | reserved, no live use |
| `rounded-field` | 12px | `--field-radius`, its own token | inputs, selects, buttons |
| `rounded-full` | pill | — | chips, avatars, switches |

`rounded-field` and `rounded-xl` are the same number today. They are **not the same token** — one
tracks the field concept, the other tracks the multiplier. Using `rounded-xl` on an input works
right now and breaks the day the field token moves.

## How steps relate

**Concentric: the inner radius is exactly one step smaller than the outer.** Used throughout the
app, by depth of nesting rather than by taste:

`card 3xl` → `media / nested block 2xl` → `input / field xl` → `chip / avatar / switch full`

Do not skip a step, and do not pick a radius for a new block by eye. Depth decides.

The formula applies to a **field nested inside a frame**. It does **not** apply to a nested card
surface, which keeps `3xl` by its own rule, and it does not apply to media, which is fixed at `2xl`
regardless of the padding around it. Three kinds of object, three answers — see the `surface`
decision sheet.

## Forbidden

| Forbidden | Caught by |
|---|---|
| adding `rounded-*` through `className` onto a HeroUI component that bakes its radius unlayered (`.card`, `.accordion--surface`, `.modal__dialog`) | nothing. The utility sits in `@layer utilities` and loses to baked CSS — **the class is silently ignored**, no error, no warning, no effect |
| choosing a radius for a new block by eye instead of by nesting depth | discipline |

## Read by which axes

`surface` — every radius decision routes through this scale.
`inset` — the concentric formula uses padding as its variable.

## Anchors

`globals.css` for `--radius` and `--field-radius`. `heroui.min.css` for the derived
`--radius-xs/xl/2xl/3xl/4xl`. The silent-override trap is recorded in the `card` and `input`
component notes.
